import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import earcut from 'earcut';
import { ParametricParams, ObjectType, PrintSettings, printConstraints } from '@/types/parametric';
import { generateLegsWithBase } from '@/lib/leg-generator';
import { sampleSpine, SpinePoint } from '@/lib/spine-generator';

// Scale factor: mm to scene units
const SCALE = 0.01;

// Deterministic noise
const seededRandom = (x: number, y: number, z: number) => {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719;
  return (Math.sin(dot) * 43758.5453) % 1;
};

const noise3D = (x: number, y: number, z: number, scale: number) => {
  const sx = x * scale;
  const sy = y * scale;
  const sz = z * scale;
  
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const iz = Math.floor(sz);
  
  const fx = sx - ix;
  const fy = sy - iy;
  const fz = sz - iz;
  
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  
  const n000 = seededRandom(ix, iy, iz);
  const n100 = seededRandom(ix + 1, iy, iz);
  const n010 = seededRandom(ix, iy + 1, iz);
  const n110 = seededRandom(ix + 1, iy + 1, iz);
  const n001 = seededRandom(ix, iy, iz + 1);
  const n101 = seededRandom(ix + 1, iy, iz + 1);
  const n011 = seededRandom(ix, iy + 1, iz + 1);
  const n111 = seededRandom(ix + 1, iy + 1, iz + 1);
  
  const nx00 = n000 * (1 - ux) + n100 * ux;
  const nx10 = n010 * (1 - ux) + n110 * ux;
  const nx01 = n001 * (1 - ux) + n101 * ux;
  const nx11 = n011 * (1 - ux) + n111 * ux;
  
  const nxy0 = nx00 * (1 - uy) + nx10 * uy;
  const nxy1 = nx01 * (1 - uy) + nx11 * uy;
  
  return (nxy0 * (1 - uz) + nxy1 * uz) * 2 - 1;
};
// Drift offset structure - purely positional, no tilt/rotation
// Each layer has an X/Z offset relative to the origin
export interface DriftOffset {
  x: number;
  z: number;
}

// Calculate drift offsets for each height layer - shared between preview and export
// Drift is purely internal positional deviation:
// - Base remains centered at origin
// - No global rotation, tilt, or translation
// - Each slice's center drifts slightly relative to previous
// - Offsets accumulate smoothly as height increases
export function calculateDriftOffsets(
  drift: number,
  baseRadius: number,
  layerCount: number
): DriftOffset[] {
  const driftOffsets: DriftOffset[] = [];
  
  // At drift = 0, all offsets are zero
  if (drift <= 0 || layerCount <= 0) {
    for (let i = 0; i <= layerCount; i++) {
      driftOffsets.push({ x: 0, z: 0 });
    }
    return driftOffsets;
  }
  
  // First pass: generate raw offsets with damping for S-curve behavior
  const rawOffsets: { x: number; z: number }[] = [];
  let accumulatedX = 0;
  let accumulatedZ = 0;
  
  // Scale factor: at drift=1, max offset at top is ~25% of base radius
  const driftMagnitude = drift * baseRadius * 3.5;
  
  // Angle rotation rate: how fast the drift direction rotates with height
  // At full height, the angle will have rotated ~2 full turns for nice S-curves
  const angleRotationRate = Math.PI * 4;
  
  // Damping factor: each layer inherits this fraction of previous offset
  // Values < 1 cause drift to partially decay, creating S-curves
  const damping = 0.85;
  
  // Secondary per-layer deviation: small offsets that don't align with main drift
  // These create "disagreement" between layers for an accumulated/built look
  const deviationMagnitude = driftMagnitude * 0.1; // ~10% of main drift
  
  for (let i = 0; i <= layerCount; i++) {
    const t = i / layerCount;
    
    // Apply damping: accumulated offset decays toward zero
    accumulatedX *= damping;
    accumulatedZ *= damping;
    
    // WORLD-SPACE DRIFT: Fixed cardinal directions that don't rotate with twist
    // Use noise to select between discrete world-space directions
    // This creates layer disagreement rather than a smooth curved spine
    
    // Primary axis: oscillates between +X and -X in world space
    // Low frequency ensures sustained push in one direction before reversing
    const xAxisNoise = noise3D(t * 0.4, 0.1, 0.5, 0.5);
    const xSign = xAxisNoise > 0.1 ? 1 : xAxisNoise < -0.1 ? -1 : 0;
    
    // Secondary axis: oscillates between +Z and -Z, phase-shifted from X
    // Different seed creates independent oscillation
    const zAxisNoise = noise3D(0.3, t * 0.35, 0.8, 0.5);
    const zSign = zAxisNoise > 0.15 ? 1 : zAxisNoise < -0.15 ? -1 : 0;
    
    // Magnitude variation per layer
    const magnitudeNoise = 0.8 + noise3D(0.5, t * 0.6, 0.2, 0.5) * 0.4;
    
    // Add impulses in fixed world-space directions
    // X and Z are independent, creating perpendicular disagreement
    accumulatedX += xSign * driftMagnitude * 0.12 * magnitudeNoise;
    accumulatedZ += zSign * driftMagnitude * 0.12 * magnitudeNoise;
    
    // Height factor: drift effect ramps up from base
    const heightFactor = Math.pow(t, 0.8);
    
    // Calculate primary drift position
    const primaryX = accumulatedX * heightFactor;
    const primaryZ = accumulatedZ * heightFactor;
    
    // Per-layer jitter: small random offset that doesn't accumulate
    // Creates visible layer-to-layer disagreement
    const jitterX = noise3D(t * 3.0, 0.2, 0.9, 0.5) * driftMagnitude * 0.08 * heightFactor;
    const jitterZ = noise3D(0.7, t * 3.0, 0.4, 0.5) * driftMagnitude * 0.08 * heightFactor;
    
    rawOffsets.push({
      x: primaryX + jitterX,
      z: primaryZ + jitterZ
    });
  }
  
  // Second pass: causal (forward-only) smoothing to preserve S-curves
  // Each layer interpolates toward raw offset from previous smoothed layer
  // This smooths jitter without eliminating inflection points
  const smoothingFactor = 0.7; // How much to move toward raw value (0=fully smooth, 1=no smoothing)
  
  for (let i = 0; i <= layerCount; i++) {
    if (i === 0) {
      // Base layer: always exactly at origin
      driftOffsets.push({ x: 0, z: 0 });
    } else {
      // Interpolate from previous smoothed position toward current raw position
      const prevSmoothed = driftOffsets[i - 1];
      const currRaw = rawOffsets[i];
      driftOffsets.push({
        x: prevSmoothed.x + (currRaw.x - prevSmoothed.x) * smoothingFactor,
        z: prevSmoothed.z + (currRaw.z - prevSmoothed.z) * smoothingFactor
      });
    }
  }
  
  return driftOffsets;
}

// Calculate radius at a given height t (0-1) - includes ALL surface features
// NOTE: Caller is responsible for applying twist to theta before calling this function
function getRadiusAtHeight(
  t: number,
  params: ParametricParams,
  type: ObjectType,
  theta: number = 0
): number {
  const {
    baseRadius,
    topRadius,
    wobbleFrequency,
    wobbleAmplitude,
    bulgePosition,
    bulgeAmount,
    pinchAmount,
    asymmetry,
    rippleCount,
    rippleDepth,
    lipFlare,
    lipHeight,
    organicNoise,
    noiseScale,
    height,
    profileCurve,
    facetCount,
    facetSharpness,
    spiralGrooveCount,
    spiralGrooveDepth,
    spiralGrooveTwist,
    horizontalRibCount,
    horizontalRibDepth,
    horizontalRibWidth,
    flutingCount,
    flutingDepth,
  } = params;

  // Use theta directly - caller applies twist
  let effectiveTheta = theta;
  
  // Apply faceting (snap theta to polygon vertices)
  if (facetCount > 0 && facetCount >= 3) {
    const facetAngle = (Math.PI * 2) / facetCount;
    const facetIndex = Math.floor(effectiveTheta / facetAngle + 0.5);
    const snappedTheta = facetIndex * facetAngle;
    effectiveTheta = effectiveTheta + (snappedTheta - effectiveTheta) * facetSharpness;
  }

  // Base profile based on profileCurve type
  let radius: number;
  const radiusDiff = topRadius - baseRadius;
  
  switch (profileCurve) {
    case 'convex':
      // Bulges outward in the middle
      radius = baseRadius + radiusDiff * t + Math.sin(t * Math.PI) * Math.abs(radiusDiff) * 0.3;
      break;
    case 'concave':
      // Curves inward in the middle
      radius = baseRadius + radiusDiff * t - Math.sin(t * Math.PI) * Math.abs(radiusDiff) * 0.3;
      break;
    case 'hourglass':
      // Pinched in the middle
      radius = baseRadius + radiusDiff * t - Math.sin(t * Math.PI) * (baseRadius + topRadius) * 0.15;
      break;
    case 'wave':
      // Wavy profile with 2 oscillations
      radius = baseRadius + radiusDiff * t + Math.sin(t * Math.PI * 4) * baseRadius * 0.08;
      break;
    case 'linear':
    default:
      // Apply object-type specific curves on top of linear base
      if (type === 'lamp') {
        radius = baseRadius + (topRadius - baseRadius) * Math.pow(t, 0.6);
      } else if (type === 'sculpture') {
        const curve = Math.sin(t * Math.PI);
        radius = baseRadius * (1 - t * 0.3) + topRadius * t * 0.7 + curve * baseRadius * 0.2;
      } else {
        const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
        radius = baseRadius * (1 - t * 0.4) + topRadius * t * 0.6 + curve * baseRadius * 0.12;
      }
      break;
  }

  // Organic bulge
  const bulgeDist = Math.abs(t - bulgePosition);
  radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;

  // Pinch
  const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
  const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
  radius *= (1 - pinchTop - pinchBottom);

  // Lip flare
  if (lipHeight > 0 && lipFlare !== 0) {
    const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
    radius += lipT * lipT * lipFlare * baseRadius;
  }

  // Horizontal ribs (sinusoidal modulation based on height)
  if (horizontalRibCount > 0 && horizontalRibDepth > 0) {
    const ribPhase = t * horizontalRibCount * Math.PI * 2;
    const ribWave = Math.sin(ribPhase);
    const sharpness = 1 / (horizontalRibWidth || 0.5);
    const ribModifier = Math.pow(Math.abs(ribWave), sharpness) * Math.sign(ribWave);
    radius += ribModifier * horizontalRibDepth * baseRadius;
  }

  // Min radius
  radius = Math.max(radius, printConstraints.minBaseRadius * 0.5);

  // Angular deformations
  if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
    const maxWobble = Math.min(wobbleAmplitude, 0.15);
    radius += Math.sin(t * Math.PI * 2 * wobbleFrequency + effectiveTheta * 2) * maxWobble * baseRadius;
  }

  if (rippleCount > 0 && rippleDepth > 0) {
    const maxRipple = Math.min(rippleDepth, 0.1);
    radius += Math.sin(effectiveTheta * rippleCount) * maxRipple * baseRadius;
  }

  // Fluting (vertical grooves like classical columns)
  if (flutingCount > 0 && flutingDepth > 0) {
    const fluteAngle = effectiveTheta * flutingCount;
    const fluteWave = Math.cos(fluteAngle);
    if (fluteWave < 0) {
      radius += fluteWave * flutingDepth * baseRadius;
    }
  }

  // Spiral grooves (combine height and angle)
  if (spiralGrooveCount > 0 && spiralGrooveDepth > 0) {
    const spiralAngle = effectiveTheta + t * spiralGrooveTwist * Math.PI * 2;
    const spiralWave = Math.sin(spiralAngle * spiralGrooveCount);
    if (spiralWave < 0) {
      radius += spiralWave * spiralGrooveDepth * baseRadius;
    }
  }

  // Asymmetry (enhanced version matching ParametricMesh)
  if (asymmetry > 0) {
    const primaryWave = Math.sin(effectiveTheta) * Math.cos(t * Math.PI) * asymmetry * baseRadius;
    const secondaryWave = Math.sin(effectiveTheta * 2 + t * Math.PI * 3) * asymmetry * 0.5 * baseRadius;
    const lean = Math.cos(effectiveTheta) * t * asymmetry * 0.4 * baseRadius;
    radius += primaryWave + secondaryWave + lean;
  }

  if (organicNoise > 0) {
    const maxNoise = Math.min(organicNoise, 0.1);
    const y = t * height;
    const nx = Math.cos(effectiveTheta) * radius;
    const nz = Math.sin(effectiveTheta) * radius;
    radius += noise3D(nx * 0.1, y * 0.1, nz * 0.1, noiseScale) * maxNoise * baseRadius;
  }

  return Math.max(radius, params.wallThickness * 2);
}

// Calculate rim wave Z offset at a given position
// NOTE: Caller should pass theta WITH twist already applied
function getRimWaveOffset(
  t: number,
  theta: number,
  params: ParametricParams
): number {
  const { rimWaveCount, rimWaveDepth, height } = params;
  if (!rimWaveCount || rimWaveCount <= 0 || !rimWaveDepth || rimWaveDepth <= 0) return 0;
  
  const rimZone = 0.1; // Top 10% of height (matches ParametricMesh.tsx)
  const rimT = Math.max(0, (t - (1 - rimZone)) / rimZone);
  if (rimT <= 0) return 0;
  
  // theta should already include twist from caller
  return Math.sin(theta * rimWaveCount) * rimWaveDepth * height * rimT;
}

// Generate body mesh (open bottom, no base cap) for STL export
// Handles wall mount cut if standType is wall_mount
export function generateBodyMesh(
  params: ParametricParams,
  type: ObjectType
): THREE.BufferGeometry {
  const {
    height,
    wallThickness,
    twistAngle,
    addLegs,
    standType,
    wallMountStyle,
    wallMountCutOffset,
  } = params;

  // Check if this is a back-style wall mount
  const isWallMount = addLegs && standType === 'wall_mount' && wallMountStyle === 'back';
  const cutOffset = wallMountCutOffset || 0;

  const segments = 64;
  const heightSegments = Math.ceil(height / 2);

  // Determine if using spine-based generation
  const useSpine = params.spineEnabled && 
    ((params.spineAmplitudeX || 0) > 0 || (params.spineAmplitudeZ || 0) > 0);
  
  // Sample spine frames if using spine mode
  const spineParams = {
    spineEnabled: params.spineEnabled || false,
    spineAmplitudeX: params.spineAmplitudeX || 0,
    spineFrequencyX: params.spineFrequencyX || 2,
    spinePhaseX: params.spinePhaseX || 0,
    spineAmplitudeZ: params.spineAmplitudeZ || 0,
    spineFrequencyZ: params.spineFrequencyZ || 2,
    spinePhaseZ: params.spinePhaseZ || 0.25,
  };
  const spineFrames: SpinePoint[] = useSpine 
    ? sampleSpine(heightSegments, height, spineParams)
    : [];

  const outerVerts: number[] = [];
  const innerVerts: number[] = [];

  // Generate outer wall vertices
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    const twistRad = (twistAngle * Math.PI / 180) * t;

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      const r = getRadiusAtHeight(t, params, type, theta);
      
      let x: number, finalY: number, z: number;
      
      if (useSpine && spineFrames[i]) {
        // SPINE-BASED: Position vertex using Frenet frame
        const frame = spineFrames[i];
        const localX = Math.cos(theta);
        const localZ = Math.sin(theta);
        
        x = frame.position.x + frame.normal.x * localX * r + frame.binormal.x * localZ * r;
        finalY = frame.position.y + frame.normal.y * localX * r + frame.binormal.y * localZ * r;
        z = frame.position.z + frame.normal.z * localX * r + frame.binormal.z * localZ * r;
      } else {
        // Standard centered positioning
        x = Math.cos(theta) * r;
        z = Math.sin(theta) * r;
        finalY = y;
      }
      
      // Melt effect: vertical offset + lateral drag with delay envelope
      const meltAmount = params.meltAmount || 0;
      const meltLobes = params.meltLobes || 0;
      const meltVariation = params.meltVariation || 0;
      const meltPhase = (params.meltPhase || 0) * Math.PI * 2;
      const meltDelay = Math.min(params.meltDelay || 0, 0.8);
      const meltDragAmount = params.meltDragAmount || 0;
      const meltDragAngle = (params.meltDragAngle || 0) * Math.PI * 2;
      
      if (meltAmount > 0 || meltDragAmount > 0) {
        // Height-based envelope with delay
        let envelope = 0;
        if (t > meltDelay) {
          const remappedT = (t - meltDelay) / (1 - meltDelay);
          envelope = remappedT * remappedT;
        }
        
        if (meltAmount > 0 && envelope > 0) {
          const angularFactor = 1 + meltVariation * Math.sin(meltLobes * theta + meltPhase);
          finalY -= meltAmount * envelope * angularFactor;
        }
        
        if (meltDragAmount > 0 && envelope > 0) {
          x += meltDragAmount * envelope * Math.cos(meltDragAngle);
          z += meltDragAmount * envelope * Math.sin(meltDragAngle);
        }
      }
      
      outerVerts.push(x, finalY, z);
    }
  }

  // Generate inner wall vertices
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    const twistRad = (twistAngle * Math.PI / 180) * t;

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      const outerR = getRadiusAtHeight(t, params, type, theta);
      const r = Math.max(outerR - wallThickness, wallThickness);
      
      let x: number, finalY: number, z: number;
      
      if (useSpine && spineFrames[i]) {
        // SPINE-BASED: Position vertex using Frenet frame
        const frame = spineFrames[i];
        const localX = Math.cos(theta);
        const localZ = Math.sin(theta);
        
        x = frame.position.x + frame.normal.x * localX * r + frame.binormal.x * localZ * r;
        finalY = frame.position.y + frame.normal.y * localX * r + frame.binormal.y * localZ * r;
        z = frame.position.z + frame.normal.z * localX * r + frame.binormal.z * localZ * r;
      } else {
        // Standard centered positioning
        x = Math.cos(theta) * r;
        z = Math.sin(theta) * r;
        finalY = y;
      }
      
      // Melt effect for inner wall: vertical offset + lateral drag with delay envelope
      const meltAmount = params.meltAmount || 0;
      const meltLobes = params.meltLobes || 0;
      const meltVariation = params.meltVariation || 0;
      const meltPhase = (params.meltPhase || 0) * Math.PI * 2;
      const meltDelay = Math.min(params.meltDelay || 0, 0.8);
      const meltDragAmount = params.meltDragAmount || 0;
      const meltDragAngle = (params.meltDragAngle || 0) * Math.PI * 2;
      
      if (meltAmount > 0 || meltDragAmount > 0) {
        // Height-based envelope with delay
        let envelope = 0;
        if (t > meltDelay) {
          const remappedT = (t - meltDelay) / (1 - meltDelay);
          envelope = remappedT * remappedT;
        }
        
        if (meltAmount > 0 && envelope > 0) {
          const angularFactor = 1 + meltVariation * Math.sin(meltLobes * theta + meltPhase);
          finalY -= meltAmount * envelope * angularFactor;
        }
        
        if (meltDragAmount > 0 && envelope > 0) {
          x += meltDragAmount * envelope * Math.cos(meltDragAngle);
          z += meltDragAmount * envelope * Math.sin(meltDragAngle);
        }
      }
      
      innerVerts.push(x, finalY, z);
    }
  }

  if (isWallMount) {
    // Wall mount: clip at cut plane and generate back wall
    return generateWallMountBody(outerVerts, innerVerts, heightSegments, segments, height, cutOffset, wallThickness);
  } else {
    // Normal full 360° body
    return generateFullBody(outerVerts, innerVerts, heightSegments, segments);
  }
}

// Generate full 360° body mesh
function generateFullBody(
  outerVerts: number[],
  innerVerts: number[],
  heightSegments: number,
  segments: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Copy outer vertices
  const outerStart = 0;
  for (let i = 0; i < outerVerts.length; i++) {
    vertices.push(outerVerts[i]);
  }

  // Copy inner vertices
  const innerStart = vertices.length / 3;
  for (let i = 0; i < innerVerts.length; i++) {
    vertices.push(innerVerts[i]);
  }

  // Outer wall faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = outerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Inner wall faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = innerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Bottom rim - connect outer to inner wall at base
  for (let j = 0; j < segments; j++) {
    const outer1 = outerStart + j;
    const outer2 = outerStart + j + 1;
    const inner1 = innerStart + j;
    const inner2 = innerStart + j + 1;
    
    indices.push(outer1, inner1, outer2);
    indices.push(outer2, inner1, inner2);
  }

  // Top rim - connect outer to inner wall
  const topOuterStart = outerStart + heightSegments * (segments + 1);
  const topInnerStart = innerStart + heightSegments * (segments + 1);
  
  for (let j = 0; j < segments; j++) {
    const outer1 = topOuterStart + j;
    const outer2 = topOuterStart + j + 1;
    const inner1 = topInnerStart + j;
    const inner2 = topInnerStart + j + 1;
    
    indices.push(outer1, outer2, inner1);
    indices.push(inner1, outer2, inner2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

// Generate wall mount body with cut plane and integrated keyholes
function generateWallMountBody(
  outerVerts: number[],
  innerVerts: number[],
  heightSegments: number,
  segments: number,
  height: number,
  cutOffset: number,
  wallThickness: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];

  // Clip outer vertices at cut plane
  const clippedOuter: number[] = [];
  for (let i = 0; i < outerVerts.length; i += 3) {
    const x = outerVerts[i];
    const y = outerVerts[i + 1];
    let z = outerVerts[i + 2];
    if (z < cutOffset) z = cutOffset;
    clippedOuter.push(x, y, z);
  }

  // Clip inner vertices at cut plane
  const clippedInner: number[] = [];
  for (let i = 0; i < innerVerts.length; i += 3) {
    const x = innerVerts[i];
    const y = innerVerts[i + 1];
    let z = innerVerts[i + 2];
    if (z < cutOffset) z = cutOffset;
    clippedInner.push(x, y, z);
  }

  // Copy clipped outer vertices
  const outerStart = 0;
  for (let i = 0; i < clippedOuter.length; i++) {
    vertices.push(clippedOuter[i]);
  }

  // Copy clipped inner vertices
  const innerStart = vertices.length / 3;
  for (let i = 0; i < clippedInner.length; i++) {
    vertices.push(clippedInner[i]);
  }

  // Build shell surface faces (front part only - where z > cutOffset)
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = outerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;

      const za = clippedOuter[a * 3 + 2];
      const zb = clippedOuter[b * 3 + 2];
      const zc = clippedOuter[c * 3 + 2];
      const zd = clippedOuter[d * 3 + 2];

      const aFront = za > cutOffset + 0.001;
      const bFront = zb > cutOffset + 0.001;
      const cFront = zc > cutOffset + 0.001;
      const dFront = zd > cutOffset + 0.001;

      if (aFront || bFront || cFront || dFront) {
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
  }

  // Inner wall faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = innerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;

      const za = clippedInner[(a - innerStart) * 3 + 2];
      const zb = clippedInner[(b - innerStart) * 3 + 2];
      const zc = clippedInner[(c - innerStart) * 3 + 2];
      const zd = clippedInner[(d - innerStart) * 3 + 2];

      const aFront = za > cutOffset + 0.001;
      const bFront = zb > cutOffset + 0.001;
      const cFront = zc > cutOffset + 0.001;
      const dFront = zd > cutOffset + 0.001;

      if (aFront || bFront || cFront || dFront) {
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
  }

  // Bottom rim
  for (let j = 0; j < segments; j++) {
    const outer1 = outerStart + j;
    const outer2 = outerStart + j + 1;
    const inner1 = innerStart + j;
    const inner2 = innerStart + j + 1;

    const zo1 = clippedOuter[outer1 * 3 + 2];
    const zo2 = clippedOuter[outer2 * 3 + 2];
    
    if (zo1 > cutOffset + 0.001 || zo2 > cutOffset + 0.001) {
      indices.push(outer1, inner1, outer2);
      indices.push(outer2, inner1, inner2);
    }
  }

  // Top rim
  const topOuterStart = outerStart + heightSegments * (segments + 1);
  const topInnerStart = innerStart + heightSegments * (segments + 1);
  
  for (let j = 0; j < segments; j++) {
    const outer1 = topOuterStart + j;
    const outer2 = topOuterStart + j + 1;
    const inner1 = topInnerStart + j;
    const inner2 = topInnerStart + j + 1;

    const zo1 = clippedOuter[(outer1 - outerStart) * 3 + 2];
    const zo2 = clippedOuter[(outer2 - outerStart) * 3 + 2];

    if (zo1 > cutOffset + 0.001 || zo2 > cutOffset + 0.001) {
      indices.push(outer1, outer2, inner1);
      indices.push(inner1, outer2, inner2);
    }
  }

  // === CREATE BACK WALL WITH PROPER INTERSECTION CALCULATION ===
  // Find actual intersection points where body crosses the cut plane
  
  const leftEdgePoints: { x: number; y: number }[] = [];
  const rightEdgePoints: { x: number; y: number }[] = [];

  for (let i = 0; i <= heightSegments; i++) {
    const y = (i / heightSegments) * height;
    
    // Collect all intersection points at this height level
    const intersections: number[] = [];
    
    for (let j = 0; j < segments; j++) {
      const idx1 = i * (segments + 1) + j;
      const idx2 = i * (segments + 1) + j + 1;
      
      const x1 = outerVerts[idx1 * 3];
      const z1 = outerVerts[idx1 * 3 + 2];
      const x2 = outerVerts[idx2 * 3];
      const z2 = outerVerts[idx2 * 3 + 2];
      
      // Check if the cut plane crosses between these two vertices
      if ((z1 >= cutOffset && z2 < cutOffset) || (z1 < cutOffset && z2 >= cutOffset)) {
        const tInterp = (cutOffset - z1) / (z2 - z1);
        const xIntersect = x1 + tInterp * (x2 - x1);
        intersections.push(xIntersect);
      }
    }
    
    // Take leftmost and rightmost intersections
    if (intersections.length >= 2) {
      intersections.sort((a, b) => a - b);
      leftEdgePoints.push({ x: intersections[0], y });
      rightEdgePoints.push({ x: intersections[intersections.length - 1], y });
    } else if (intersections.length === 1) {
      // Single intersection - use symmetric fallback
      leftEdgePoints.push({ x: intersections[0], y });
      rightEdgePoints.push({ x: -intersections[0], y });
    }
  }

  // Build complete back wall polygon WITH PROPER THICKNESS and KEYHOLE HOLES using earcut
  const backThickness = wallThickness;
  
  if (leftEdgePoints.length >= 2 && rightEdgePoints.length >= 2) {
    // Create outline: left edge bottom to top, then right edge top to bottom
    const outline: { x: number; y: number }[] = [];
    
    for (const pt of leftEdgePoints) outline.push(pt);
    for (let i = rightEdgePoints.length - 1; i >= 0; i--) outline.push(rightEdgePoints[i]);
    
    if (outline.length >= 3) {
      // Calculate keyhole positions
      const KEYHOLE_HEAD_RADIUS = 5;
      const KEYHOLE_SLOT_WIDTH = 2.5;
      const KEYHOLE_SLOT_LENGTH = 10;
      
      const holeMargin = height * 0.15;
      const bottomY = Math.max(holeMargin, 15);
      const topY = Math.min(height - holeMargin, height - 15);
      
      const keyholePositions = [
        { x: 0, y: bottomY },
        { x: 0, y: topY }
      ];
      
      // Helper to generate keyhole outline points
      // CORRECT: large circle at BOTTOM (low Y), narrow slot going UP (high Y)
      const getKeyholeOutline = (cx: number, cy: number, segments: number = 24): { x: number; y: number }[] => {
        const points: { x: number; y: number }[] = [];
        
        // Top of slot (left to right)
        points.push({ x: cx - KEYHOLE_SLOT_WIDTH, y: cy + KEYHOLE_SLOT_LENGTH });
        points.push({ x: cx + KEYHOLE_SLOT_WIDTH, y: cy + KEYHOLE_SLOT_LENGTH });
        // Right side going down
        points.push({ x: cx + KEYHOLE_SLOT_WIDTH, y: cy });
        
        // Circle at bottom (clockwise from right to left)
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI / 2 - (i / segments) * Math.PI * 2;
          const x = cx + Math.cos(angle) * KEYHOLE_HEAD_RADIUS;
          const y = cy + Math.sin(angle) * KEYHOLE_HEAD_RADIUS;
          if (y <= cy + KEYHOLE_SLOT_WIDTH * 0.5 || Math.abs(x - cx) >= KEYHOLE_SLOT_WIDTH) {
            points.push({ x, y });
          }
        }
        
        // Left side going up
        points.push({ x: cx - KEYHOLE_SLOT_WIDTH, y: cy });
        return points;
      };
      
      // Prepare earcut data
      const flatCoords: number[] = [];
      const holeIndices: number[] = [];
      
      // Add outer outline
      for (const pt of outline) {
        flatCoords.push(pt.x, pt.y);
      }
      
      // Add keyhole holes
      for (const pos of keyholePositions) {
        holeIndices.push(flatCoords.length / 2);
        const keyholeOutline = getKeyholeOutline(pos.x, pos.y);
        for (const pt of keyholeOutline) {
          flatCoords.push(pt.x, pt.y);
        }
      }
      
      // Triangulate with earcut
      const triangleIndices = earcut(flatCoords, holeIndices.length > 0 ? holeIndices : undefined, 2);
      
      // Create vertices
      const frontStartIdx = vertices.length / 3;
      const numPoints = flatCoords.length / 2;
      
      for (let i = 0; i < numPoints; i++) {
        vertices.push(flatCoords[i * 2], flatCoords[i * 2 + 1], cutOffset);
      }
      
      const backStartIdx = vertices.length / 3;
      for (let i = 0; i < numPoints; i++) {
        vertices.push(flatCoords[i * 2], flatCoords[i * 2 + 1], cutOffset - backThickness);
      }
      
      // Front face triangles
      for (let i = 0; i < triangleIndices.length; i += 3) {
        indices.push(frontStartIdx + triangleIndices[i], frontStartIdx + triangleIndices[i + 1], frontStartIdx + triangleIndices[i + 2]);
      }
      
      // Back face triangles (reversed winding)
      for (let i = 0; i < triangleIndices.length; i += 3) {
        indices.push(backStartIdx + triangleIndices[i], backStartIdx + triangleIndices[i + 2], backStartIdx + triangleIndices[i + 1]);
      }
      
      // Outer edge walls
      for (let i = 0; i < outline.length; i++) {
        const frontA = frontStartIdx + i;
        const frontB = frontStartIdx + ((i + 1) % outline.length);
        const backA = backStartIdx + i;
        const backB = backStartIdx + ((i + 1) % outline.length);
        indices.push(frontA, backA, frontB);
        indices.push(frontB, backA, backB);
      }
      
      // Keyhole inner edge walls
      let holeStartIdx = outline.length;
      for (const pos of keyholePositions) {
        const keyholeOutline = getKeyholeOutline(pos.x, pos.y);
        const holeLen = keyholeOutline.length;
        
        for (let i = 0; i < holeLen; i++) {
          const frontA = frontStartIdx + holeStartIdx + i;
          const frontB = frontStartIdx + holeStartIdx + ((i + 1) % holeLen);
          const backA = backStartIdx + holeStartIdx + i;
          const backB = backStartIdx + holeStartIdx + ((i + 1) % holeLen);
          indices.push(frontA, frontB, backA);
          indices.push(frontB, backB, backA);
        }
        holeStartIdx += holeLen;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Add keyhole hole geometry to the vertices/indices arrays
 * Creates a keyhole-shaped hole through the back wall
 * CORRECT KEYHOLE: Large circle at TOP, narrow slot going DOWN
 */
function addKeyholeHole(
  vertices: number[],
  indices: number[],
  cx: number,
  cy: number,
  zPos: number,
  headRadius: number,
  slotWidth: number,
  slotLength: number,
  depth: number
): void {
  const segs = 24;
  const startIdx = vertices.length / 3;
  
  // Generate proper keyhole outline: circle at TOP, slot going DOWN
  // The outline traces: bottom of slot -> up right side -> around circle -> down left side
  const outlinePoints: { x: number; y: number }[] = [];
  
  // Bottom of slot (rounded bottom)
  const slotBottomY = cy - slotLength;
  for (let i = 0; i <= 8; i++) {
    const angle = Math.PI + (i / 8) * Math.PI; // Half circle at bottom of slot
    outlinePoints.push({
      x: cx + Math.cos(angle) * slotWidth,
      y: slotBottomY + Math.sin(angle) * slotWidth + slotWidth
    });
  }
  
  // Right side of slot going up to where it meets the circle
  outlinePoints.push({ x: cx + slotWidth, y: cy - headRadius * 0.3 });
  
  // Large circle at top - from right side around to left side
  // Find angle where slot meets circle
  const slotMeetAngle = Math.asin(slotWidth / headRadius);
  for (let i = 0; i <= segs; i++) {
    const angle = -Math.PI / 2 + slotMeetAngle + (i / segs) * (Math.PI * 2 - slotMeetAngle * 2);
    outlinePoints.push({
      x: cx + Math.cos(angle) * headRadius,
      y: cy + Math.sin(angle) * headRadius
    });
  }
  
  // Left side of slot going down
  outlinePoints.push({ x: cx - slotWidth, y: cy - headRadius * 0.3 });
  
  // Close the path back to bottom-left of slot (will be closed by first point)
  
  // Create front vertices (at back wall surface)
  for (const pt of outlinePoints) {
    vertices.push(pt.x, pt.y, zPos);
  }
  
  // Create back vertices (through the wall)
  const backStartIdx = vertices.length / 3;
  for (const pt of outlinePoints) {
    vertices.push(pt.x, pt.y, zPos - depth);
  }
  
  // Create hole wall faces (connecting front to back)
  const n = outlinePoints.length;
  for (let i = 0; i < n; i++) {
    const frontA = startIdx + i;
    const frontB = startIdx + ((i + 1) % n);
    const backA = backStartIdx + i;
    const backB = backStartIdx + ((i + 1) % n);
    
    // Wall quad (two triangles) - winding for inside of hole
    indices.push(frontA, backA, frontB);
    indices.push(frontB, backA, backB);
  }
  
  // Create back face of the hole (inside the wall)
  // Fan triangulation from center
  const backCenterIdx = vertices.length / 3;
  vertices.push(cx, cy - slotLength / 2, zPos - depth); // Center point
  
  for (let i = 0; i < n; i++) {
    const a = backStartIdx + i;
    const b = backStartIdx + ((i + 1) % n);
    indices.push(backCenterIdx, a, b); // Facing +Z (into the wall)
  }
}

// Generate legs with base disc mesh for STL export
export function generateLegsWithBaseMesh(
  params: ParametricParams
): THREE.BufferGeometry {
  return generateLegsWithBase(
    params.baseRadius,
    params.legCount,
    params.legHeight,
    params.legSpread,
    params.legThickness,
    params.legTaper,
    params.legInset,
    params.standBaseThickness || params.baseThickness || 3,
    // OrganicParams - for base disc deformation
    {
      wobbleFrequency: params.wobbleFrequency,
      wobbleAmplitude: params.wobbleAmplitude,
      rippleCount: params.rippleCount,
      rippleDepth: params.rippleDepth,
      asymmetry: params.asymmetry,
      organicNoise: params.organicNoise,
      noiseScale: params.noiseScale,
    },
    // SocketParams - for cord hole and centering lip
    {
      wallThickness: params.wallThickness,
      cordHoleEnabled: params.cordHoleEnabled,
      cordHoleDiameter: params.cordHoleDiameter,
      centeringLipEnabled: params.centeringLipEnabled,
      centeringLipHeight: params.centeringLipHeight,
      socketType: params.socketType,
    },
    undefined, // attachmentParams (unused)
    // PedestalParams - for base disc styling
    {
      thickness: params.standBaseThickness || 3,
      taper: params.standBaseTaper || 0,
      edgeStyle: params.standBaseEdgeStyle || 'flat',
      lip: params.standBaseLip || 0,
      lipThickness: params.standBaseLipThickness || 2,
      lipEdgeStyle: params.standBaseLipEdgeStyle || 'flat',
    },
    params.legStyle // Pass the leg style
  );
}

// Legacy function for backwards compatibility
export function generatePrintableMesh(
  params: ParametricParams,
  type: ObjectType
): THREE.BufferGeometry {
  return generateBodyMesh(params, type);
}

// Export body mesh to STL
export function exportBodyToSTL(
  params: ParametricParams,
  type: ObjectType
): Blob {
  const geometry = generateBodyMesh(params, type);
  const mesh = new THREE.Mesh(geometry);
  
  const exporter = new STLExporter();
  const result = exporter.parse(mesh);
  
  return new Blob([result], { type: 'application/octet-stream' });
}

// Export legs+base mesh to STL
export function exportLegsWithBaseToSTL(
  params: ParametricParams
): Blob {
  const geometry = generateLegsWithBaseMesh(params);
  const mesh = new THREE.Mesh(geometry);
  
  const exporter = new STLExporter();
  const result = exporter.parse(mesh);
  
  return new Blob([result], { type: 'application/octet-stream' });
}

// Legacy export function
export function exportToSTL(
  params: ParametricParams,
  type: ObjectType
): Blob {
  return exportBodyToSTL(params, type);
}

// Download body STL
export function downloadBodySTL(
  params: ParametricParams,
  type: ObjectType,
  filename: string = 'body.stl'
): void {
  const blob = exportBodyToSTL(params, type);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Download legs+base STL
export function downloadLegsWithBaseSTL(
  params: ParametricParams,
  filename: string = 'legs_base.stl'
): void {
  const blob = exportLegsWithBaseToSTL(params);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Download both parts
export function downloadAllParts(
  params: ParametricParams,
  type: ObjectType,
  baseFilename: string = 'model'
): void {
  downloadBodySTL(params, type, `${baseFilename}_body.stl`);
  
  if (params.addLegs) {
    setTimeout(() => {
      downloadLegsWithBaseSTL(params, `${baseFilename}_legs_base.stl`);
    }, 100);
  }
}

// Legacy download function
export function downloadSTL(
  params: ParametricParams,
  type: ObjectType,
  filename: string = 'model.stl'
): void {
  downloadBodySTL(params, type, filename);
}

// Generate G-code toolpath data
export interface GCodeLayer {
  z: number;
  paths: Array<{ x: number; y: number; z?: number }[]>;  // z is for non-planar
  isNonPlanar?: boolean;  // Flag indicating this is a curved layer
  tiltAngles?: number[];  // Tilt angle at each point (degrees) for visualization
}

// Generate spiral vase G-code layers (continuous Z movement)
export function generateSpiralVaseLayers(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): GCodeLayer[] {
  const layers: GCodeLayer[] = [];
  const { height, twistAngle, baseRadius } = params;
  const { layerHeight } = settings;
  
  const totalLayers = Math.ceil(height / layerHeight);
  const segments = 64; // Points per revolution
  const totalPoints = totalLayers * segments;
  
  // Pre-compute drift offsets (drift removed, using 0)
  const driftOffsets = calculateDriftOffsets(0, baseRadius, totalLayers);
  
  // Single continuous spiral path
  const spiralPath: { x: number; y: number; z: number }[] = [];
  
  for (let i = 0; i <= totalPoints; i++) {
    const progress = i / totalPoints;
    const baseZ = progress * height;
    const t = baseZ / height;
    const revolutions = i / segments;
    const theta = revolutions * Math.PI * 2;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    const outerR = getRadiusAtHeight(t, params, type, theta + twistRad);
    
    // Apply rim wave offset to Z (pass twisted theta)
    const rimOffset = getRimWaveOffset(t, theta + twistRad, params);
    
    // Get drift offset for this layer
    const layerIndex = Math.min(Math.floor(t * totalLayers), totalLayers);
    const driftOffset = driftOffsets[layerIndex];
    
    // Calculate local position (before drift offset)
    const localX = Math.cos(theta + twistRad) * outerR;
    const localY = Math.sin(theta + twistRad) * outerR;
    
    // Final Z includes base height + rim wave (no tilt - drift is purely positional)
    const finalZ = baseZ + rimOffset;
    
    spiralPath.push({
      x: localX + driftOffset.x,
      y: localY + driftOffset.z, // z drift becomes y in G-code
      z: finalZ,
    });
  }
  
  // Return as single layer with spiral path
  layers.push({
    z: 0,
    paths: [spiralPath],
  });
  
  return layers;
}

// Calculate surface height at (x, y) for non-planar printing
// Returns the Z height on the top surface at this XY position
function getSurfaceHeightAt(
  x: number,
  y: number,
  params: ParametricParams,
  type: ObjectType
): number {
  const { height, profileCurve } = params;
  const distFromCenter = Math.sqrt(x * x + y * y);
  const theta = Math.atan2(y, x);
  
  // Get the radius at the top to determine the object's edge
  const maxRadius = getRadiusAtHeight(1, params, type, theta);
  
  if (distFromCenter >= maxRadius) {
    return height; // Outside the object
  }
  
  const normalizedDist = distFromCenter / maxRadius;
  
  // Calculate dome height based on profile curve
  // 'convex' and 'wave' profiles suggest curved tops
  if (profileCurve === 'convex') {
    // Convex profile - hemisphere-like dome on top
    const domeHeight = maxRadius * 0.25;
    const domeZ = Math.sqrt(Math.max(0, 1 - normalizedDist * normalizedDist)) * domeHeight;
    return height + domeZ;
  } else if (profileCurve === 'wave') {
    // Wave profile - gentle undulating top
    const waveHeight = maxRadius * 0.15;
    const waveZ = (1 - normalizedDist * normalizedDist) * waveHeight;
    return height + waveZ;
  } else if (profileCurve === 'concave') {
    // Concave - slight inward curve (bowl-like)
    const curveHeight = maxRadius * 0.1;
    const curveZ = (1 - normalizedDist * normalizedDist) * curveHeight;
    return height + curveZ;
  }
  
  // Linear and hourglass - flat top
  return height;
}

// Calculate the outer surface Z at a given height t and angle theta
// This traces the outside contour of the object for full surface non-planar
function getOuterSurfaceZ(
  t: number,
  theta: number,
  params: ParametricParams,
  type: ObjectType
): number {
  const { height, profileCurve, baseRadius, topRadius } = params;
  
  // Get the radius at this height
  const r = getRadiusAtHeight(t, params, type, theta);
  const baseZ = t * height;
  
  // For full surface mode, we want paths that follow the outer contour
  // The "surface Z" represents vertical offset based on profile shape
  
  // Calculate the surface normal tilt based on profile curve
  if (profileCurve === 'convex') {
    // Outward bulging surface - layers curve outward
    const bulgePhase = Math.sin(t * Math.PI);
    return baseZ + bulgePhase * r * 0.05;
  } else if (profileCurve === 'concave') {
    // Inward curving surface
    const inwardPhase = Math.sin(t * Math.PI);
    return baseZ - inwardPhase * r * 0.03;
  } else if (profileCurve === 'wave') {
    // Wavy surface - sinusoidal Z offset
    const wavePhase = Math.sin(t * Math.PI * 3);
    return baseZ + wavePhase * 2;
  } else if (profileCurve === 'hourglass') {
    // Hourglass - curves inward then out
    const pinchT = Math.abs(t - 0.5) * 2;
    return baseZ + (1 - pinchT) * 1.5;
  }
  
  // Linear profile - slight curve following taper
  const taper = (topRadius - baseRadius) / baseRadius;
  return baseZ + Math.sin(t * Math.PI) * Math.abs(taper) * 2;
}

// Calculate wall angle at height t (how much the wall leans in/out)
function getWallAngle(
  t: number,
  params: ParametricParams,
  type: ObjectType,
  delta: number = 0.01
): number {
  const theta = 0; // Sample at theta=0
  const t1 = Math.max(0, t - delta);
  const t2 = Math.min(1, t + delta);
  
  const r1 = getRadiusAtHeight(t1, params, type, theta);
  const r2 = getRadiusAtHeight(t2, params, type, theta);
  const z1 = t1 * params.height;
  const z2 = t2 * params.height;
  
  const dr = r2 - r1;
  const dz = z2 - z1;
  
  // Angle from vertical (positive = outward lean, negative = inward)
  return Math.atan2(dr, dz) * 180 / Math.PI;
}

// Calculate tilt angle at a point on the surface (in degrees)
function calculateTiltAngle(
  x: number,
  y: number,
  params: ParametricParams,
  type: ObjectType,
  delta: number = 0.5
): number {
  // Calculate gradient using finite differences
  const z0 = getSurfaceHeightAt(x, y, params, type);
  const zDx = getSurfaceHeightAt(x + delta, y, params, type);
  const zDy = getSurfaceHeightAt(x, y + delta, params, type);
  
  const dZdx = (zDx - z0) / delta;
  const dZdy = (zDy - z0) / delta;
  
  // Surface normal components
  const gradientMag = Math.sqrt(dZdx * dZdx + dZdy * dZdy);
  
  // Tilt angle from vertical (0° = flat, 90° = vertical wall)
  return Math.atan(gradientMag) * 180 / Math.PI;
}

// Generate curved non-planar layers for the top surface
function generateCurvedTopLayers(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings,
  startZ: number // Z height where curved layers begin
): GCodeLayer[] {
  const layers: GCodeLayer[] = [];
  const { height, wallThickness, twistAngle } = params;
  const { layerHeight, nonPlanar } = settings;
  const maxTiltAngle = nonPlanar.maxZAngle;
  
  const segments = 48;
  
  // Generate curved layers from startZ to the top of the dome
  // Use the surface height function to determine actual Z per point
  const curvedLayerCount = Math.ceil((height * 0.4) / layerHeight); // Cover top 40%
  
  for (let layerIdx = 0; layerIdx < curvedLayerCount; layerIdx++) {
    const baseZ = startZ + layerIdx * layerHeight;
    const t = baseZ / height;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    const outerPath: { x: number; y: number; z: number }[] = [];
    const innerPath: { x: number; y: number; z: number }[] = [];
    const tiltAngles: number[] = [];
    
    for (let j = 0; j <= segments; j++) {
      const baseTheta = (j / segments) * Math.PI * 2;
      const thetaWithTwist = baseTheta + twistRad;
      const outerR = getRadiusAtHeight(t, params, type, thetaWithTwist);
      const innerR = Math.max(outerR - wallThickness, wallThickness);
      
      // Apply rim wave offset (use twisted theta)
      const rimOffset = getRimWaveOffset(t, thetaWithTwist, params);
      
      // Outer wall point
      const outerX = Math.cos(thetaWithTwist) * outerR;
      const outerY = Math.sin(thetaWithTwist) * outerR;
      const outerSurfaceZ = getSurfaceHeightAt(outerX, outerY, params, type);
      
      // Calculate target Z with non-planar adjustment
      // Blend between flat layer Z and surface-following Z
      const layerProgress = layerIdx / curvedLayerCount;
      const blendFactor = Math.pow(layerProgress, 2); // Gradual transition
      const targetOuterZ = baseZ + (outerSurfaceZ - height) * blendFactor + rimOffset;
      
      // Calculate tilt and clamp if needed
      const tiltAngle = calculateTiltAngle(outerX, outerY, params, type);
      const clampedTilt = Math.min(tiltAngle, maxTiltAngle);
      
      // If tilt would exceed max, reduce the Z offset
      const tiltFactor = tiltAngle > 0 ? clampedTilt / tiltAngle : 1;
      const finalOuterZ = baseZ + (targetOuterZ - baseZ) * tiltFactor;
      
      tiltAngles.push(tiltAngle);
      
      outerPath.push({
        x: outerX,
        y: outerY,
        z: finalOuterZ,
      });
      
      // Inner wall point - follow similar but slightly inside
      const innerX = Math.cos(thetaWithTwist) * innerR;
      const innerY = Math.sin(thetaWithTwist) * innerR;
      const innerSurfaceZ = getSurfaceHeightAt(innerX, innerY, params, type);
      const targetInnerZ = baseZ + (innerSurfaceZ - height) * blendFactor + rimOffset;
      const finalInnerZ = baseZ + (targetInnerZ - baseZ) * tiltFactor;
      
      innerPath.push({
        x: innerX,
        y: innerY,
        z: finalInnerZ,
      });
    }
    
    layers.push({
      z: baseZ,
      paths: [outerPath, innerPath],
      isNonPlanar: true,
      tiltAngles,
    });
  }
  
  return layers;
}

// Stage 2: Generate full surface curved layers that follow the entire object contour
function generateFullSurfaceLayers(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): GCodeLayer[] {
  const layers: GCodeLayer[] = [];
  const { height, wallThickness, twistAngle } = params;
  const { layerHeight, nonPlanar } = settings;
  const maxTiltAngle = nonPlanar.maxZAngle;
  
  const segments = 48;
  const totalLayers = Math.ceil(height / layerHeight);
  
  for (let layerIdx = 0; layerIdx < totalLayers; layerIdx++) {
    const baseZ = layerIdx * layerHeight;
    const t = Math.min(baseZ / height, 0.999); // Clamp to prevent overflow
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    const outerPath: { x: number; y: number; z: number }[] = [];
    const innerPath: { x: number; y: number; z: number }[] = [];
    const tiltAngles: number[] = [];
    
    // Get wall angle at this height to determine tilt
    const wallAngle = Math.abs(getWallAngle(t, params, type));
    
    for (let j = 0; j <= segments; j++) {
      const baseTheta = (j / segments) * Math.PI * 2;
      const thetaWithTwist = baseTheta + twistRad;
      const outerR = getRadiusAtHeight(t, params, type, thetaWithTwist);
      const innerR = Math.max(outerR - wallThickness, wallThickness);
      
      // Calculate the surface-following Z offset
      const surfaceZ = getOuterSurfaceZ(t, thetaWithTwist, params, type);
      
      // Apply rim wave offset (use twisted theta)
      const rimOffset = getRimWaveOffset(t, thetaWithTwist, params);
      
      // Clamp tilt angle to maxZAngle
      const effectiveTilt = Math.min(wallAngle, maxTiltAngle);
      const tiltFactor = wallAngle > 0 ? effectiveTilt / wallAngle : 1;
      
      // Blend between base Z and surface Z based on allowed tilt
      const zOffset = (surfaceZ - baseZ) * tiltFactor;
      const finalZ = baseZ + zOffset + rimOffset;
      
      tiltAngles.push(wallAngle);
      
      // Outer wall point
      outerPath.push({
        x: Math.cos(thetaWithTwist) * outerR,
        y: Math.sin(thetaWithTwist) * outerR,
        z: finalZ,
      });
      
      // Inner wall point - follows at inner radius
      innerPath.push({
        x: Math.cos(thetaWithTwist) * innerR,
        y: Math.sin(thetaWithTwist) * innerR,
        z: finalZ,
      });
    }
    
    layers.push({
      z: baseZ,
      paths: [outerPath, innerPath],
      isNonPlanar: wallAngle > 1, // Mark as non-planar if wall has significant angle
      tiltAngles,
    });
  }
  
  // Add curved top layers if the profile has a curved top
  const hasCurvedTop = ['convex', 'wave', 'concave'].includes(params.profileCurve);
  if (hasCurvedTop) {
    const topLayers = generateCurvedTopLayers(params, type, settings, height * 0.85);
    layers.push(...topLayers);
  }
  
  return layers;
}

export function generateGCodeLayers(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): GCodeLayer[] {
  // Use spiral mode if enabled
  if (settings.spiralVase || settings.printMode === 'vase_spiral') {
    return generateSpiralVaseLayers(params, type, settings);
  }
  
  const { height, wallThickness, twistAngle, profileCurve, baseRadius } = params;
  const { layerHeight, printMode, nonPlanar } = settings;
  
  const isNonPlanar = printMode === 'non_planar';
  const isFullSurface = isNonPlanar && nonPlanar.fullSurfaceLayers;
  const isTopOptimized = isNonPlanar && nonPlanar.topSurfaceOptimized;
  
  // Stage 2: Full surface curved layers
  if (isFullSurface) {
    return generateFullSurfaceLayers(params, type, settings);
  }
  
  const layers: GCodeLayer[] = [];
  
  // Curves that benefit from non-planar top finishing
  const hasCurvedTop = ['convex', 'wave', 'concave'].includes(profileCurve);
  
  // Calculate where non-planar zone begins (top 30% for curved surfaces)
  const nonPlanarStartZ = isTopOptimized && hasCurvedTop ? height * 0.7 : height;
  const planarLayerCount = Math.ceil(nonPlanarStartZ / layerHeight);
  
  const segments = 48; // Points per perimeter
  
  // Pre-compute drift offsets (drift removed, using 0)
  const totalLayers = Math.ceil(height / layerHeight);
  const driftOffsets = calculateDriftOffsets(0, baseRadius, totalLayers);
  
  // Generate planar layers up to the non-planar zone
  for (let layer = 0; layer < planarLayerCount; layer++) {
    const baseZ = layer * layerHeight;
    const t = baseZ / height;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    // Get drift offset for this layer
    const driftOffset = driftOffsets[Math.min(layer, totalLayers)];
    
    // Check if this layer needs rim wave (variable Z)
    const hasRimWave = params.rimWaveCount > 0 && params.rimWaveDepth > 0 && t > 0.9;
    
    if (hasRimWave) {
      // Near the rim with waves - use variable Z paths
      const outerPath: { x: number; y: number; z: number }[] = [];
      const innerPath: { x: number; y: number; z: number }[] = [];
      
      for (let j = 0; j <= segments; j++) {
        const baseTheta = (j / segments) * Math.PI * 2;
        const thetaWithTwist = baseTheta + twistRad;
        const outerR = getRadiusAtHeight(t, params, type, thetaWithTwist);
        const innerR = Math.max(outerR - wallThickness, wallThickness);
        
        const rimOffset = getRimWaveOffset(t, thetaWithTwist, params);
        const pointZ = baseZ + rimOffset;
        
        outerPath.push({
          x: Math.cos(thetaWithTwist) * outerR + driftOffset.x,
          y: Math.sin(thetaWithTwist) * outerR + driftOffset.z,
          z: pointZ,
        });
        
        innerPath.push({
          x: Math.cos(thetaWithTwist) * innerR + driftOffset.x,
          y: Math.sin(thetaWithTwist) * innerR + driftOffset.z,
          z: pointZ,
        });
      }
      
      layers.push({
        z: baseZ,
        paths: [outerPath, innerPath],
        isNonPlanar: true, // Variable Z within layer
      });
    } else {
      // Standard planar layer
      const outerPath: { x: number; y: number }[] = [];
      const innerPath: { x: number; y: number }[] = [];
      
      for (let j = 0; j <= segments; j++) {
        const baseTheta = (j / segments) * Math.PI * 2;
        const thetaWithTwist = baseTheta + twistRad;
        const outerR = getRadiusAtHeight(t, params, type, thetaWithTwist);
        const innerR = Math.max(outerR - wallThickness, wallThickness);
        
        outerPath.push({
          x: Math.cos(thetaWithTwist) * outerR + driftOffset.x,
          y: Math.sin(thetaWithTwist) * outerR + driftOffset.z,
        });
        
        innerPath.push({
          x: Math.cos(thetaWithTwist) * innerR + driftOffset.x,
          y: Math.sin(thetaWithTwist) * innerR + driftOffset.z,
        });
      }
      
      layers.push({
        z: baseZ,
        paths: [outerPath, innerPath],
        isNonPlanar: false,
      });
    }
  }
  
  // Add curved non-planar layers for the top surface (Stage 1)
  if (isTopOptimized && hasCurvedTop) {
    const curvedLayers = generateCurvedTopLayers(params, type, settings, nonPlanarStartZ);
    layers.push(...curvedLayers);
  }
  
  return layers;
}

// Extrusion calculation parameters
interface ExtrusionParams {
  filamentDiameter: number;  // mm (typically 1.75)
  nozzleDiameter: number;    // mm (typically 0.4)
  layerHeight: number;       // mm
  extrusionMultiplier: number; // flow rate multiplier (1.0 = 100%)
}

// Calculate extrusion amount for a given distance
function calculateExtrusion(
  distance: number,
  params: ExtrusionParams
): number {
  // Volume of filament needed = cross-section of printed line * distance
  // Cross-section = layer height * nozzle diameter (simplified rectangular approximation)
  const lineArea = params.layerHeight * params.nozzleDiameter;
  const volumeNeeded = lineArea * distance;
  
  // Filament cross-section area
  const filamentArea = Math.PI * Math.pow(params.filamentDiameter / 2, 2);
  
  // Length of filament to extrude
  const filamentLength = (volumeNeeded / filamentArea) * params.extrusionMultiplier;
  
  return filamentLength;
}

// Retraction settings
interface RetractionSettings {
  distance: number;     // mm of filament to retract
  speed: number;        // mm/s retraction speed
  zHop: number;         // mm to lift nozzle during travel
  minTravelDistance: number;  // minimum travel before retracting
}

const DEFAULT_RETRACTION: RetractionSettings = {
  distance: 1.0,        // 1mm retraction
  speed: 45,            // 45mm/s
  zHop: 0.4,           // 0.4mm lift during travel
  minTravelDistance: 2, // only retract for travels > 2mm
};

// Non-planar analysis result
export interface NonPlanarAnalysis {
  maxTiltAngle: number;           // Maximum tilt angle encountered (degrees)
  avgTiltAngle: number;           // Average tilt angle (degrees)
  nonPlanarLayerCount: number;    // Number of layers with non-planar paths
  totalLayerCount: number;        // Total layer count
  collisionRiskZones: Array<{     // Zones where collision might occur
    layerIndex: number;
    tiltAngle: number;
    x: number;
    y: number;
    z: number;
  }>;
  exceedsMaxAngle: boolean;       // True if any point exceeds configured max angle
  isSafeForPrinting: boolean;     // Overall safety assessment
}

// Analyze non-planar G-code for potential issues
export function analyzeNonPlanarGCode(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): NonPlanarAnalysis {
  const layers = generateGCodeLayers(params, type, settings);
  const maxConfiguredAngle = settings.nonPlanar?.maxZAngle || 30;
  
  let maxTiltAngle = 0;
  let totalTiltAngle = 0;
  let tiltPointCount = 0;
  let nonPlanarLayerCount = 0;
  const collisionRiskZones: NonPlanarAnalysis['collisionRiskZones'] = [];
  
  layers.forEach((layer, layerIndex) => {
    if (layer.isNonPlanar) {
      nonPlanarLayerCount++;
    }
    
    if (layer.tiltAngles) {
      layer.tiltAngles.forEach((angle, pointIndex) => {
        maxTiltAngle = Math.max(maxTiltAngle, angle);
        totalTiltAngle += angle;
        tiltPointCount++;
        
        // Mark collision risk zones (within 5 degrees of max or exceeding)
        if (angle > maxConfiguredAngle - 5) {
          const path = layer.paths[0];
          if (path && path[pointIndex]) {
            collisionRiskZones.push({
              layerIndex,
              tiltAngle: angle,
              x: path[pointIndex].x,
              y: path[pointIndex].y,
              z: path[pointIndex].z || layer.z,
            });
          }
        }
      });
    }
  });
  
  const avgTiltAngle = tiltPointCount > 0 ? totalTiltAngle / tiltPointCount : 0;
  const exceedsMaxAngle = maxTiltAngle > maxConfiguredAngle;
  
  // Safety assessment: safe if max angle is within limits and collision zones are minimal
  const isSafeForPrinting = !exceedsMaxAngle && collisionRiskZones.length < 10;
  
  return {
    maxTiltAngle,
    avgTiltAngle,
    nonPlanarLayerCount,
    totalLayerCount: layers.length,
    collisionRiskZones,
    exceedsMaxAngle,
    isSafeForPrinting,
  };
}

// Generate actual G-code string with proper extrusion and retraction
export function generateGCode(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): string {
  const layers = generateGCodeLayers(params, type, settings);
  const { printSpeed, layerHeight, material, nozzleDiameter, buildPlateWidth, buildPlateDepth } = settings;
  const isSpiralVase = settings.spiralVase || settings.printMode === 'vase_spiral';
  const isNonPlanar = settings.printMode === 'non_planar';
  
  // Build plate center offset - all coordinates will be offset by this
  const centerX = (buildPlateWidth || 200) / 2;
  const centerY = (buildPlateDepth || 200) / 2;
  
  const lines: string[] = [];
  
  // Extrusion parameters
  const extrusionParams: ExtrusionParams = {
    filamentDiameter: 1.75,
    nozzleDiameter: nozzleDiameter,
    layerHeight: layerHeight,
    extrusionMultiplier: 1.0,
  };
  
  // Retraction settings (can be made configurable later)
  const retraction = DEFAULT_RETRACTION;
  
  // Non-planar analysis for header comments
  let nonPlanarAnalysis: NonPlanarAnalysis | null = null;
  if (isNonPlanar) {
    nonPlanarAnalysis = analyzeNonPlanarGCode(params, type, settings);
  }
  
  // G-code header
  lines.push('; Generated by Parametric 3D Generator');
  lines.push(`; Object Type: ${type}`);
  lines.push(`; Height: ${params.height}mm`);
  lines.push(`; Material: ${material}`);
  lines.push(`; Layer Height: ${layerHeight}mm`);
  lines.push(`; Nozzle Diameter: ${nozzleDiameter}mm`);
  lines.push(`; Print Mode: ${settings.printMode}`);
  lines.push(`; Print Speed: ${printSpeed}mm/s`);
  lines.push(`; Build Plate: ${buildPlateWidth || 200}x${buildPlateDepth || 200}mm`);
  lines.push(`; Model centered at: (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
  
  if (isSpiralVase) {
    lines.push('; Mode: Spiral Vase (continuous Z movement)');
  }
  
  if (isNonPlanar && nonPlanarAnalysis) {
    lines.push('; ===== NON-PLANAR PRINTING INFORMATION =====');
    lines.push(`; Max Z Angle Setting: ${settings.nonPlanar.maxZAngle}°`);
    lines.push(`; Actual Max Tilt Angle: ${nonPlanarAnalysis.maxTiltAngle.toFixed(1)}°`);
    lines.push(`; Average Tilt Angle: ${nonPlanarAnalysis.avgTiltAngle.toFixed(1)}°`);
    lines.push(`; Non-Planar Layers: ${nonPlanarAnalysis.nonPlanarLayerCount}/${nonPlanarAnalysis.totalLayerCount}`);
    if (nonPlanarAnalysis.exceedsMaxAngle) {
      lines.push('; ⚠ WARNING: Some points exceed the configured max angle!');
    }
    if (nonPlanarAnalysis.collisionRiskZones.length > 0) {
      lines.push(`; ⚠ CAUTION: ${nonPlanarAnalysis.collisionRiskZones.length} potential collision risk zones detected`);
    }
    if (nonPlanarAnalysis.isSafeForPrinting) {
      lines.push('; ✓ Analysis: Safe for non-planar printing');
    } else {
      lines.push('; ✗ Analysis: Review collision risks before printing');
    }
    lines.push('; Note: Requires non-planar capable slicer/printer');
    lines.push('; ============================================');
  }
  
  lines.push(`; Total Layers: ${isSpiralVase ? 'Continuous spiral' : layers.length}`);
  lines.push('');
  
  // Machine setup
  lines.push('; ===== MACHINE SETUP =====');
  lines.push('G21 ; Set units to millimeters');
  lines.push('G90 ; Use absolute positioning');
  lines.push('M82 ; Use absolute extrusion');
  lines.push('G28 ; Home all axes');
  lines.push('G1 Z5 F3000 ; Lift nozzle');
  lines.push('');
  
  // Temperature settings based on material
  const temps: Record<string, { bed: number; nozzle: number }> = {
    PLA: { bed: 60, nozzle: 200 },
    PETG: { bed: 80, nozzle: 235 },
    ABS: { bed: 100, nozzle: 240 },
    TPU: { bed: 50, nozzle: 220 },
  };
  const temp = temps[material] || temps.PLA;
  
  lines.push('; ===== TEMPERATURE =====');
  lines.push(`M140 S${temp.bed} ; Set bed temperature`);
  lines.push(`M104 S${temp.nozzle} ; Set nozzle temperature`);
  lines.push(`M190 S${temp.bed} ; Wait for bed`);
  lines.push(`M109 S${temp.nozzle} ; Wait for nozzle`);
  lines.push('');
  
  // Prime line (helps ensure consistent flow)
  lines.push('; ===== PRIME LINE =====');
  lines.push('G1 Z0.3 F3000');
  lines.push('G1 X5 Y5 F3000');
  lines.push('G1 X100 E10 F1500 ; Prime line');
  lines.push('G1 E-0.5 F3000 ; Small retract');
  lines.push('G1 Z2 F3000 ; Lift');
  lines.push('');
  
  // Print layers
  let e = 0; // Cumulative extrusion distance
  let currentZ = 0;
  let lastX = 0;
  let lastY = 0;
  let isRetracted = false;
  
  // Helper to generate retraction G-code
  const retract = (currentZ: number): string[] => {
    if (isRetracted) return [];
    isRetracted = true;
    const cmds: string[] = [];
    cmds.push(`G1 E${(e - retraction.distance).toFixed(4)} F${retraction.speed * 60} ; Retract`);
    if (retraction.zHop > 0) {
      cmds.push(`G1 Z${(currentZ + retraction.zHop).toFixed(3)} F3000 ; Z-hop`);
    }
    e -= retraction.distance;
    return cmds;
  };
  
  // Helper to generate de-retraction G-code
  const deRetract = (targetZ: number): string[] => {
    if (!isRetracted) return [];
    isRetracted = false;
    const cmds: string[] = [];
    cmds.push(`G1 Z${targetZ.toFixed(3)} F3000 ; End Z-hop`);
    e += retraction.distance;
    cmds.push(`G1 E${e.toFixed(4)} F${retraction.speed * 60} ; De-retract`);
    return cmds;
  };
  
  // Calculate travel distance
  const travelDistance = (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  };
  
  lines.push('; ===== PRINT START =====');
  
  if (isSpiralVase && layers.length > 0 && layers[0].paths.length > 0) {
    // Spiral vase mode - continuous Z movement
    lines.push('; Spiral Vase Mode - Continuous extrusion');
    const spiralPath = layers[0].paths[0];
    
    if (spiralPath.length > 0) {
      const firstPoint = spiralPath[0];
      const startZ = firstPoint.z || 0;
      // Apply center offset
      const x0 = firstPoint.x + centerX;
      const y0 = firstPoint.y + centerY;
      lines.push(`G0 X${x0.toFixed(3)} Y${y0.toFixed(3)} Z${startZ.toFixed(3)} F3000 ; Move to start`);
      lastX = x0;
      lastY = y0;
      currentZ = startZ;
      
      for (let i = 1; i < spiralPath.length; i++) {
        const point = spiralPath[i];
        const prevPoint = spiralPath[i - 1];
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const z1 = prevPoint.z || 0;
        const z2 = point.z || 0;
        const dz = z2 - z1;
        
        // 3D distance for proper extrusion calculation
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const extrusionAmount = calculateExtrusion(dist, extrusionParams);
        e += extrusionAmount;
        
        // Apply center offset
        const px = point.x + centerX;
        const py = point.y + centerY;
        lines.push(`G1 X${px.toFixed(3)} Y${py.toFixed(3)} Z${z2.toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
        
        lastX = px;
        lastY = py;
        currentZ = z2;
      }
    }
  } else {
    // Standard layer-by-layer printing (with non-planar support)
    layers.forEach((layer, layerIndex) => {
      const isLayerNonPlanar = layer.isNonPlanar;
      const layerZ = layer.z;
      
      lines.push('');
      if (isLayerNonPlanar) {
        lines.push(`; ===== LAYER ${layerIndex + 1}/${layers.length} [NON-PLANAR] =====`);
        if (layer.tiltAngles && layer.tiltAngles.length > 0) {
          const maxAngle = Math.max(...layer.tiltAngles);
          const minAngle = Math.min(...layer.tiltAngles);
          lines.push(`; Tilt range: ${minAngle.toFixed(1)}° - ${maxAngle.toFixed(1)}°`);
        }
      } else {
        lines.push(`; ===== LAYER ${layerIndex + 1}/${layers.length} Z=${layerZ.toFixed(2)}mm =====`);
      }
      
      // Move to layer height for planar layers
      if (!isLayerNonPlanar && layerZ !== currentZ) {
        if (isRetracted) {
          lines.push(`G1 Z${layerZ.toFixed(3)} F1000 ; Move to layer Z`);
        } else {
          lines.push(`G1 Z${layerZ.toFixed(3)} F1000 ; Move to layer Z`);
        }
        currentZ = layerZ;
      }
      
      layer.paths.forEach((path, pathIndex) => {
        if (path.length < 2) return;
        
        const startPoint = path[0];
        const startZ = startPoint.z !== undefined ? startPoint.z : layerZ;
        
        // Apply center offset
        const sx = startPoint.x + centerX;
        const sy = startPoint.y + centerY;
        
        // Calculate travel distance to determine if retraction is needed
        const travel = travelDistance(lastX, lastY, sx, sy);
        
        if (pathIndex > 0 || layerIndex > 0) {
          // Add retraction for significant travel moves
          if (travel > retraction.minTravelDistance) {
            lines.push(...retract(currentZ));
          }
        }
        
        // Travel move to path start
        if (isLayerNonPlanar) {
          lines.push(`G0 X${sx.toFixed(3)} Y${sy.toFixed(3)} Z${startZ.toFixed(3)} F3000 ; Travel to path start`);
        } else {
          lines.push(`G0 X${sx.toFixed(3)} Y${sy.toFixed(3)} F3000 ; Travel to path start`);
        }
        
        // De-retract before printing
        if (isRetracted) {
          lines.push(...deRetract(startZ));
        }
        
        lastX = sx;
        lastY = sy;
        currentZ = startZ;
        
        // Extrude along path
        for (let i = 1; i < path.length; i++) {
          const point = path[i];
          const prevPoint = path[i - 1];
          
          const dx = point.x - prevPoint.x;
          const dy = point.y - prevPoint.y;
          
          // For non-planar, calculate 3D distance including Z delta
          const z1 = prevPoint.z !== undefined ? prevPoint.z : layerZ;
          const z2 = point.z !== undefined ? point.z : layerZ;
          const dz = z2 - z1;
          
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const extrusionAmount = calculateExtrusion(dist, extrusionParams);
          e += extrusionAmount;
          
          // Apply center offset
          const px = point.x + centerX;
          const py = point.y + centerY;
          
          if (isLayerNonPlanar) {
            // Include Z coordinate for non-planar moves
            lines.push(`G1 X${px.toFixed(3)} Y${py.toFixed(3)} Z${z2.toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
          } else {
            lines.push(`G1 X${px.toFixed(3)} Y${py.toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
          }
          
          lastX = px;
          lastY = py;
          currentZ = z2;
        }
      });
    });
  }
  
  // G-code footer
  lines.push('');
  lines.push('; ===== END G-CODE =====');
  lines.push(...retract(currentZ)); // Final retraction
  lines.push(`G1 Z${Math.min(params.height + 20, 250)} F3000 ; Lift nozzle`);
  lines.push('G28 X Y ; Home X and Y');
  lines.push('M104 S0 ; Turn off nozzle');
  lines.push('M140 S0 ; Turn off bed');
  lines.push('M107 ; Turn off fan');
  lines.push('M84 ; Disable motors');
  lines.push('; Print complete');
  
  return lines.join('\n');
}

// Download G-code file
export function downloadGCode(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings,
  filename: string = 'model.gcode'
): void {
  const gcode = generateGCode(params, type, settings);
  const blob = new Blob([gcode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
