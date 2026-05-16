/**
 * Generates a watertight BufferGeometry for ONE page slab with relief on
 * front/back faces.
 *
 * Local frame (mm): page lies in the XY plane with width along X (centered on 0)
 * and height along Y from 0 (spine edge) up to pageHeight. The slab's nominal
 * thickness extends along Z, centered on z=0:
 *   front face nominal z = +pageThickness/2,  back face = -pageThickness/2
 * Relief raises the surface outward from each face.
 */

import * as THREE from 'three';
import { PageContent } from '@/types/pages';
import { buildPageHeightField, PageHeightField, sampleField } from './page-height-field';

export interface SlabOptions {
  pageWidthMm: number;
  pageHeightMm: number;
  pageThicknessMm: number;
  scale?: number;       // 1 for export, 0.01 for scene
  cellsPerMm?: number;
  // How densely to triangulate the front/back surfaces (cells per mm).
  meshCellsPerMm?: number;
  // Optional "foot bend" at the bottom of the page (spine attachment side):
  // for y in [0, footMm] the whole slab is shifted along local Z by a smooth
  // curve that reaches `footCurveMm` at y=0 and 0 at y=footMm. Sign of
  // footCurveMm chooses bend direction (front or back).
  footMm?: number;
  footCurveMm?: number;
}

const DEFAULT_MESH = 2; // 2 verts/mm => ~ 0.5mm triangles. Good for 0.4 nozzle.

// Smoothstep-based foot offset: returns the Z shift to add at height y (mm).
function footOffsetMm(y: number, footMm: number, footCurveMm: number): number {
  if (footMm <= 0 || footCurveMm === 0 || y >= footMm) return 0;
  const t = Math.max(0, Math.min(1, y / footMm)); // 0 at bottom, 1 at top of foot
  const s = 1 - t * t * (3 - 2 * t); // smoothstep, 1 at bottom -> 0 at top
  return footCurveMm * s;
}

export function generatePageSlabGeometry(
  page: PageContent,
  opts: SlabOptions,
): THREE.BufferGeometry {
  const scale = opts.scale ?? 1;
  const W_mm = opts.pageWidthMm;
  const H_mm = opts.pageHeightMm;
  const T = opts.pageThicknessMm;
  const meshPerMm = opts.meshCellsPerMm ?? DEFAULT_MESH;
  const NX = Math.max(2, Math.round(W_mm * meshPerMm));
  const NY = Math.max(2, Math.round(H_mm * meshPerMm));
  const footMm = opts.footMm ?? 0;
  const footCurveMm = opts.footCurveMm ?? 0;

  const field: PageHeightField = buildPageHeightField(page, {
    pageWidthMm: W_mm,
    pageHeightMm: H_mm,
    cellsPerMm: opts.cellsPerMm,
  });
  const reliefFront = page.faces === 'back' ? 0 : 1;
  const reliefBack = page.faces === 'front' ? 0 : 1;

  const positions: number[] = [];
  const indices: number[] = [];

  // ---- FRONT face vertices (z = +T/2 + relief, normal +Z) ----
  const frontStart = 0;
  for (let j = 0; j <= NY; j++) {
    const v = j / NY;
    const y = v * H_mm; // 0..H, spine at y=0
    const zShift = footOffsetMm(y, footMm, footCurveMm);
    for (let i = 0; i <= NX; i++) {
      const u = i / NX;
      const x = (u - 0.5) * W_mm;
      const r = sampleField(field, u, v) * reliefFront;
      const z = T * 0.5 + r + zShift;
      positions.push(x * scale, y * scale, z * scale);
    }
  }
  const rowSize = NX + 1;
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = frontStart + j * rowSize + i;
      const b = a + 1;
      const c = a + rowSize + 1;
      const d = a + rowSize;
      // Front normals point +Z: CCW when viewed from +Z
      indices.push(a, b, c);
      indices.push(a, c, d);
    }
  }

  // ---- BACK face vertices (z = -T/2 - relief, normal -Z) ----
  const backStart = positions.length / 3;
  for (let j = 0; j <= NY; j++) {
    const v = j / NY;
    const y = v * H_mm;
    const zShift = footOffsetMm(y, footMm, footCurveMm);
    for (let i = 0; i <= NX; i++) {
      const u = i / NX;
      const x = (u - 0.5) * W_mm;
      const r = sampleField(field, u, v) * reliefBack;
      const z = -T * 0.5 - r + zShift;
      positions.push(x * scale, y * scale, z * scale);
    }
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = backStart + j * rowSize + i;
      const b = a + 1;
      const c = a + rowSize + 1;
      const d = a + rowSize;
      // Back normals point -Z: CW (reversed)
      indices.push(a, c, b);
      indices.push(a, d, c);
    }
  }

  // ---- RIM walls connecting front edge to back edge on top & sides ----
  // We build short bridge quads using the actual displaced edge vertices so
  // the perimeter is welded perfectly (no T-joints).
  const idxFront = (i: number, j: number) => frontStart + j * rowSize + i;
  const idxBack = (i: number, j: number) => backStart + j * rowSize + i;

  // TOP edge (j = NY): face normal +Y. Wind so normal +Y.
  for (let i = 0; i < NX; i++) {
    const fA = idxFront(i, NY);
    const fB = idxFront(i + 1, NY);
    const bA = idxBack(i, NY);
    const bB = idxBack(i + 1, NY);
    indices.push(fA, fB, bB);
    indices.push(fA, bB, bA);
  }
  // BOTTOM edge (j = 0): this is the spine attachment side; we still cap it so
  // the slab is watertight standalone. The book generator overlaps it with the
  // spine — that's fine, it just becomes interior wall (slicer handles it).
  for (let i = 0; i < NX; i++) {
    const fA = idxFront(i, 0);
    const fB = idxFront(i + 1, 0);
    const bA = idxBack(i, 0);
    const bB = idxBack(i + 1, 0);
    // Normal -Y
    indices.push(fA, bB, fB);
    indices.push(fA, bA, bB);
  }
  // LEFT edge (i = 0): normal -X
  for (let j = 0; j < NY; j++) {
    const fA = idxFront(0, j);
    const fB = idxFront(0, j + 1);
    const bA = idxBack(0, j);
    const bB = idxBack(0, j + 1);
    indices.push(fA, bB, fB);
    indices.push(fA, bA, bB);
  }
  // RIGHT edge (i = NX): normal +X
  for (let j = 0; j < NY; j++) {
    const fA = idxFront(NX, j);
    const fB = idxFront(NX, j + 1);
    const bA = idxBack(NX, j);
    const bB = idxBack(NX, j + 1);
    indices.push(fA, fB, bB);
    indices.push(fA, bB, bA);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
