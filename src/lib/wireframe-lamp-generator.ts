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

interface WireframeOptions {
  /** Scale factor (0.01 for preview scene units, 1 for mm STL export) */
  scale: number;
}

/**
 * Create a cross-section shape for extrusion along curves.
 * Returns a THREE.Shape for the given cross-section type.
 */
function createCrossSection(
  radius: number,
  type: 'round' | 'square' | 'flat',
  segments: number = 8
): THREE.Shape {
  const shape = new THREE.Shape();
  
  if (type === 'square') {
    // Square cross-section - better for printing and gluing
    const half = radius;
    shape.moveTo(-half, -half);
    shape.lineTo(half, -half);
    shape.lineTo(half, half);
    shape.lineTo(-half, half);
    shape.closePath();
  } else if (type === 'flat') {
    // Flat/rectangular cross-section - wide and thin for stability
    const width = radius * 1.5;
    const height = radius * 0.6;
    shape.moveTo(-width, -height);
    shape.lineTo(width, -height);
    shape.lineTo(width, height);
    shape.lineTo(-width, height);
    shape.closePath();
  } else {
    // Round cross-section (default)
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
  }
  
  return shape;
}

/**
 * Create a tube geometry along a curve using ExtrudeGeometry for non-round cross-sections.
 */
function createTubeAlongCurve(
  curve: THREE.CatmullRomCurve3,
  tubeRadius: number,
  crossSection: 'round' | 'square' | 'flat',
  pathSegments: number,
  tubularSegments: number,
  closed: boolean = false
): THREE.BufferGeometry {
  if (crossSection === 'round') {
    return new THREE.TubeGeometry(curve, pathSegments, tubeRadius, tubularSegments, closed);
  }
  
  // For square/flat, use ExtrudeGeometry with shape
  const shape = createCrossSection(tubeRadius, crossSection, tubularSegments);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: pathSegments,
    bevelEnabled: false,
    extrudePath: curve,
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * Generate the complete wireframe lamp geometry (ribs + rings + bracing + joints).
 * Returns a single merged BufferGeometry.
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
    twistAngle,
  } = params;

  const h = height * scale;
  const tubeRadius = (wireframeThickness / 2) * scale;
  const mountTubeRadius = tubeRadius * 1.5;
  const ringTubeRadius = tubeRadius * wireframeRingThickness;
  const tubularSegments = 8;

  const geometries: THREE.BufferGeometry[] = [];

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

  // Collect ring t-values for joint detection
  const ringTValues: number[] = [];
  const totalRings = wireframeRingCount + 2;
  for (let j = 0; j < totalRings; j++) {
    if (j === 0) ringTValues.push(0);
    else if (j === totalRings - 1) ringTValues.push(1);
    else ringTValues.push(j / (totalRings - 1));
  }

  // --- VERTICAL RIBS ---
  const ribSteps = 30;
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

      ribPoints.push(getSurfacePoint(t, theta));
    }

    const curve = new THREE.CatmullRomCurve3(ribPoints);
    const tubeGeo = createTubeAlongCurve(curve, tubeRadius, wireframeCrossSection, ribSteps, tubularSegments, false);
    geometries.push(tubeGeo);
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

        const pos = getSurfacePoint(ringT, theta);
        const sphereGeo = new THREE.SphereGeometry(jointRadius, 6, 6);
        sphereGeo.translate(pos.x, pos.y, pos.z);
        geometries.push(sphereGeo);
      }
    }
  }

  // --- HORIZONTAL RINGS ---
  const angleSegments = 48;

  for (let j = 0; j < totalRings; j++) {
    let t: number;
    let isMountRing: boolean;
    let currentRingRadius: number;

    if (j === 0) {
      t = 0;
      isMountRing = true;
      currentRingRadius = mountTubeRadius;
    } else if (j === totalRings - 1) {
      t = 1;
      isMountRing = true;
      currentRingRadius = mountTubeRadius;
    } else {
      t = j / (totalRings - 1);
      isMountRing = false;
      currentRingRadius = ringTubeRadius;
    }

    const ringPoints: THREE.Vector3[] = [];
    for (let a = 0; a <= angleSegments; a++) {
      const theta = (a / angleSegments) * Math.PI * 2;
      ringPoints.push(getSurfacePoint(t, theta));
    }

    // For flat base: flatten the bottom ring's Y to min Y for bed adhesion
    if (wireframeFlatBase && j === 0) {
      let minY = Infinity;
      for (const p of ringPoints) { if (p.y < minY) minY = p.y; }
      for (const p of ringPoints) { p.y = minY; }
    }

    const curve = new THREE.CatmullRomCurve3(ringPoints, true);
    
    // Bottom mount ring uses flat cross-section for bed adhesion
    const ringCrossSection = (wireframeFlatBase && j === 0) ? 'flat' : wireframeCrossSection;
    const tubeGeo = createTubeAlongCurve(curve, currentRingRadius, ringCrossSection, angleSegments, tubularSegments, true);
    geometries.push(tubeGeo);

    // Mount ring reinforcement (second ring offset)
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
        const mountGeo = createTubeAlongCurve(mountCurve, currentRingRadius * 0.8, wireframeCrossSection, angleSegments, tubularSegments, true);
        geometries.push(mountGeo);
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
        // Subdivide each section
        const subT0 = tBottom + (freq / wireframeBraceFrequency) * (tTop - tBottom);
        const subT1 = tBottom + ((freq + 1) / wireframeBraceFrequency) * (tTop - tBottom);
        
        for (let i = 0; i < wireframeRibCount; i++) {
          const theta0 = (i / wireframeRibCount) * Math.PI * 2;
          const theta1 = ((i + 1) / wireframeRibCount) * Math.PI * 2;
          
          // X-brace: two diagonals per panel
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
 * Simple geometry merger (avoids import issues with BufferGeometryUtils)
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
