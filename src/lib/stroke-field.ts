/**
 * Stroke Radial Field
 *
 * Bakes the user's surface drawings into a 2D (theta, t) → Δr_mm grid that
 * `getBodyRadius` can sample. This is what makes engraved / raised strokes
 * physically modify the wall — and therefore what makes them visible to the
 * spiral-vase G-code generator.
 *
 *   Engraved / Cut → negative Δr (wall pulled inward)
 *   Raised         → positive Δr (wall pushed outward)
 *   Ribbon / Texture → ignored here (still rendered as floating preview meshes)
 *
 * The grid is cached on the strokes-array reference plus a fingerprint of the
 * dimensions that affect the rasterisation, so a typical paint stroke causes
 * at most one bake per change.
 */

import type { ParametricParams, SurfaceStroke } from '@/types/parametric';
// Stroke U is the real circumference U (canvas width = full 360°),
// so unwrap compensation is no longer applied during the bake.

// Grid resolution targets ~0.5mm/cell so the wall actually carries the
// drawing's pixel-level detail into the printed object. Capped to keep the
// bake fast and bounded.
const MIN_GRID_U = 512;
const MAX_GRID_U = 2048;
const MIN_GRID_V = 256;
const MAX_GRID_V = 1024;
const TARGET_MM_PER_CELL = 0.5;

export interface StrokeField {
  data: Float32Array; // length = width * height, value = Δr in mm
  width: number;
  height: number;
}

interface CacheEntry {
  fingerprint: string;
  field: StrokeField | null;
}

const cache = new WeakMap<SurfaceStroke[], CacheEntry>();

function fingerprintParams(params: ParametricParams): string {
  // Anything that changes how strokes rasterise into mm
  return [
    params.height,
    params.baseRadius,
    params.topRadius,
    params.wallThickness,
    params.surfaceGlobalOffsetU ?? 0,
    params.surfaceGlobalOffsetV ?? 0,
    params.surfaceGlobalScale ?? 1,
  ].join('|');
}

function fingerprintStrokes(strokes: SurfaceStroke[]): string {
  // Cheap structural hash — fine for our cache invalidation needs
  let s = '';
  for (const st of strokes) {
    s += `${st.id}:${st.effect}:${st.depth}:${st.thickness}:${st.points.length}:${st.offsetU ?? 0}:${st.offsetV ?? 0}:${st.strokeScale ?? 1};`;
    // sample a few points for shape changes
    const n = st.points.length;
    if (n > 0) {
      const i0 = st.points[0];
      const im = st.points[Math.floor(n / 2)];
      const il = st.points[n - 1];
      s += `${i0.u.toFixed(3)},${i0.v.toFixed(3)}|${im.u.toFixed(3)},${im.v.toFixed(3)}|${il.u.toFixed(3)},${il.v.toFixed(3)};`;
    }
  }
  return s;
}

/**
 * Returns the baked stroke field for these params, or null if there are no
 * engraving / raising strokes.
 */
export function getStrokeField(params: ParametricParams): StrokeField | null {
  const strokes = params.surfaceStrokes;
  if (!strokes || strokes.length === 0) return null;

  const printable = strokes.filter(
    (s) => s.effect === 'engraved' || s.effect === 'cut' || s.effect === 'raised',
  );
  if (printable.length === 0) return null;

  const fp = fingerprintParams(params) + '#' + fingerprintStrokes(printable);
  const existing = cache.get(strokes);
  if (existing && existing.fingerprint === fp) return existing.field;

  const field = bake(printable, params);
  cache.set(strokes, { fingerprint: fp, field });
  return field;
}

/**
 * Sample the field at (theta, t). Returns Δr in mm.
 * Handles angular wrap and bilinear interpolation.
 */
export function sampleStrokeField(
  field: StrokeField,
  theta: number,
  t: number,
): number {
  const u = ((theta / (Math.PI * 2)) % 1 + 1) % 1;
  const v = Math.max(0, Math.min(1, t));

  const fx = u * field.width;
  const fy = v * (field.height - 1);

  const x0 = Math.floor(fx) % field.width;
  const x1 = (x0 + 1) % field.width;
  const y0 = Math.floor(fy);
  const y1 = Math.min(y0 + 1, field.height - 1);

  const tx = fx - Math.floor(fx);
  const ty = fy - y0;

  const a = field.data[y0 * field.width + x0];
  const b = field.data[y0 * field.width + x1];
  const c = field.data[y1 * field.width + x0];
  const d = field.data[y1 * field.width + x1];

  const ab = a * (1 - tx) + b * tx;
  const cd = c * (1 - tx) + d * tx;
  return ab * (1 - ty) + cd * ty;
}

// ----- internals -----

function applyTransforms(
  points: { u: number; v: number }[],
  stroke: SurfaceStroke,
  params: ParametricParams,
  centroid: { u: number; v: number },
): { u: number; v: number }[] {
  const globalU = params.surfaceGlobalOffsetU ?? 0;
  const globalV = params.surfaceGlobalOffsetV ?? 0;
  const globalScale = params.surfaceGlobalScale ?? 1;
  const sOffU = (stroke.offsetU ?? 0) + globalU;
  const sOffV = (stroke.offsetV ?? 0) + globalV;
  const sScale = (stroke.strokeScale ?? 1) * globalScale;

  return points.map((p) => {
    // Scale around centroid + apply offsets. Canvas U == real circumference U.
    let u = (p.u - centroid.u) * sScale + centroid.u + sOffU;
    let v = (p.v - centroid.v) * sScale + centroid.v + sOffV;
    v = Math.max(0, Math.min(1, v));
    u = ((u % 1) + 1) % 1;
    return { u, v };
  });
}

function bake(strokes: SurfaceStroke[], params: ParametricParams): StrokeField {
  // Adaptive grid: aim for ~TARGET_MM_PER_CELL across both axes so the bake
  // resolution actually matches the printed resolution rather than an
  // arbitrary 256×128 raster.
  const avgRadius = (params.baseRadius + params.topRadius) * 0.5;
  const circumferenceMm = Math.max(1, 2 * Math.PI * avgRadius);
  const heightMm = Math.max(1, params.height);

  const gridU = Math.min(
    MAX_GRID_U,
    Math.max(MIN_GRID_U, Math.ceil(circumferenceMm / TARGET_MM_PER_CELL)),
  );
  const gridV = Math.min(
    MAX_GRID_V,
    Math.max(MIN_GRID_V, Math.ceil(heightMm / TARGET_MM_PER_CELL)),
  );

  const data = new Float32Array(gridU * gridV);
  const mmPerCellU = circumferenceMm / gridU;
  const mmPerCellV = heightMm / gridV;

  // Drawing centroid in canvas-space (must match preview generator)
  let su = 0, sv = 0, n = 0;
  for (const st of strokes) for (const p of st.points) { su += p.u; sv += p.v; n++; }
  const centroid = n > 0 ? { u: su / n, v: sv / n } : { u: 0.5, v: 0.5 };

  // Safety clamps — keep wall printable
  const maxEngrave = Math.max(0.2, params.wallThickness - 0.4);
  const maxRaise = 1.2;

  for (const stroke of strokes) {
    const pts = applyTransforms(stroke.points, stroke, params, centroid);
    if (pts.length < 2) continue;

    const sign = stroke.effect === 'raised' ? 1 : -1;
    const peakMm =
      sign > 0
        ? Math.min(stroke.depth, maxRaise)
        : Math.min(stroke.depth, maxEngrave);
    const radiusMm = Math.max(0.4, stroke.thickness * 0.5);

    for (let i = 0; i < pts.length - 1; i++) {
      stampSegment(
        data,
        gridU,
        gridV,
        pts[i],
        pts[i + 1],
        radiusMm,
        peakMm * sign,
        mmPerCellU,
        mmPerCellV,
      );
    }
  }

  return { data, width: gridU, height: gridV };
}

/**
 * Stamp a soft-edged capsule along (a → b) into the grid, taking the
 * larger-magnitude value at each cell so overlapping strokes don't add up
 * to wall-breaking depths.
 */
function stampSegment(
  data: Float32Array,
  gridU: number,
  gridV: number,
  a: { u: number; v: number },
  b: { u: number; v: number },
  radiusMm: number,
  peakMm: number,
  mmPerCellU: number,
  mmPerCellV: number,
) {
  const radCellsU = Math.max(1, Math.ceil(radiusMm / mmPerCellU));
  const radCellsV = Math.max(1, Math.ceil(radiusMm / mmPerCellV));

  // Handle u wrap — if segment crosses seam, split into two
  const du = b.u - a.u;
  if (Math.abs(du) > 0.5) {
    if (du > 0) {
      stampSegment(data, gridU, gridV, { u: a.u + 1, v: a.v }, b, radiusMm, peakMm, mmPerCellU, mmPerCellV);
      stampSegment(data, gridU, gridV, a, { u: b.u - 1, v: b.v }, radiusMm, peakMm, mmPerCellU, mmPerCellV);
    } else {
      stampSegment(data, gridU, gridV, a, { u: b.u + 1, v: b.v }, radiusMm, peakMm, mmPerCellU, mmPerCellV);
      stampSegment(data, gridU, gridV, { u: a.u - 1, v: a.v }, b, radiusMm, peakMm, mmPerCellU, mmPerCellV);
    }
    return;
  }

  const minU = Math.min(a.u, b.u) - radCellsU / gridU;
  const maxU = Math.max(a.u, b.u) + radCellsU / gridU;
  const minV = Math.min(a.v, b.v) - radCellsV / gridV;
  const maxV = Math.max(a.v, b.v) + radCellsV / gridV;

  const x0 = Math.floor(minU * gridU);
  const x1 = Math.ceil(maxU * gridU);
  const y0 = Math.max(0, Math.floor(minV * gridV));
  const y1 = Math.min(gridV - 1, Math.ceil(maxV * gridV));

  const ax = a.u * gridU * mmPerCellU;
  const ay = a.v * gridV * mmPerCellV;
  const bx = b.u * gridU * mmPerCellU;
  const by = b.v * gridV * mmPerCellV;
  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;

  for (let y = y0; y <= y1; y++) {
    for (let xx = x0; xx <= x1; xx++) {
      const px = xx * mmPerCellU;
      const py = y * mmPerCellV;
      let d2: number;
      if (segLenSq === 0) {
        const ddx = px - ax;
        const ddy = py - ay;
        d2 = ddx * ddx + ddy * ddy;
      } else {
        let tt = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
        tt = Math.max(0, Math.min(1, tt));
        const cx = ax + tt * dx;
        const cy = ay + tt * dy;
        const ddx = px - cx;
        const ddy = py - cy;
        d2 = ddx * ddx + ddy * ddy;
      }
      const dist = Math.sqrt(d2);
      if (dist > radiusMm) continue;

      const f = 0.5 * (1 + Math.cos((dist / radiusMm) * Math.PI));
      const value = peakMm * f;

      const ux = ((xx % gridU) + gridU) % gridU;
      const idx = y * gridU + ux;

      const cur = data[idx];
      if (Math.abs(value) > Math.abs(cur)) data[idx] = value;
    }
  }
}
