/**
 * Wireframe Lamp Generator
 * 
 * Generates structural rib/ring geometry for lampshade frames.
 * The output is a skeleton of tubes (vertical ribs + horizontal rings)
 * designed to be covered with paper, fabric, or other translucent materials.
 */

import * as THREE from 'three';
import { ParametricParams } from '@/types/parametric';
import { getBodyRadius } from '@/lib/body-profile-generator';
import { sampleSpine, SpinePoint } from '@/lib/spine-generator';
import { seedNoise, noise2D, fbm2D } from '@/lib/plotter/noise';

interface WireframeOptions {
  /** Scale factor (0.01 for preview scene units, 1 for mm STL export) */
  scale: number;
}

/**
 * Reshape a TubeGeometry's circular cross-section into square or flat profiles.
 * Works by remapping each ring of vertices from circular to the target shape.
 */
function reshapeTubeCrossSection(
  geo: THREE.TubeGeometry,
  type: 'square' | 'flat',
  tubularSegments: number
): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const vertCount = pos.count;
  const ringSize = tubularSegments + 1; // vertices per ring
  const ringCount = Math.floor(vertCount / ringSize);

  // We need the tube's internal frames to know local directions.
  // Reconstruct by averaging ring centers and computing local axes.
  for (let ring = 0; ring < ringCount; ring++) {
    const startIdx = ring * ringSize;
    
    // Compute ring center
    const center = new THREE.Vector3(0, 0, 0);
    for (let j = 0; j < ringSize; j++) {
      center.x += pos.getX(startIdx + j);
      center.y += pos.getY(startIdx + j);
      center.z += pos.getZ(startIdx + j);
    }
    center.divideScalar(ringSize);
    
    // For each vertex, get its angle and radius relative to center
    // Then remap to the target shape
    const localVecs: THREE.Vector3[] = [];
    let avgRadius = 0;
    
    for (let j = 0; j < ringSize; j++) {
      const v = new THREE.Vector3(
        pos.getX(startIdx + j) - center.x,
        pos.getY(startIdx + j) - center.y,
        pos.getZ(startIdx + j) - center.z
      );
      avgRadius += v.length();
      localVecs.push(v);
    }
    avgRadius /= ringSize;
    if (avgRadius < 1e-10) continue;

    // Build local 2D basis from first two perpendicular directions
    const basisU = localVecs[0].clone().normalize();
    // Find a vertex roughly 90° away
    const quarterIdx = Math.floor(ringSize / 4);
    const basisV = localVecs[quarterIdx].clone();
    // Orthogonalize V against U
    basisV.sub(basisU.clone().multiplyScalar(basisV.dot(basisU))).normalize();

    for (let j = 0; j < ringSize; j++) {
      const v = localVecs[j];
      // Project onto local 2D
      const u2d = v.dot(basisU);
      const v2d = v.dot(basisV);
      const angle = Math.atan2(v2d, u2d);
      
      let newU: number, newV: number;
      
      if (type === 'square') {
        // Map circle to square: for angle θ, square boundary is at
        // max(|cos θ|, |sin θ|) = 1 → scale = 1/max(|cos|,|sin|)
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const maxCS = Math.max(Math.abs(cosA), Math.abs(sinA));
        const scale = avgRadius / maxCS;
        newU = cosA * scale;
        newV = sinA * scale;
      } else {
        // Flat: wider in U, shorter in V
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const widthScale = 1.5;
        const heightScale = 0.6;
        // Elliptical mapping
        newU = cosA * avgRadius * widthScale;
        newV = sinA * avgRadius * heightScale;
      }
      
      const newPos = center.clone()
        .add(basisU.clone().multiplyScalar(newU))
        .add(basisV.clone().multiplyScalar(newV));
      
      pos.setXYZ(startIdx + j, newPos.x, newPos.y, newPos.z);
    }
  }
  
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * Create a tube geometry along a curve with the specified cross-section.
 */
function createTubeAlongCurve(
  curve: THREE.CatmullRomCurve3,
  tubeRadius: number,
  crossSection: 'round' | 'square' | 'flat',
  pathSegments: number,
  tubularSegments: number,
  closed: boolean = false
): THREE.BufferGeometry {
  const tube = new THREE.TubeGeometry(curve, pathSegments, tubeRadius, tubularSegments, closed);
  
  if (crossSection !== 'round') {
    reshapeTubeCrossSection(tube, crossSection, tubularSegments);
  }
  
  return tube;
}

/**
 * Create tube segments with variable thickness along a curve.
 * Splits the curve into sub-segments, each with a noise-varied radius.
 */
function createVariableThicknessTube(
  points: THREE.Vector3[],
  baseRadius: number,
  crossSection: 'round' | 'square' | 'flat',
  tubularSegments: number,
  closed: boolean,
  thicknessVariation: number,
  noiseOffsetX: number,
  noiseOffsetY: number
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const segCount = 6; // number of sub-segments
  const totalPoints = points.length;
  
  for (let seg = 0; seg < segCount; seg++) {
    const startIdx = Math.floor((seg / segCount) * (totalPoints - 1));
    const endIdx = Math.min(Math.floor(((seg + 1) / segCount) * (totalPoints - 1)) + 1, totalPoints);
    
    if (endIdx - startIdx < 2) continue;
    
    const subPoints = points.slice(startIdx, endIdx);
    const t = (seg + 0.5) / segCount;
    const noiseVal = noise2D(noiseOffsetX + t * 3, noiseOffsetY);
    const radiusMultiplier = 1 + noiseVal * thicknessVariation * 0.6;
    const segRadius = baseRadius * Math.max(0.4, radiusMultiplier);
    
    const curve = new THREE.CatmullRomCurve3(subPoints, false);
    const pathSegs = Math.max(4, Math.floor((endIdx - startIdx) * 1.5));
    geometries.push(createTubeAlongCurve(curve, segRadius, crossSection, pathSegs, tubularSegments, false));
  }
  
  return geometries;
}

/**
 * Generate the complete wireframe lamp geometry (ribs + rings + bracing + joints).
 */
export function generateWireframeLampGeometry(
  params: ParametricParams,
  options: WireframeOptions
): THREE.BufferGeometry {
  const { scale } = options;
  const {
    height,
    wireframeRibCount,
    wireframeRingCount,
    wireframeThickness,
    wireframeRibStyle,
    wireframeMountRingHeight,
    wireframeCrossSection = 'round',
    wireframeJointBulge = 0.5,
    wireframeFlatBase = true,
    wireframeRingThickness = 1.0,
    wireframeDiagonalBracing = false,
    wireframeBraceFrequency = 1,
    wireframeOrganic = 0,
    wireframeOrganicSeed = 42,
    wireframeThicknessVariation = 0,
    twistAngle,
  } = params;

  const h = height * scale;
  const tubeRadius = (wireframeThickness / 2) * scale;
  const mountTubeRadius = tubeRadius * 1.5;
  const ringTubeRadius = tubeRadius * wireframeRingThickness;
  const tubularSegments = 8;

  const geometries: THREE.BufferGeometry[] = [];

  // Seed noise for organic deformation
  seedNoise(wireframeOrganicSeed);

  // Determine if using spine
  const useSpine = params.spineEnabled &&
    ((params.spineAmplitudeX || 0) > 0 || (params.spineAmplitudeZ || 0) > 0);

  const spineParams = {
    spineEnabled: params.spineEnabled || false,
    spineAmplitudeX: (params.spineAmplitudeX || 0) * scale,
    spineFrequencyX: params.spineFrequencyX || 2,
    spinePhaseX: params.spinePhaseX || 0,
    spineAmplitudeZ: (params.spineAmplitudeZ || 0) * scale,
    spineFrequencyZ: params.spineFrequencyZ || 2,
    spinePhaseZ: params.spinePhaseZ || 0.25,
  };

  const heightSamples = 40;
  const spineFrames: SpinePoint[] = useSpine
    ? sampleSpine(heightSamples, h, spineParams)
    : [];

  // Helper: get 3D position on the body surface at (t, theta)
  const getSurfacePoint = (t: number, theta: number): THREE.Vector3 => {
    const r = getBodyRadius(params, t, theta, {
      scale,
      includeTwist: true,
      objectType: 'vase',
    });

    const twistRad = (twistAngle * Math.PI / 180) * t;
    const thetaWithTwist = theta + twistRad;

    const localX = Math.cos(thetaWithTwist) * r;
    const localZ = Math.sin(thetaWithTwist) * r;

    if (useSpine) {
      const frameIdx = Math.round(t * heightSamples);
      const frame = spineFrames[Math.min(frameIdx, spineFrames.length - 1)];
      return new THREE.Vector3(
        localX + frame.position.x,
        frame.position.y,
        localZ + frame.position.z
      );
    }

    return new THREE.Vector3(localX, t * h, localZ);
  };

  // Organic displacement helper
  const organicDisplace = (point: THREE.Vector3, noiseX: number, noiseY: number, magnitude: number): THREE.Vector3 => {
    if (wireframeOrganic <= 0) return point;
    
    const dx = fbm2D(noiseX * 2.5, noiseY * 2.5, 3) * magnitude * wireframeOrganic;
    const dy = fbm2D(noiseX * 2.5 + 100, noiseY * 2.5 + 100, 3) * magnitude * wireframeOrganic * 0.3;
    const dz = fbm2D(noiseX * 2.5 + 200, noiseY * 2.5 + 200, 3) * magnitude * wireframeOrganic;
    
    return new THREE.Vector3(point.x + dx, point.y + dy, point.z + dz);
  };

  // Collect ring t-values for joint detection
  const ringTValues: number[] = [];
  const totalRings = wireframeRingCount + 2;
  for (let j = 0; j < totalRings; j++) {
    let t: number;
    if (j === 0) t = 0;
    else if (j === totalRings - 1) t = 1;
    else t = j / (totalRings - 1);
    
    // Organic ring height jitter
    if (wireframeOrganic > 0 && j > 0 && j < totalRings - 1) {
      const jitter = noise2D(j * 7.3, wireframeOrganicSeed * 0.1) * wireframeOrganic * 0.05;
      t = Math.max(0.05, Math.min(0.95, t + jitter));
    }
    ringTValues.push(t);
  }

  // --- VERTICAL RIBS ---
  const ribSteps = 30;
  const organicMagnitude = tubeRadius * 3;
  
  for (let i = 0; i < wireframeRibCount; i++) {
    const baseTheta = (i / wireframeRibCount) * Math.PI * 2;
    const ribPoints: THREE.Vector3[] = [];

    for (let s = 0; s <= ribSteps; s++) {
      const t = s / ribSteps;
      let theta = baseTheta;

      if (wireframeRibStyle === 'twisted') {
        theta += t * Math.PI * 0.5;
      } else if (wireframeRibStyle === 'curved') {
        theta += Math.sin(t * Math.PI) * 0.1;
      }

      let pt = getSurfacePoint(t, theta);
      pt = organicDisplace(pt, i * 3.7, t * 5, organicMagnitude);
      ribPoints.push(pt);
    }

    if (wireframeThicknessVariation > 0) {
      const varGeos = createVariableThicknessTube(
        ribPoints, tubeRadius, wireframeCrossSection, tubularSegments, false,
        wireframeThicknessVariation, i * 5.1, wireframeOrganicSeed * 0.3
      );
      geometries.push(...varGeos);
    } else {
      const curve = new THREE.CatmullRomCurve3(ribPoints);
      geometries.push(createTubeAlongCurve(curve, tubeRadius, wireframeCrossSection, ribSteps, tubularSegments, false));
    }
  }

  // --- JOINT REINFORCEMENT ---
  if (wireframeJointBulge > 0) {
    const jointRadius = tubeRadius * (1 + wireframeJointBulge);
    for (const ringT of ringTValues) {
      for (let i = 0; i < wireframeRibCount; i++) {
        const baseTheta = (i / wireframeRibCount) * Math.PI * 2;
        let theta = baseTheta;
        if (wireframeRibStyle === 'twisted') {
          theta += ringT * Math.PI * 0.5;
        } else if (wireframeRibStyle === 'curved') {
          theta += Math.sin(ringT * Math.PI) * 0.1;
        }

        let pos = getSurfacePoint(ringT, theta);
        pos = organicDisplace(pos, i * 3.7, ringT * 5, organicMagnitude);
        const sphereGeo = new THREE.SphereGeometry(jointRadius, 6, 6);
        sphereGeo.translate(pos.x, pos.y, pos.z);
        geometries.push(sphereGeo);
      }
    }
  }

  // --- HORIZONTAL RINGS ---
  const angleSegments = 48;

  for (let j = 0; j < totalRings; j++) {
    const t = ringTValues[j];
    const isMountRing = j === 0 || j === totalRings - 1;
    const currentRingRadius = isMountRing ? mountTubeRadius : ringTubeRadius;

    const ringPoints: THREE.Vector3[] = [];
    for (let a = 0; a <= angleSegments; a++) {
      const theta = (a / angleSegments) * Math.PI * 2;
      let pt = getSurfacePoint(t, theta);
      // Organic displacement on rings (radial wobble)
      pt = organicDisplace(pt, j * 11.3 + a * 0.2, t * 8 + 50, organicMagnitude * 0.7);
      ringPoints.push(pt);
    }

    // Flat base
    if (wireframeFlatBase && j === 0) {
      let minY = Infinity;
      for (const p of ringPoints) { if (p.y < minY) minY = p.y; }
      for (const p of ringPoints) { p.y = minY; }
    }

    if (wireframeThicknessVariation > 0 && !isMountRing) {
      const varGeos = createVariableThicknessTube(
        ringPoints, currentRingRadius, wireframeCrossSection, tubularSegments, true,
        wireframeThicknessVariation, j * 13.7, wireframeOrganicSeed * 0.7 + 50
      );
      geometries.push(...varGeos);
    } else {
      const curve = new THREE.CatmullRomCurve3(ringPoints, true);
      const ringCrossSection = (wireframeFlatBase && j === 0) ? 'flat' : wireframeCrossSection;
      geometries.push(createTubeAlongCurve(curve, currentRingRadius, ringCrossSection, angleSegments, tubularSegments, true));
    }

    // Mount ring reinforcement
    if (isMountRing && mountTubeRadius > 0) {
      const mountH = wireframeMountRingHeight * scale;
      const offsetT = t === 0 ? mountH / h : t - mountH / h;
      if (offsetT >= 0 && offsetT <= 1) {
        const mountPoints: THREE.Vector3[] = [];
        for (let a = 0; a <= angleSegments; a++) {
          const theta = (a / angleSegments) * Math.PI * 2;
          mountPoints.push(getSurfacePoint(Math.max(0, Math.min(1, offsetT)), theta));
        }
        const mountCurve = new THREE.CatmullRomCurve3(mountPoints, true);
        geometries.push(createTubeAlongCurve(mountCurve, currentRingRadius * 0.8, wireframeCrossSection, angleSegments, tubularSegments, true));
      }
    }
  }

  // --- DIAGONAL BRACING ---
  if (wireframeDiagonalBracing) {
    const braceRadius = tubeRadius * 0.7;
    
    for (let section = 0; section < totalRings - 1; section++) {
      const tBottom = ringTValues[section];
      const tTop = ringTValues[section + 1];
      
      for (let freq = 0; freq < wireframeBraceFrequency; freq++) {
        const subT0 = tBottom + (freq / wireframeBraceFrequency) * (tTop - tBottom);
        const subT1 = tBottom + ((freq + 1) / wireframeBraceFrequency) * (tTop - tBottom);
        
        for (let i = 0; i < wireframeRibCount; i++) {
          const theta0 = (i / wireframeRibCount) * Math.PI * 2;
          const theta1 = ((i + 1) / wireframeRibCount) * Math.PI * 2;
          
          const bracePoints1 = [
            getSurfacePoint(subT0, theta0),
            getSurfacePoint(subT1, theta1),
          ];
          const bracePoints2 = [
            getSurfacePoint(subT0, theta1),
            getSurfacePoint(subT1, theta0),
          ];
          
          const bCurve1 = new THREE.CatmullRomCurve3(bracePoints1);
          const bCurve2 = new THREE.CatmullRomCurve3(bracePoints2);
          
          geometries.push(createTubeAlongCurve(bCurve1, braceRadius, wireframeCrossSection, 8, tubularSegments, false));
          geometries.push(createTubeAlongCurve(bCurve2, braceRadius, wireframeCrossSection, 8, tubularSegments, false));
        }
      }
    }
  }

  // Merge all geometries
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }

  const merged = mergeBufferGeometries(geometries);
  geometries.forEach(g => g.dispose());

  return merged;
}

/**
 * Simple geometry merger
 */
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVertices = 0;
  let totalIndices = 0;

  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    totalVertices += pos.count;
    const idx = geo.getIndex();
    totalIndices += idx ? idx.count : 0;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const geo of geometries) {
    geo.computeVertexNormals();
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const norm = geo.getAttribute('normal') as THREE.BufferAttribute;
    const idx = geo.getIndex();

    for (let i = 0; i < pos.count * 3; i++) {
      positions[vertexOffset * 3 + i] = (pos.array as Float32Array)[i];
    }

    if (norm) {
      for (let i = 0; i < norm.count * 3; i++) {
        normals[vertexOffset * 3 + i] = (norm.array as Float32Array)[i];
      }
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices[indexOffset + i] = (idx.array as Uint32Array | Uint16Array)[i] + vertexOffset;
      }
      indexOffset += idx.count;
    }

    vertexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (totalIndices > 0) {
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  return merged;
}
