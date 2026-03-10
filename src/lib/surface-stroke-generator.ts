/**
 * Surface Stroke Geometry Generator
 * 
 * Converts 2D UV strokes into 3D geometry (tubes, grooves, ribbons)
 * projected onto the parametric body surface.
 */

import * as THREE from 'three';
import { ParametricParams, SurfaceStroke } from '@/types/parametric';
import { getBodyRadius } from '@/lib/body-profile-generator';

const SCALE = 0.01;

interface StrokePoint3D {
  position: THREE.Vector3;
  normal: THREE.Vector3; // outward surface normal
  tangent: THREE.Vector3; // along stroke path
}

/**
 * Convert a UV point to a 3D position on the body surface.
 */
function uvTo3D(
  params: ParametricParams,
  u: number,
  v: number,
): { position: THREE.Vector3; normal: THREE.Vector3 } {
  const theta = u * Math.PI * 2;
  const t = v;
  const h = params.height * SCALE;

  const r = getBodyRadius(params, t, theta, {
    scale: SCALE,
    includeTwist: true,
    objectType: 'vase',
  });

  const x = Math.cos(theta) * r;
  const z = Math.sin(theta) * r;
  const y = t * h;

  // Compute surface normal via finite differences
  const dt = 0.001;
  const dTheta = 0.001;

  const r_dt = getBodyRadius(params, Math.min(t + dt, 1), theta, { scale: SCALE, includeTwist: true });
  const r_dTheta = getBodyRadius(params, t, theta + dTheta, { scale: SCALE, includeTwist: true });

  const p = new THREE.Vector3(x, y, z);

  // Tangent along height
  const p_dt = new THREE.Vector3(
    Math.cos(theta) * r_dt,
    Math.min(t + dt, 1) * h,
    Math.sin(theta) * r_dt,
  );

  // Tangent along angle
  const p_dTheta = new THREE.Vector3(
    Math.cos(theta + dTheta) * r_dTheta,
    y,
    Math.sin(theta + dTheta) * r_dTheta,
  );

  const dP_dt = p_dt.clone().sub(p);
  const dP_dTheta = p_dTheta.clone().sub(p);
  const normal = new THREE.Vector3().crossVectors(dP_dTheta, dP_dt).normalize();

  // Ensure outward pointing
  const radialDir = new THREE.Vector3(x, 0, z).normalize();
  if (normal.dot(radialDir) < 0) normal.negate();

  return { position: p, normal };
}

/**
 * Resample stroke points to be evenly spaced in UV.
 */
function resampleStroke(points: { u: number; v: number }[], count: number): { u: number; v: number }[] {
  if (points.length < 2) return points;

  // Calculate cumulative distances
  const distances: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const du = points[i].u - points[i - 1].u;
    const dv = points[i].v - points[i - 1].v;
    distances.push(distances[i - 1] + Math.sqrt(du * du + dv * dv));
  }

  const totalLength = distances[distances.length - 1];
  if (totalLength === 0) return [points[0]];

  const resampled: { u: number; v: number }[] = [];
  for (let i = 0; i < count; i++) {
    const targetDist = (i / (count - 1)) * totalLength;

    // Find segment
    let segIdx = 0;
    for (let j = 1; j < distances.length; j++) {
      if (distances[j] >= targetDist) {
        segIdx = j - 1;
        break;
      }
    }

    const segLen = distances[segIdx + 1] - distances[segIdx];
    const localT = segLen > 0 ? (targetDist - distances[segIdx]) / segLen : 0;

    resampled.push({
      u: points[segIdx].u + (points[segIdx + 1].u - points[segIdx].u) * localT,
      v: points[segIdx].v + (points[segIdx + 1].v - points[segIdx].v) * localT,
    });
  }

  return resampled;
}

/**
 * Generate a swept tube/ribbon geometry along a stroke path on the surface.
 */
function generateStrokeGeometry(
  stroke: SurfaceStroke,
  params: ParametricParams,
): THREE.BufferGeometry | null {
  if (stroke.points.length < 2) return null;

  const sampleCount = Math.max(stroke.points.length, 24);
  const resampled = resampleStroke(stroke.points, sampleCount);

  // Convert to 3D points with normals
  const points3D: StrokePoint3D[] = [];
  for (let i = 0; i < resampled.length; i++) {
    const { position, normal } = uvTo3D(params, resampled[i].u, resampled[i].v);
    points3D.push({ position, normal, tangent: new THREE.Vector3() });
  }

  // Compute tangents
  for (let i = 0; i < points3D.length; i++) {
    if (i === 0) {
      points3D[i].tangent = points3D[1].position.clone().sub(points3D[0].position).normalize();
    } else if (i === points3D.length - 1) {
      points3D[i].tangent = points3D[i].position.clone().sub(points3D[i - 1].position).normalize();
    } else {
      points3D[i].tangent = points3D[i + 1].position.clone().sub(points3D[i - 1].position).normalize();
    }
  }

  const depth = stroke.depth * SCALE;
  const thickness = stroke.thickness * SCALE;
  const isEngraved = stroke.effect === 'engraved';
  const isRibbon = stroke.effect === 'ribbon';

  // Cross-section segments
  const crossSegments = isRibbon ? 4 : 8;

  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < points3D.length; i++) {
    const { position, normal: surfaceNormal, tangent } = points3D[i];

    // Offset position along surface normal
    const offset = isEngraved ? -depth : depth;
    const center = position.clone().addScaledVector(surfaceNormal, offset * 0.5);

    // Build local frame
    const binormal = new THREE.Vector3().crossVectors(tangent, surfaceNormal).normalize();
    const localNormal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    for (let j = 0; j <= crossSegments; j++) {
      const t = j / crossSegments;

      let localX: number, localY: number, vertNormal: THREE.Vector3;

      if (isRibbon) {
        // Flat ribbon: rectangular cross-section
        const halfW = thickness * 0.5;
        const halfH = depth * 0.25;
        if (j <= 1) {
          localX = -halfW + t * 2 * halfW;
          localY = halfH;
        } else if (j <= 2) {
          localX = halfW;
          localY = halfH - (t - 0.5) * 4 * halfH;
        } else {
          localX = halfW - (t - 0.75) * 4 * halfW;
          localY = -halfH;
        }
        vertNormal = localNormal.clone();
      } else {
        // Circular cross-section (tube)
        const angle = t * Math.PI * 2;
        const halfSize = thickness * 0.5;
        localX = Math.cos(angle) * halfSize;
        localY = Math.sin(angle) * halfSize;
        vertNormal = new THREE.Vector3()
          .addScaledVector(binormal, Math.cos(angle))
          .addScaledVector(localNormal, Math.sin(angle))
          .normalize();
      }

      const vertex = center.clone()
        .addScaledVector(binormal, localX)
        .addScaledVector(localNormal, localY);

      vertices.push(vertex.x, vertex.y, vertex.z);
      normals.push(vertNormal.x, vertNormal.y, vertNormal.z);
    }

    // Build faces
    if (i < points3D.length - 1) {
      const ringVerts = crossSegments + 1;
      const baseIdx = i * ringVerts;
      const nextIdx = (i + 1) * ringVerts;

      for (let j = 0; j < crossSegments; j++) {
        const a = baseIdx + j;
        const b = baseIdx + j + 1;
        const c = nextIdx + j + 1;
        const d = nextIdx + j;

        indices.push(a, b, c);
        indices.push(a, c, d);
      }
    }
  }

  // Cap ends
  const ringVerts = crossSegments + 1;
  // Start cap
  const startCenter = vertices.length / 3;
  const sc = points3D[0].position.clone().addScaledVector(
    points3D[0].normal,
    (isEngraved ? -depth : depth) * 0.5,
  );
  vertices.push(sc.x, sc.y, sc.z);
  const startNorm = points3D[0].tangent.clone().negate();
  normals.push(startNorm.x, startNorm.y, startNorm.z);
  for (let j = 0; j < crossSegments; j++) {
    indices.push(startCenter, j + 1, j);
  }

  // End cap
  const endCenter = vertices.length / 3;
  const lastIdx = points3D.length - 1;
  const ec = points3D[lastIdx].position.clone().addScaledVector(
    points3D[lastIdx].normal,
    (isEngraved ? -depth : depth) * 0.5,
  );
  vertices.push(ec.x, ec.y, ec.z);
  const endNorm = points3D[lastIdx].tangent.clone();
  normals.push(endNorm.x, endNorm.y, endNorm.z);
  const endBase = lastIdx * ringVerts;
  for (let j = 0; j < crossSegments; j++) {
    indices.push(endCenter, endBase + j, endBase + j + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Generate all stroke geometries for the given params.
 */
export function generateSurfaceStrokeGeometries(
  params: ParametricParams,
): { geometry: THREE.BufferGeometry; effect: SurfaceStroke['effect'] }[] {
  if (!params.surfaceStrokes || params.surfaceStrokes.length === 0) return [];

  const results: { geometry: THREE.BufferGeometry; effect: SurfaceStroke['effect'] }[] = [];

  for (const stroke of params.surfaceStrokes) {
    const geo = generateStrokeGeometry(stroke, params);
    if (geo) {
      results.push({ geometry: geo, effect: stroke.effect });
    }
  }

  return results;
}
