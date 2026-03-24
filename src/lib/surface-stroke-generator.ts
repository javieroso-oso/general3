/**
 * Surface Stroke Geometry Generator
 * 
 * Converts 2D UV strokes into 3D geometry (tubes, grooves, ribbons, cuts, textures)
 * projected onto the parametric body surface.
 */

import * as THREE from 'three';
import { ParametricParams, SurfaceStroke, TexturePattern } from '@/types/parametric';
import { getBodyRadius } from '@/lib/body-profile-generator';

const SCALE = 0.01;

interface StrokePoint3D {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  tangent: THREE.Vector3;
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

  const p_dt = new THREE.Vector3(
    Math.cos(theta) * r_dt,
    Math.min(t + dt, 1) * h,
    Math.sin(theta) * r_dt,
  );

  const p_dTheta = new THREE.Vector3(
    Math.cos(theta + dTheta) * r_dTheta,
    y,
    Math.sin(theta + dTheta) * r_dTheta,
  );

  const dP_dt = p_dt.clone().sub(p);
  const dP_dTheta = p_dTheta.clone().sub(p);
  const normal = new THREE.Vector3().crossVectors(dP_dTheta, dP_dt).normalize();

  const radialDir = new THREE.Vector3(x, 0, z).normalize();
  if (normal.dot(radialDir) < 0) normal.negate();

  return { position: p, normal };
}

/**
 * Resample stroke points to be evenly spaced in UV.
 */
function resampleStroke(points: { u: number; v: number }[], count: number): { u: number; v: number }[] {
  if (points.length < 2) return points;

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
 * Convert stroke points to 3D with tangents computed.
 */
/**
 * Apply offset and scale transforms to stroke points before 3D projection.
 */
function applyStrokeTransforms(
  points: { u: number; v: number }[],
  _stroke: SurfaceStroke,
  _params: ParametricParams,
): { u: number; v: number }[] {
  // Simplified workflow: direct UV mapping only (no global/per-stroke rotate/scale offsets).
  return points.map((p) => ({
    u: Math.max(0, Math.min(1, p.u)),
    v: Math.max(0, Math.min(1, p.v)),
  }));
}

function strokeTo3D(stroke: SurfaceStroke, params: ParametricParams): StrokePoint3D[] {
  const sampleCount = Math.max(stroke.points.length, 24);
  const resampled = resampleStroke(stroke.points, sampleCount);
  const transformed = applyStrokeTransforms(resampled, stroke, params);

  const points3D: StrokePoint3D[] = [];
  for (let i = 0; i < transformed.length; i++) {
    const { position, normal } = uvTo3D(params, transformed[i].u, transformed[i].v);
    points3D.push({ position, normal, tangent: new THREE.Vector3() });
  }

  for (let i = 0; i < points3D.length; i++) {
    if (i === 0) {
      points3D[i].tangent = points3D[1].position.clone().sub(points3D[0].position).normalize();
    } else if (i === points3D.length - 1) {
      points3D[i].tangent = points3D[i].position.clone().sub(points3D[i - 1].position).normalize();
    } else {
      points3D[i].tangent = points3D[i + 1].position.clone().sub(points3D[i - 1].position).normalize();
    }
  }

  return points3D;
}

/**
 * Generate swept tube/ribbon geometry along stroke path.
 */
function generateSweptGeometry(
  points3D: StrokePoint3D[],
  thickness: number,
  depth: number,
  isEngraved: boolean,
  isRibbon: boolean,
): THREE.BufferGeometry {
  const crossSegments = isRibbon ? 4 : 8;
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const scaledDepth = depth * SCALE;
  const scaledThickness = thickness * SCALE;

  for (let i = 0; i < points3D.length; i++) {
    const { position, normal: surfaceNormal, tangent } = points3D[i];

    const offset = isEngraved ? -scaledDepth : scaledDepth;
    const center = position.clone().addScaledVector(surfaceNormal, offset * 0.5);

    const binormal = new THREE.Vector3().crossVectors(tangent, surfaceNormal).normalize();
    const localNormal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    for (let j = 0; j <= crossSegments; j++) {
      const t = j / crossSegments;
      let localX: number, localY: number, vertNormal: THREE.Vector3;

      if (isRibbon) {
        const halfW = scaledThickness * 0.5;
        const halfH = scaledDepth * 0.5;
        const profile: [number, number][] = [
          [-halfW, halfH],
          [halfW, halfH],
          [halfW, -halfH],
          [-halfW, -halfH],
          [-halfW, halfH],
        ];
        const profileIdx = Math.min(j, profile.length - 1);
        localX = profile[profileIdx][0];
        localY = profile[profileIdx][1];
        vertNormal = localNormal.clone();
      } else {
        const angle = t * Math.PI * 2;
        const halfSize = scaledThickness * 0.5;
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

  // Caps
  const ringVerts = crossSegments + 1;
  const startCenter = vertices.length / 3;
  const sc = points3D[0].position.clone().addScaledVector(
    points3D[0].normal,
    (isEngraved ? -scaledDepth : scaledDepth) * 0.5,
  );
  vertices.push(sc.x, sc.y, sc.z);
  const startNorm = points3D[0].tangent.clone().negate();
  normals.push(startNorm.x, startNorm.y, startNorm.z);
  for (let j = 0; j < crossSegments; j++) {
    indices.push(startCenter, j + 1, j);
  }

  const endCenter = vertices.length / 3;
  const lastIdx = points3D.length - 1;
  const ec = points3D[lastIdx].position.clone().addScaledVector(
    points3D[lastIdx].normal,
    (isEngraved ? -scaledDepth : scaledDepth) * 0.5,
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
 * Generate texture pattern geometry along stroke path.
 */
function generateTextureGeometry(
  points3D: StrokePoint3D[],
  thickness: number,
  depth: number,
  pattern: TexturePattern,
): THREE.BufferGeometry {
  const scaledDepth = depth * SCALE;
  const scaledThickness = thickness * SCALE;
  const spacing = scaledThickness * 2.5;

  const geometries: THREE.BufferGeometry[] = [];

  // Estimate total path length
  let totalLen = 0;
  for (let i = 1; i < points3D.length; i++) {
    totalLen += points3D[i].position.distanceTo(points3D[i - 1].position);
  }

  const instanceCount = Math.max(3, Math.floor(totalLen / spacing));

  for (let inst = 0; inst < instanceCount; inst++) {
    const pathT = inst / (instanceCount - 1);
    const targetIdx = pathT * (points3D.length - 1);
    const idx = Math.floor(targetIdx);
    const frac = targetIdx - idx;
    const pt = idx < points3D.length - 1
      ? {
          position: points3D[idx].position.clone().lerp(points3D[idx + 1].position, frac),
          normal: points3D[idx].normal.clone().lerp(points3D[idx + 1].normal, frac).normalize(),
          tangent: points3D[idx].tangent.clone().lerp(points3D[idx + 1].tangent, frac).normalize(),
        }
      : points3D[points3D.length - 1];

    const center = pt.position.clone().addScaledVector(pt.normal, scaledDepth * 0.5);

    let geo: THREE.BufferGeometry;

    if (pattern === 'dots') {
      geo = new THREE.SphereGeometry(scaledThickness * 0.4, 6, 4);
      geo.translate(center.x, center.y, center.z);
    } else if (pattern === 'crosshatch') {
      const binormal = new THREE.Vector3().crossVectors(pt.tangent, pt.normal).normalize();
      const size = scaledThickness * 0.6;
      // Two small crossed tubes
      const tube1 = new THREE.CylinderGeometry(size * 0.15, size * 0.15, size * 2, 4);
      tube1.rotateZ(Math.PI / 4);
      tube1.translate(center.x, center.y, center.z);

      const tube2 = new THREE.CylinderGeometry(size * 0.15, size * 0.15, size * 2, 4);
      tube2.rotateZ(-Math.PI / 4);
      tube2.translate(center.x, center.y, center.z);

      geo = mergeBufferGeometries([tube1, tube2]);
    } else {
      // zigzag - small triangular prism
      const size = scaledThickness * 0.5;
      geo = new THREE.ConeGeometry(size, size * 1.5, 4);
      // Orient along surface normal
      const quat = new THREE.Quaternion();
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pt.normal);
      geo.applyQuaternion(quat);
      geo.translate(center.x, center.y, center.z);
    }

    geometries.push(geo);
  }

  return mergeBufferGeometries(geometries);
}

/**
 * Simple geometry merge utility.
 */
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const idx = geo.getIndex();

    if (!pos) continue;

    for (let i = 0; i < pos.count; i++) {
      vertices.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) {
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      } else {
        normals.push(0, 1, 0);
      }
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push((idx.array as Uint16Array | Uint32Array)[i] + vertexOffset);
      }
    } else {
      // Non-indexed: create sequential indices
      for (let i = 0; i < pos.count; i++) {
        indices.push(vertexOffset + i);
      }
    }

    vertexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (indices.length > 0) merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Generate geometry for a single stroke.
 */
function generateStrokeGeometry(
  stroke: SurfaceStroke,
  params: ParametricParams,
): THREE.BufferGeometry | null {
  if (stroke.points.length < 2) return null;

  const points3D = strokeTo3D(stroke, params);
  if (points3D.length < 2) return null;

  if (stroke.effect === 'texture') {
    return generateTextureGeometry(
      points3D,
      stroke.thickness,
      stroke.depth,
      stroke.texturePattern || 'dots',
    );
  }

  // Simplified behavior for consistency: non-texture strokes become engraved grooves.
  const isEngraved = true;
  const isRibbon = true;

  return generateSweptGeometry(
    points3D,
    stroke.thickness,
    stroke.depth,
    isEngraved,
    isRibbon,
  );
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
      results.push({ geometry: geo, effect: stroke.effect === 'texture' ? 'texture' : 'engraved' });
    }
  }

  return results;
}
