/**
 * Composes a full book: spine bar + N page slabs.
 *
 * Output frame (mm): spine extends along X centered on 0 at the bottom (y=0).
 * Pages stand vertically along +Y. Each page is offset along the spine axis
 * (X) by index. Print orientation matches: spine flat on bed (after STL
 * normalization rotates -PI/2 around X to put +Y → +Z).
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

  // Total spine length along X = N pages + (N-1) gaps + a small margin on ends
  const spinePadX = pageT * 1.5;
  const totalSpineX = N * pageT + (N - 1) * gap + 2 * spinePadX;
  const spineY = book.spineExtra; // spine bar vertical thickness on the bed
  // Spine extends in Z to fully overlap each page's thickness + relief room
  // Pages are centered on z=0 with width pageT + 2*relief; for spine width,
  // use page thickness + spineThickness margin on each side so the spine is
  // visibly chunkier than a single page.
  const maxRelief = book.pages.reduce(
    (m, p) => Math.max(m, p.reliefHeight * (p.faces === 'both' ? 1 : 1)),
    0,
  );
  const spineZ = pageT + 2 * (maxRelief + book.spineThickness);

  const parts: THREE.BufferGeometry[] = [];

  // ---- Spine bar: a simple box at y in [0, spineY] ----
  const spineGeo = new THREE.BoxGeometry(totalSpineX * scale, spineY * scale, spineZ * scale);
  // Box is centered on origin; translate up so y in [0, spineY]
  spineGeo.translate(0, (spineY * 0.5) * scale, 0);
  parts.push(spineGeo);

  // ---- Page slabs ----
  // First page center X:
  const startX = -totalSpineX / 2 + spinePadX + pageT / 2;
  for (let i = 0; i < N; i++) {
    const page = book.pages[i];
    const slab = generatePageSlabGeometry(page, {
      pageWidthMm: pageT, // slab "width" along X equals page thickness
      // We want the slab's local X to match the spine direction. So we'll
      // generate the slab with its mesh oriented as: width=pageT (along X),
      // height=pageHeight (along Y), thickness=pageWidth (along Z).
      // We'll re-map below by rotating instead — simpler: generate in natural
      // orientation (width=pageWidth along X, height=pageHeight along Y,
      // thickness=pageT along Z) then rotate 90° around Y so width becomes Z.
      pageHeightMm: book.pageHeight,
      pageThicknessMm: pageT,
      scale,
    } as any);
    // Above we passed the wrong widths just to satisfy types — regenerate cleanly:
    slab.dispose();

    const slabClean = generatePageSlabGeometry(page, {
      pageWidthMm: book.pageWidth,
      pageHeightMm: book.pageHeight,
      pageThicknessMm: pageT,
      scale,
    });
    // Currently: width(pageWidth)→X, height(pageHeight)→Y (from y=0 up),
    // thickness(pageT)→Z (centered). Rotate 90° around Y so width→Z and pageT→X.
    slabClean.rotateY(Math.PI / 2);
    // After rotation, page's vertical Y stays the same (good — pages stand up).
    // Translate along X to its slot, and lift slightly so it sits on top of
    // the spine bar (pages start at y = spineY).
    slabClean.translate(startX * scale + i * (pageT + gap) * scale, spineY * scale, 0);
    parts.push(slabClean);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  if (!merged) return null;
  merged.computeVertexNormals();
  return merged;
}
