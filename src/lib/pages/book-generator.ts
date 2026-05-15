/**
 * Composes a full book: ONE continuous spine bar + N page slabs embedded into it.
 *
 * Output frame (mm):
 *   - Spine bar runs uninterrupted along X for the full book length, sitting on
 *     the bed (y in [0, spineY]).
 *   - Pages stand vertically along +Y. Their bottom edge is sunk EMBED_DEPTH mm
 *     into the spine so the spine reads as one continuous element and the
 *     slicer fuses page+spine into a single contour at every layer near the bed.
 *   - Pages spaced along X by (pageThickness + pageGap), centered on 0.
 *
 * STL normalization later rotates -PI/2 around X so the spine lands flat on
 * the slicer bed and pages rise along +Z.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BookParams } from '@/types/pages';
import { generatePageSlabGeometry } from './page-slab-generator';

export interface BookGenOptions {
  scale?: number; // 1 for export, 0.01 for scene
}

const EMBED_DEPTH_MM = 0.8; // how far pages sink into the spine bar

export function generateBookGeometry(
  book: BookParams,
  opts: BookGenOptions = {},
): THREE.BufferGeometry | null {
  const scale = opts.scale ?? 1;
  if (book.pages.length === 0) return null;

  const pageT = Math.max(0.4, book.pageThickness);
  const gap = Math.max(0, book.pageGap);
  const N = book.pages.length;
  const maxRelief = book.pages.reduce((m, p) => Math.max(m, p.reliefHeight), 0);

  // Spine geometry — one continuous bar covering all pages plus end caps
  const spinePadX = Math.max(pageT * 1.5, 2);
  const totalSpineX = N * pageT + (N - 1) * gap + 2 * spinePadX;
  const spineY = Math.max(1.0, book.spineExtra);
  // Spine width along Z: must wrap the thickest page+relief on both sides
  const spineZ = pageT + 2 * (maxRelief + 0.6);

  const parts: THREE.BufferGeometry[] = [];

  // ---- Continuous spine bar ----
  const spineGeo = new THREE.BoxGeometry(totalSpineX * scale, spineY * scale, spineZ * scale);
  spineGeo.translate(0, (spineY * 0.5) * scale, 0);
  spineGeo.deleteAttribute('uv'); // match slab attribute set (position+normal+index only)
  parts.push(spineGeo);

  // ---- Page slabs embedded into the spine ----
  const startX = -totalSpineX / 2 + spinePadX + pageT / 2;
  // Embed depth, but never more than spineY-0.4 so we don't poke through the bed
  const embed = Math.min(EMBED_DEPTH_MM, Math.max(0, spineY - 0.4));

  for (let i = 0; i < N; i++) {
    const page = book.pages[i];
    const slab = generatePageSlabGeometry(page, {
      pageWidthMm: book.pageWidth,
      pageHeightMm: book.pageHeight,
      pageThicknessMm: pageT,
      scale,
    });
    // Rotate so page width points along Z (matching spine width direction)
    slab.rotateY(Math.PI / 2);
    // Bottom of slab (y=0 in its frame) goes to y = spineY - embed
    slab.translate(
      startX * scale + i * (pageT + gap) * scale,
      (spineY - embed) * scale,
      0,
    );
    parts.push(slab);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  if (!merged) return null;
  merged.computeVertexNormals();
  return merged;
}
