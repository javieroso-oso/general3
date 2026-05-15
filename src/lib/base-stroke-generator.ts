/**
 * Base Stroke Generator
 *
 * Builds raised rib geometry from BaseStrokes (drawn in a top-down circular
 * view of the bottom face). Each stroke becomes a swept rounded-rectangle
 * tube sitting on the floor (y=0) of the body, scaled to the base radius.
 *
 * Strokes use coordinates in [-1..1] normalized to baseRadius.
 *
 * Output is in mm (scale=1) for STL export, or scaled (scale=0.01) for the
 * scene preview.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BaseStroke, ParametricParams } from '@/types/parametric';

interface Options {
  scale?: number;
}

function resample(points: { x: number; y: number }[], count: number): { x: number; y: number }[] {
  if (points.length < 2) return points;
  const dist: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    dist.push(dist[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const total = dist[dist.length - 1];
  if (total === 0) return [points[0]];
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * total;
    let seg = 0;
    for (let j = 1; j < dist.length; j++) {
      if (dist[j] >= target) { seg = j - 1; break; }
    }
    const segLen = dist[seg + 1] - dist[seg];
    const lt = segLen > 0 ? (target - dist[seg]) / segLen : 0;
    out.push({
      x: points[seg].x + (points[seg + 1].x - points[seg].x) * lt,
      y: points[seg].y + (points[seg + 1].y - points[seg].y) * lt,
    });
  }
  return out;
}

/**
 * Build a single rib geometry from a stroke.
 * Cross-section is a rounded rectangle: width = thickness, height = rib height.
 * Sits flush on the floor (bottom of cross-section at y = 0).
 */
function buildRibGeometry(
  stroke: BaseStroke,
  baseRadiusMm: number,
  scale: number,
): THREE.BufferGeometry | null {
  if (stroke.points.length < 2) return null;

  // Resample for smooth path
  const SAMPLE_COUNT = Math.max(stroke.points.length, 24);
  const samples = resample(stroke.points, SAMPLE_COUNT);

  // Convert normalized coords to scene-space (xz plane, y is up).
  const path: THREE.Vector3[] = samples.map((p) => new THREE.Vector3(
    p.x * baseRadiusMm * scale,
    0, // floor
    p.y * baseRadiusMm * scale,
  ));

  if (path.length < 2) return null;

  const halfW = (stroke.thickness * 0.5) * scale;
  const ribH = stroke.height * scale;

  // Build ribs as a swept rounded rectangle. We construct rings perpendicular
  // to the path tangent, with a 6-vertex profile (rounded top, flat sides
  // meeting the floor).
  // Profile vertices in local frame (binormal=u, up=v):
  //   slight rounding via 5 segments across the top half-circle approximation.
  const PROFILE_SEGS = 8;
  const profile: { u: number; v: number; nu: number; nv: number }[] = [];
  // Bottom-right corner at floor:
  profile.push({ u: halfW, v: 0, nu: 1, nv: 0 });
  // Arc over the top from right to left
  for (let i = 0; i <= PROFILE_SEGS; i++) {
    const a = (i / PROFILE_SEGS) * Math.PI; // 0..PI
    const u = Math.cos(a) * halfW;
    const v = ribH * Math.max(0.4, Math.sin(a)); // ensure sides are tall, top arched
    // Approximate normal for the rounded section
    profile.push({ u, v, nu: Math.cos(a), nv: Math.max(0.4, Math.sin(a)) });
  }
  // Bottom-left corner
  profile.push({ u: -halfW, v: 0, nu: -1, nv: 0 });

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < path.length; i++) {
    let tangent: THREE.Vector3;
    if (i === 0) tangent = path[1].clone().sub(path[0]);
    else if (i === path.length - 1) tangent = path[i].clone().sub(path[i - 1]);
    else tangent = path[i + 1].clone().sub(path[i - 1]);
    if (tangent.lengthSq() === 0) tangent.set(1, 0, 0);
    tangent.normalize();

    // Binormal in horizontal plane perpendicular to tangent
    const binormal = new THREE.Vector3().crossVectors(up, tangent);
    if (binormal.lengthSq() === 0) binormal.set(0, 0, 1);
    binormal.normalize();

    const center = path[i];
    for (const pr of profile) {
      const x = center.x + binormal.x * pr.u;
      const y = center.y + pr.v;
      const z = center.z + binormal.z * pr.u;
      positions.push(x, y, z);

      const nx = binormal.x * pr.nu;
      const ny = pr.nv;
      const nz = binormal.z * pr.nu;
      const nl = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / nl, ny / nl, nz / nl);
    }
  }

  const ringSize = profile.length;
  for (let i = 0; i < path.length - 1; i++) {
    const baseA = i * ringSize;
    const baseB = (i + 1) * ringSize;
    for (let j = 0; j < ringSize - 1; j++) {
      indices.push(baseA + j, baseA + j + 1, baseB + j + 1);
      indices.push(baseA + j, baseB + j + 1, baseB + j);
    }
  }

  // End caps
  const startCenterIdx = positions.length / 3;
  positions.push(path[0].x, ribH * 0.5, path[0].z);
  // Normal pointing back along tangent
  const t0 = path[1].clone().sub(path[0]).normalize().negate();
  normals.push(t0.x, t0.y, t0.z);
  for (let j = 0; j < ringSize - 1; j++) {
    indices.push(startCenterIdx, j + 1, j);
  }

  const endCenterIdx = positions.length / 3;
  const last = path.length - 1;
  positions.push(path[last].x, ribH * 0.5, path[last].z);
  const tEnd = path[last].clone().sub(path[last - 1]).normalize();
  normals.push(tEnd.x, tEnd.y, tEnd.z);
  const endBase = last * ringSize;
  for (let j = 0; j < ringSize - 1; j++) {
    indices.push(endCenterIdx, endBase + j, endBase + j + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generate a merged geometry of all base ribs.
 * Returns null if there are no strokes.
 */
export function generateBaseStrokeGeometry(
  params: ParametricParams,
  options: Options = {},
): THREE.BufferGeometry | null {
  const { scale = 1 } = options;
  const strokes = params.baseStrokes ?? [];
  if (strokes.length === 0) return null;

  const baseRadiusMm = params.baseRadius;
  const geos: THREE.BufferGeometry[] = [];
  for (const s of strokes) {
    const g = buildRibGeometry(s, baseRadiusMm, scale);
    if (g) geos.push(g);
  }
  if (geos.length === 0) return null;
  if (geos.length === 1) return geos[0];
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged ?? null;
}
