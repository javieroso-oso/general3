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
 * Generate the complete wireframe lamp geometry (ribs + rings).
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
    twistAngle,
  } = params;

  const h = height * scale;
  const tubeRadius = (wireframeThickness / 2) * scale;
  const mountTubeRadius = tubeRadius * 1.5; // Mounting rings are thicker
  const tubularSegments = 8; // Cross-section resolution for tubes

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

  const heightSamples = 40; // Resolution for sampling the profile
  const spineFrames: SpinePoint[] = useSpine
    ? sampleSpine(heightSamples, h, spineParams)
    : [];

  // Helper: get 3D position on the body surface at (t, theta)
  const getSurfacePoint = (t: number, theta: number): THREE.Vector3 => {
    const r = getBodyRadius(params, t, theta, {
      scale,
      includeTwist: true,
      objectType: params.shapeStyle,
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

  // --- VERTICAL RIBS ---
  for (let i = 0; i < wireframeRibCount; i++) {
    const baseTheta = (i / wireframeRibCount) * Math.PI * 2;
    const ribPoints: THREE.Vector3[] = [];
    const steps = 30;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      let theta = baseTheta;

      // Rib style variations
      if (wireframeRibStyle === 'twisted') {
        // Add extra twist to ribs themselves
        theta += t * Math.PI * 0.5;
      } else if (wireframeRibStyle === 'curved') {
        // Subtle sinusoidal sway
        theta += Math.sin(t * Math.PI) * 0.1;
      }
      // 'straight' uses baseTheta directly

      ribPoints.push(getSurfacePoint(t, theta));
    }

    const curve = new THREE.CatmullRomCurve3(ribPoints);
    const tubeGeo = new THREE.TubeGeometry(curve, steps, tubeRadius, tubularSegments, false);
    geometries.push(tubeGeo);
  }

  // --- HORIZONTAL RINGS ---
  const totalRings = wireframeRingCount + 2; // +2 for top and bottom mount rings
  const angleSegments = 48;

  for (let j = 0; j < totalRings; j++) {
    let t: number;
    let isMountRing: boolean;
    let ringTubeRadius: number;

    if (j === 0) {
      // Bottom mount ring
      t = 0;
      isMountRing = true;
      ringTubeRadius = mountTubeRadius;
    } else if (j === totalRings - 1) {
      // Top mount ring
      t = 1;
      isMountRing = true;
      ringTubeRadius = mountTubeRadius;
    } else {
      // Interior ring
      t = j / (totalRings - 1);
      isMountRing = false;
      ringTubeRadius = tubeRadius;
    }

    const ringPoints: THREE.Vector3[] = [];
    for (let a = 0; a <= angleSegments; a++) {
      const theta = (a / angleSegments) * Math.PI * 2;
      ringPoints.push(getSurfacePoint(t, theta));
    }

    const curve = new THREE.CatmullRomCurve3(ringPoints, true); // closed
    const tubeGeo = new THREE.TubeGeometry(curve, angleSegments, ringTubeRadius, tubularSegments, true);
    geometries.push(tubeGeo);

    // For mount rings, add extra height (a thicker torus effect via second ring)
    if (isMountRing && mountTubeRadius > 0) {
      const mountH = wireframeMountRingHeight * scale;
      // Add a second ring slightly offset in Y to make mount ring more substantial
      const offsetT = t === 0 ? mountH / h : t - mountH / h;
      if (offsetT >= 0 && offsetT <= 1) {
        const mountPoints: THREE.Vector3[] = [];
        for (let a = 0; a <= angleSegments; a++) {
          const theta = (a / angleSegments) * Math.PI * 2;
          mountPoints.push(getSurfacePoint(Math.max(0, Math.min(1, offsetT)), theta));
        }
        const mountCurve = new THREE.CatmullRomCurve3(mountPoints, true);
        const mountGeo = new THREE.TubeGeometry(mountCurve, angleSegments, ringTubeRadius * 0.8, tubularSegments, true);
        geometries.push(mountGeo);
      }
    }
  }

  // Merge all geometries
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }

  // Use mergeGeometries from three
  const merged = mergeBufferGeometries(geometries);
  
  // Dispose individual geometries
  geometries.forEach(g => g.dispose());

  return merged;
}

/**
 * Simple geometry merger (avoids import issues with BufferGeometryUtils)
 */
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVertices = 0;
  let totalIndices = 0;

  // Count totals
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

    // Copy positions
    for (let i = 0; i < pos.count * 3; i++) {
      positions[vertexOffset * 3 + i] = (pos.array as Float32Array)[i];
    }

    // Copy normals
    if (norm) {
      for (let i = 0; i < norm.count * 3; i++) {
        normals[vertexOffset * 3 + i] = (norm.array as Float32Array)[i];
      }
    }

    // Copy indices with offset
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
