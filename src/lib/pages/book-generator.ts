/**
 * Composes a full book: spine bar + N page slabs.
 *
 * Output frame (mm):
 *   - Spine bar extends along X, sits on the bed (y in [0, spineY]).
 *   - Pages stand vertically along +Y, each one a thin slab whose flat faces
 *     point ±X (so reading direction along the spine).
 *   - Pages are spaced along X by `pageThickness + pageGap`, centered on 0.
 *
 * STL normalization later rotates -PI/2 around X to flip Y→Z so the spine
 * lands flat on the slicer bed.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BookParams } from '@/types/pages';
import { generatePageSlabGeometry } from './page-slab-generator';

export interface BookGenOptions {
  scale?: number; // 1 for export, 0.01 for scene
}

export function generateBookGeometry(
  book: BookParams,
  opts: BookGenOptions = {},
): THREE.BufferGeometry | null {
  const scale = opts.scale ?? 1;
  if (book.pages.length === 0) return null;

  const pageT = Math.max(0.4, book.pageThickness);
  const gap = Math.max(0, book.pageGap);
  const N = book.pages.length;

  const spinePadX = pageT * 1.5;
  const totalSpineX = N * pageT + (N - 1) * gap + 2 * spinePadX;
  const spineY = Math.max(1.0, book.spineExtra);
  const maxRelief = book.pages.reduce((m, p) => Math.max(m, p.reliefHeight), 0);
  const spineZ = pageT + 2 * (maxRelief + book.spineThickness);

  const parts: THREE.BufferGeometry[] = [];

  // ---- Spine bar ----
  const spineGeo = new THREE.BoxGeometry(totalSpineX * scale, spineY * scale, spineZ * scale);
  spineGeo.translate(0, (spineY * 0.5) * scale, 0);
  parts.push(spineGeo);

  // ---- Page slabs ----
  const startX = -totalSpineX / 2 + spinePadX + pageT / 2;
  for (let i = 0; i < N; i++) {
    const page = book.pages[i];
    // Slab is generated in its natural frame: width=pageWidth along X,
    // height=pageHeight along Y (from spine y=0 upward), thickness=pageT
    // along Z (centered on z=0).
    const slab = generatePageSlabGeometry(page, {
      pageWidthMm: book.pageWidth,
      pageHeightMm: book.pageHeight,
      pageThicknessMm: pageT,
      scale,
    });
    // Rotate 90° around Y so the page width now points along Z (spine width
    // direction) and the page thickness points along X (so adjacent pages
    // line up nicely along the spine).
    slab.rotateY(Math.PI / 2);
    // Sit it on top of the spine bar.
    slab.translate(startX * scale + i * (pageT + gap) * scale, spineY * scale, 0);
    parts.push(slab);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  if (!merged) return null;
  merged.computeVertexNormals();
  return merged;
}
