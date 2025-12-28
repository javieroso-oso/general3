import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { ParametricParams, ObjectType, PrintSettings, printConstraints } from '@/types/parametric';
import { generateLegsWithBase } from '@/lib/leg-generator';

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
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      outerVerts.push(x, y, z);
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
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      innerVerts.push(x, y, z);
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

  // Build complete back wall polygon
  if (leftEdgePoints.length >= 2 && rightEdgePoints.length >= 2) {
    // Create outline: left edge bottom to top, then right edge top to bottom
    const outline: { x: number; y: number }[] = [];
    
    // Left edge (bottom to top)
    for (const pt of leftEdgePoints) {
      outline.push(pt);
    }
    
    // Right edge (top to bottom - reversed)
    for (let i = rightEdgePoints.length - 1; i >= 0; i--) {
      outline.push(rightEdgePoints[i]);
    }
    
    if (outline.length >= 3) {
      // Add back wall vertices
      const backWallStartIdx = vertices.length / 3;
      for (const pt of outline) {
        vertices.push(pt.x, pt.y, cutOffset);
      }
      
      // Calculate centroid for fan triangulation
      let centerX = 0, centerY = 0;
      for (const pt of outline) {
        centerX += pt.x;
        centerY += pt.y;
      }
      centerX /= outline.length;
      centerY /= outline.length;
      
      const centerIdx = vertices.length / 3;
      vertices.push(centerX, centerY, cutOffset);
      
      // Create fan triangles (facing -Z direction, so we use proper winding)
      for (let i = 0; i < outline.length; i++) {
        const a = backWallStartIdx + i;
        const b = backWallStartIdx + ((i + 1) % outline.length);
        // Winding for back face (facing -Z)
        indices.push(centerIdx, b, a);
      }
      
      // === ADD KEYHOLE GEOMETRY TO BACK WALL ===
      // Create actual keyhole holes in the back wall for proper STL export
      const KEYHOLE_HEAD_RADIUS = 4; // 8mm diameter head hole
      const KEYHOLE_SLOT_WIDTH = 2;  // 4mm slot width
      const KEYHOLE_SLOT_LENGTH = 8; // 8mm slot length
      const KEYHOLE_DEPTH = wallThickness + 1; // Through the back wall
      
      // Calculate keyhole positions (2 vertical holes centered)
      const holeMargin = height * 0.15;
      const bottomY = Math.max(holeMargin, 15);
      const topY = Math.min(height - holeMargin, height - 15);
      
      const keyholePositions = [
        { x: 0, y: bottomY },
        { x: 0, y: topY }
      ];
      
      // Add keyhole hole geometry for each position
      for (const pos of keyholePositions) {
        addKeyholeHole(vertices, indices, pos.x, pos.y, cutOffset, KEYHOLE_HEAD_RADIUS, KEYHOLE_SLOT_WIDTH, KEYHOLE_SLOT_LENGTH, KEYHOLE_DEPTH);
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
  
  // Generate keyhole outline points - circle at TOP, slot going DOWN
  const outlinePoints: { x: number; y: number }[] = [];
  
  // Large circle at top (center at cy, going clockwise from right)
  for (let i = 0; i <= segs; i++) {
    const angle = -Math.PI / 2 + (i / segs) * Math.PI * 2;
    outlinePoints.push({
      x: cx + Math.cos(angle) * headRadius,
      y: cy + Math.sin(angle) * headRadius
    });
  }
  
  // Find the points where circle meets slot (at y = cy - some small offset)
  const slotTopY = cy - headRadius * 0.3;
  const slotBottomY = cy - slotLength;
  
  // Create front vertices for keyhole outline
  for (const pt of outlinePoints) {
    vertices.push(pt.x, pt.y, zPos);
  }
  
  // Create back vertices for keyhole outline
  const backStart = vertices.length / 3;
  for (const pt of outlinePoints) {
    vertices.push(pt.x, pt.y, zPos - depth);
  }
  
  // Create circle wall faces
  for (let i = 0; i < outlinePoints.length - 1; i++) {
    const frontA = startIdx + i;
    const frontB = startIdx + i + 1;
    const backA = backStart + i;
    const backB = backStart + i + 1;
    
    indices.push(frontA, frontB, backA);
    indices.push(backA, frontB, backB);
  }
  
  // Now add the slot going DOWN from circle
  const slotStartIdx = vertices.length / 3;
  
  // Slot front vertices - slot going DOWN from circle
  vertices.push(cx - slotWidth, slotTopY, zPos);      // top left (connects to circle)
  vertices.push(cx + slotWidth, slotTopY, zPos);      // top right
  vertices.push(cx + slotWidth, slotBottomY, zPos);   // bottom right
  vertices.push(cx - slotWidth, slotBottomY, zPos);   // bottom left
  
  // Slot back vertices
  vertices.push(cx - slotWidth, slotTopY, zPos - depth);
  vertices.push(cx + slotWidth, slotTopY, zPos - depth);
  vertices.push(cx + slotWidth, slotBottomY, zPos - depth);
  vertices.push(cx - slotWidth, slotBottomY, zPos - depth);
  
  // Slot walls (left, right, bottom)
  // Left wall
  indices.push(slotStartIdx + 0, slotStartIdx + 4, slotStartIdx + 3);
  indices.push(slotStartIdx + 3, slotStartIdx + 4, slotStartIdx + 7);
  
  // Right wall  
  indices.push(slotStartIdx + 1, slotStartIdx + 2, slotStartIdx + 5);
  indices.push(slotStartIdx + 5, slotStartIdx + 2, slotStartIdx + 6);
  
  // Bottom wall (rounded would be nice but flat for simplicity)
  indices.push(slotStartIdx + 2, slotStartIdx + 3, slotStartIdx + 6);
  indices.push(slotStartIdx + 6, slotStartIdx + 3, slotStartIdx + 7);
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
  const { height, twistAngle } = params;
  const { layerHeight } = settings;
  
  const totalLayers = Math.ceil(height / layerHeight);
  const segments = 64; // Points per revolution
  const totalPoints = totalLayers * segments;
  
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
    const finalZ = baseZ + rimOffset;
    
    spiralPath.push({
      x: Math.cos(theta + twistRad) * outerR,
      y: Math.sin(theta + twistRad) * outerR,
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
  
  const { height, wallThickness, twistAngle, profileCurve } = params;
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
  
  // Generate planar layers up to the non-planar zone
  for (let layer = 0; layer < planarLayerCount; layer++) {
    const baseZ = layer * layerHeight;
    const t = baseZ / height;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
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
          x: Math.cos(thetaWithTwist) * outerR,
          y: Math.sin(thetaWithTwist) * outerR,
          z: pointZ,
        });
        
        innerPath.push({
          x: Math.cos(thetaWithTwist) * innerR,
          y: Math.sin(thetaWithTwist) * innerR,
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
          x: Math.cos(thetaWithTwist) * outerR,
          y: Math.sin(thetaWithTwist) * outerR,
        });
        
        innerPath.push({
          x: Math.cos(thetaWithTwist) * innerR,
          y: Math.sin(thetaWithTwist) * innerR,
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

// Generate actual G-code string
export function generateGCode(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): string {
  const layers = generateGCodeLayers(params, type, settings);
  const { printSpeed, layerHeight, material } = settings;
  const isSpiralVase = settings.spiralVase || settings.printMode === 'vase_spiral';
  const isNonPlanar = settings.printMode === 'non_planar';
  
  const lines: string[] = [];
  
  // G-code header
  lines.push('; Generated by Parametric 3D Generator');
  lines.push(`; Object Type: ${type}`);
  lines.push(`; Height: ${params.height}mm`);
  lines.push(`; Material: ${material}`);
  lines.push(`; Layer Height: ${layerHeight}mm`);
  lines.push(`; Print Mode: ${settings.printMode}`);
  if (isSpiralVase) {
    lines.push('; Mode: Spiral Vase (continuous Z movement)');
  }
  if (isNonPlanar) {
    lines.push(`; Non-Planar: Max Z Angle ${settings.nonPlanar.maxZAngle}°`);
    lines.push('; Note: Requires non-planar capable slicer/printer');
  }
  lines.push(`; Layers: ${isSpiralVase ? 'Continuous spiral' : layers.length}`);
  lines.push('');
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
  
  lines.push(`M140 S${temp.bed} ; Set bed temperature`);
  lines.push(`M104 S${temp.nozzle} ; Set nozzle temperature`);
  lines.push(`M190 S${temp.bed} ; Wait for bed`);
  lines.push(`M109 S${temp.nozzle} ; Wait for nozzle`);
  lines.push('');
  
  // Print layers
  let e = 0; // Extrusion distance
  const filamentDiameter = 1.75;
  const nozzleDiameter = settings.nozzleDiameter;
  const extrusionMultiplier = (layerHeight * nozzleDiameter) / (Math.PI * Math.pow(filamentDiameter / 2, 2));
  
  if (isSpiralVase && layers.length > 0 && layers[0].paths.length > 0) {
    // Spiral vase mode - continuous Z movement
    lines.push('; Spiral Vase Mode - Continuous extrusion');
    const spiralPath = layers[0].paths[0];
    
    if (spiralPath.length > 0) {
      const firstPoint = spiralPath[0];
      lines.push(`G0 X${firstPoint.x.toFixed(3)} Y${firstPoint.y.toFixed(3)} Z${(firstPoint.z || 0).toFixed(3)} F3000`);
      
      for (let i = 1; i < spiralPath.length; i++) {
        const point = spiralPath[i];
        const prevPoint = spiralPath[i - 1];
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const dz = (point.z || 0) - (prevPoint.z || 0);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        e += dist * extrusionMultiplier;
        
        lines.push(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} Z${(point.z || 0).toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
      }
    }
  } else {
    // Standard layer-by-layer printing (with non-planar support)
    layers.forEach((layer, layerIndex) => {
      const isLayerNonPlanar = layer.isNonPlanar;
      
      if (isLayerNonPlanar) {
        lines.push(`; Layer ${layerIndex + 1} / ${layers.length} [NON-PLANAR]`);
        lines.push(`; Warning: Z varies along path - requires non-planar capable printer`);
      } else {
        lines.push(`; Layer ${layerIndex + 1} / ${layers.length}`);
        lines.push(`G1 Z${layer.z.toFixed(3)} F1000`);
      }
      
      layer.paths.forEach((path, pathIndex) => {
        if (path.length < 2) return;
        
        // Move to start - include Z for non-planar
        const startZ = path[0].z !== undefined ? path[0].z : layer.z;
        if (isLayerNonPlanar) {
          lines.push(`G0 X${path[0].x.toFixed(3)} Y${path[0].y.toFixed(3)} Z${startZ.toFixed(3)} F3000`);
        } else {
          lines.push(`G0 X${path[0].x.toFixed(3)} Y${path[0].y.toFixed(3)} F3000`);
        }
        
        // Extrude along path
        for (let i = 1; i < path.length; i++) {
          const dx = path[i].x - path[i - 1].x;
          const dy = path[i].y - path[i - 1].y;
          
          // For non-planar, calculate 3D distance including Z delta
          const z1 = path[i - 1].z !== undefined ? path[i - 1].z : layer.z;
          const z2 = path[i].z !== undefined ? path[i].z : layer.z;
          const dz = z2 - z1;
          
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          e += dist * extrusionMultiplier;
          
          if (isLayerNonPlanar) {
            // Include Z coordinate for non-planar moves
            lines.push(`G1 X${path[i].x.toFixed(3)} Y${path[i].y.toFixed(3)} Z${z2.toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
          } else {
            lines.push(`G1 X${path[i].x.toFixed(3)} Y${path[i].y.toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
          }
        }
      });
    });
  }
  
  // G-code footer
  lines.push('');
  lines.push('; End G-code');
  lines.push('G1 E-2 F2400 ; Retract');
  lines.push(`G1 Z${params.height + 10} F3000 ; Lift nozzle`);
  lines.push('G28 X Y ; Home X and Y');
  lines.push('M104 S0 ; Turn off nozzle');
  lines.push('M140 S0 ; Turn off bed');
  lines.push('M84 ; Disable motors');
  
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
