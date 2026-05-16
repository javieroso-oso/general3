/**
 * Composes a saddle-stitched book:
 *   - One thin continuous "fold ridge" along X (single-wall thick), sitting on the bed.
 *   - N page slabs perpendicular to the ridge. Each slab's bottom band curves
 *     inward (foot bend) so it lands on the fold ridge with a small overlap.
 *   - Small stitch loops straddling the ridge at regular intervals.
 *
 * Print orientation: spine flat on bed (Z=0), pages standing along +Z after
 * STL normalization (-PI/2 around X).
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BookParams } from '@/types/pages';
import { generatePageSlabGeometry } from './page-slab-generator';

export interface BookGenOptions {
  scale?: number; // 1 for export, 0.01 for scene
}

const FOOT_MM = 1.5;        // height of the curved foot at page bottom
const FOOT_OVERLAP = 0.2;   // how far the foot dips below ridge top for fusion

export function generateBookGeometry(
  book: BookParams,
  opts: BookGenOptions = {},
): THREE.BufferGeometry | null {
  const scale = opts.scale ?? 1;
  if (book.pages.length === 0) return null;

  const pageT = Math.max(0.4, book.pageThickness);
  const gap = Math.max(0, book.pageGap);
  const N = book.pages.length;

  const spinePadX = Math.max(pageT * 1.5, 2);
  const totalSpineX = N * pageT + (N - 1) * gap + 2 * spinePadX;
  const ridgeH = Math.max(1.0, book.spineExtra);
  const ridgeT = pageT; // single perimeter

  const parts: THREE.BufferGeometry[] = [];

  // ---- Thin fold ridge (the "binding crease") ----
  const ridge = new THREE.BoxGeometry(totalSpineX * scale, ridgeH * scale, ridgeT * scale);
  ridge.translate(0, (ridgeH * 0.5) * scale, 0);
  ridge.deleteAttribute('uv');
  parts.push(ridge);

  // ---- Page slabs ----
  const startX = -totalSpineX / 2 + spinePadX + pageT / 2;

  for (let i = 0; i < N; i++) {
    const page = book.pages[i];
    // Alternate bend direction to suggest nested signatures
    const footDir = i % 2 === 0 ? -1 : 1;
    const slab = generatePageSlabGeometry(page, {
      pageWidthMm: book.pageWidth,
      pageHeightMm: book.pageHeight,
      pageThicknessMm: pageT,
      scale,
      footMm: FOOT_MM,
      footCurveMm: pageT * 0.5 * footDir,
    });
    // Rotate so page width points along Z (perpendicular to ridge)
    slab.rotateY(Math.PI / 2);
    // Foot meets top of ridge with small overlap for slicer fusion
    slab.translate(
      startX * scale + i * (pageT + gap) * scale,
      (ridgeH - FOOT_OVERLAP) * scale,
      0,
    );
    parts.push(slab);
  }

  // ---- Stitch loops straddling the ridge ----
  const loopCount = Math.max(3, Math.floor(totalSpineX / 14));
  const loopR = Math.min(ridgeH * 0.35, 1.2);
  const tubeR = Math.min(pageT * 0.9, 0.45);
  const loopSpan = totalSpineX - 2 * spinePadX * 0.5;
  for (let k = 0; k < loopCount; k++) {
    const t = loopCount === 1 ? 0.5 : k / (loopCount - 1);
    const x = -loopSpan / 2 + t * loopSpan;
    const loop = new THREE.TorusGeometry(loopR * scale, tubeR * scale, 6, 18);
    // Default torus lies in XY plane (normal +Z). We want it wrapping around
    // the ridge, i.e. lying in YZ plane (normal +X) so it loops over the top.
    loop.rotateY(Math.PI / 2);
    loop.translate(x * scale, ridgeH * scale, 0);
    loop.deleteAttribute('uv');
    loop.deleteAttribute('normal');
    parts.push(loop);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  if (!merged) return null;
  merged.computeVertexNormals();
  return merged;
}
