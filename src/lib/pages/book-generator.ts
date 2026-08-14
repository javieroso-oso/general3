/**
 * Composes a printable book:
 *   - A continuous SOLID spine slab spanning the full stack length and the full
 *     page width (the book's depth). It sits on the bed and is the first thing
 *     printed, giving a wide, stable base that physically holds the pages
 *     together after printing.
 *   - N thin page slabs rooted into the spine. Each page flares (thickens) at
 *     its foot so the junction is a wedge of material, not a butt joint.
 *   - Optional front/back covers: same construction as pages but thicker and
 *     slightly oversized, bracing the stack at both ends.
 *   - Optional end rails for coverless books.
 *
 * Print orientation: spine flat on bed (Z=0 after STL normalization), pages
 * rising vertically.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BookParams, normalizeBookParams, PageContent } from '@/types/pages';
import { generatePageSlabGeometry } from './page-slab-generator';

export interface BookGenOptions {
  scale?: number; // 1 for export, 0.01 for scene
}

const FOOT_MM = 3.0;        // height of the flared root band on each page
const FOOT_OVERLAP = 0.4;   // how far page feet sink into the spine
const SPINE_MARGIN = 2.0;   // extra spine depth beyond the page/cover footprint

function box(w: number, h: number, d: number, scale: number) {
  const g = new THREE.BoxGeometry(w * scale, h * scale, d * scale);
  g.deleteAttribute('uv');
  return g;
}

export function generateBookGeometry(
  bookIn: BookParams,
  opts: BookGenOptions = {},
): THREE.BufferGeometry | null {
  const scale = opts.scale ?? 1;
  const book = normalizeBookParams(bookIn);
  if (book.pages.length === 0) return null;

  const pageT = Math.max(0.3, book.pageThickness);
  const gap = Math.max(0, book.pageGap);
  const N = book.pages.length;

  const covers = book.covers;
  const coverT = covers.enabled ? Math.max(0.4, covers.thickness) : 0;
  const overhang = covers.enabled ? Math.max(0, covers.overhang) : 0;

  // ---- Stack layout along X ----
  const pagesSpan = N * pageT + (N - 1) * gap;
  const coverGap = covers.enabled ? Math.max(gap, 1.0) : 0;
  const stackSpan = pagesSpan + (covers.enabled ? 2 * (coverT + coverGap) : 0);
  const endMargin = Math.max(covers.enabled ? coverT : pageT * 1.5, 2);
  const spineLenX = stackSpan + 2 * endMargin;

  const spineH = Math.max(1.5, book.spineExtra);
  const spineDepth = book.pageWidth + 2 * overhang + 2 * SPINE_MARGIN;

  const parts: THREE.BufferGeometry[] = [];

  // ---- Solid spine slab ----
  const spine = box(spineLenX, spineH, spineDepth, scale);
  spine.translate(0, (spineH * 0.5) * scale, 0);
  parts.push(spine);

  const rootY = (spineH - FOOT_OVERLAP) * scale;

  const addSlab = (
    content: PageContent,
    x: number,
    thickness: number,
    widthMm: number,
    heightMm: number,
  ) => {
    const slab = generatePageSlabGeometry(content, {
      pageWidthMm: widthMm,
      pageHeightMm: heightMm,
      pageThicknessMm: thickness,
      scale,
      footMm: FOOT_MM,
      // Flare each side so the root is roughly 3x the wall thickness.
      footFlareMm: Math.max(thickness * 0.8, 0.5),
    });
    // Rotate so page width points along Z (perpendicular to the stack axis)
    slab.rotateY(Math.PI / 2);
    slab.translate(x * scale, rootY, 0);
    parts.push(slab);
  };

  // ---- Covers + pages ----
  let cursor = -stackSpan / 2;

  if (covers.enabled) {
    addSlab(
      covers.back,
      cursor + coverT / 2,
      coverT,
      book.pageWidth + 2 * overhang,
      book.pageHeight + overhang,
    );
    cursor += coverT + coverGap;
  }

  for (let i = 0; i < N; i++) {
    addSlab(book.pages[i], cursor + pageT / 2, pageT, book.pageWidth, book.pageHeight);
    cursor += pageT + (i < N - 1 ? gap : 0);
  }

  if (covers.enabled) {
    cursor += coverGap;
    addSlab(
      covers.front,
      cursor + coverT / 2,
      coverT,
      book.pageWidth + 2 * overhang,
      book.pageHeight + overhang,
    );
  }

  // ---- End rails (coverless stiffeners) ----
  if (!covers.enabled && book.endRails) {
    const railH = Math.max(2, book.endRailHeight);
    const railT = Math.max(book.spineWallThickness, pageT * 3);
    for (const dir of [-1, 1]) {
      const rail = box(railT, railH, spineDepth - 2 * SPINE_MARGIN * 0.5, scale);
      rail.translate(
        dir * (spineLenX / 2 - railT / 2 - 0.2) * scale,
        (spineH + railH * 0.5 - FOOT_OVERLAP) * scale,
        0,
      );
      parts.push(rail);
    }
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) {
    const ref = Object.keys(parts[0].attributes).sort().join(',');
    parts.forEach((p, i) => {
      const sig = Object.keys(p.attributes).sort().join(',');
      if (sig !== ref) console.error(`[book-generator] part ${i} attribute mismatch: ${sig} vs ${ref}`);
    });
    parts.forEach(p => p.dispose());
    return null;
  }
  parts.forEach(p => p.dispose());
  merged.computeVertexNormals();
  return merged;
}
