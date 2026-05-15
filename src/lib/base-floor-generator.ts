/**
 * Base Floor Generator
 *
 * Builds a closed, watertight disc that sits at the bottom of the body and
 * carries the relief from BaseStrokes. The disc's outer outline matches the
 * body's t=0 silhouette exactly (sample getBodyRadius), so it visually fuses
 * with the body wall.
 *
 * Geometry:
 *   - Top surface: high-density radial mesh, vertices displaced upward by the
 *     stroke height field (rib relief on top of a thin base layer).
 *   - Bottom surface: flat disc at y=0.
 *   - Outer wall: short cylinder ring connecting top edge to bottom edge,
 *     forming a watertight solid.
 *
 * Output is mm-scale by default (for STL); pass scale=0.01 for the scene.
 */

import * as THREE from 'three';
import { ParametricParams } from '@/types/parametric';
import { getBodyRadius } from '@/lib/body-profile-generator';
import { buildBaseStrokeField } from '@/lib/base-stroke-field';

interface Options {
  scale?: number;
  // Thin base layer thickness in mm (so the outer wall is a short ring even
  // with no relief). Defaults to 1.6 mm = ~4 layers at 0.4 nozzle.
  floorThickness?: number;
  radialSegments?: number;
  angularSegments?: number;
}

export interface BaseFloorMeshes {
  top: THREE.BufferGeometry;       // top surface (with relief) + outer wall + bottom
  outerProfileMm: { x: number; z: number }[]; // sampled silhouette in mm (for callers)
}

const DEFAULT_FLOOR_MM = 1.6;
const DEFAULT_RADIAL = 56;
const DEFAULT_ANGULAR = 192;

export function generateBaseFloorGeometry(
  params: ParametricParams,
  options: Options = {},
): THREE.BufferGeometry | null {
  const strokes = params.baseStrokes ?? [];
  if (strokes.length === 0) return null;

  const {
    scale = 1,
    floorThickness = DEFAULT_FLOOR_MM,
    radialSegments = DEFAULT_RADIAL,
    angularSegments = DEFAULT_ANGULAR,
  } = options;

  const field = buildBaseStrokeField(params);
  if (!field.hasAny) return null;

  // Sample outer silhouette in mm
  const baseProfile: { x: number; z: number; r: number; theta: number }[] = [];
  for (let j = 0; j <= angularSegments; j++) {
    const theta = (j / angularSegments) * Math.PI * 2;
    const r = getBodyRadius(params, 0, theta, {
      scale: 1,
      includeTwist: false,
      objectType: 'vase',
    });
    baseProfile.push({ x: Math.cos(theta) * r, z: Math.sin(theta) * r, r, theta });
  }

  const positions: number[] = [];
  const indices: number[] = [];

  // Vertex layout:
  //   [0..(R+1)*(A+1)) : TOP grid vertices (radial × angular), with relief
  //   then BOTTOM center vertex
  //   then OUTER bottom ring vertices (A+1)
  //   then BOTTOM ring along outer (shared positions but separate for normals)

  const A = angularSegments;
  const R = radialSegments;

  const topStart = 0;
  const topRowSize = A + 1;

  // ---- TOP grid ----
  for (let i = 0; i <= R; i++) {
    const rt = i / R;
    for (let j = 0; j <= A; j++) {
      const outer = baseProfile[j];
      const x = outer.x * rt;
      const z = outer.z * rt;
      const relief = field.sample(x, z);
      const y = floorThickness + relief;
      positions.push(x * scale, y * scale, z * scale);
    }
  }

  // Top faces
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < A; j++) {
      const a = topStart + i * topRowSize + j;
      const b = a + 1;
      const c = a + topRowSize + 1;
      const d = a + topRowSize;
      // Top normals point +y, so wind CCW when viewed from above (+y down to -y in scene = ccw on xz)
      indices.push(a, b, c);
      indices.push(a, c, d);
    }
  }

  // ---- BOTTOM (flat disc at y=0) ----
  const bottomCenterIdx = positions.length / 3;
  positions.push(0, 0, 0);

  const bottomRingStart = positions.length / 3;
  for (let j = 0; j <= A; j++) {
    const outer = baseProfile[j];
    positions.push(outer.x * scale, 0, outer.z * scale);
  }

  // Bottom faces (fan from center). Wind so normal points -y:
  for (let j = 0; j < A; j++) {
    const a = bottomRingStart + j;
    const b = bottomRingStart + j + 1;
    indices.push(bottomCenterIdx, b, a);
  }

  // ---- OUTER WALL (connect top outer ring to bottom outer ring) ----
  // Top outer ring is the last row of the top grid (i = R)
  const topOuterStart = topStart + R * topRowSize;
  for (let j = 0; j < A; j++) {
    const tA = topOuterStart + j;
    const tB = topOuterStart + j + 1;
    const bA = bottomRingStart + j;
    const bB = bottomRingStart + j + 1;
    // Outward-facing wall, wind so normal points outward
    indices.push(tA, bA, bB);
    indices.push(tA, bB, tB);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
