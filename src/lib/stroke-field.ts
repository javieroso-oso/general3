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

const GRID_U = 256; // angular cells (wraps)
const GRID_V = 128; // height cells (clamped)

export interface StrokeField {
  data: Float32Array; // length = GRID_U * GRID_V, value = Δr in mm
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
    let u = (p.u - centroid.u) * sScale + centroid.u + sOffU;
    let v = (p.v - centroid.v) * sScale + centroid.v + sOffV;
    v = Math.max(0, Math.min(1, v));
    u = ((u % 1) + 1) % 1;
    return { u, v };
  });
}

function bake(strokes: SurfaceStroke[], params: ParametricParams): StrokeField {
  const data = new Float32Array(GRID_U * GRID_V);

  // mm-per-cell scale so brush thickness/depth in mm map to a sensible footprint
  const avgRadius = (params.baseRadius + params.topRadius) * 0.5;
  const circumferenceMm = Math.max(1, 2 * Math.PI * avgRadius);
  const heightMm = Math.max(1, params.height);
  const mmPerCellU = circumferenceMm / GRID_U;
  const mmPerCellV = heightMm / GRID_V;

  // Drawing centroid (must match preview generator so transforms agree)
  let su = 0, sv = 0, n = 0;
  for (const st of strokes) for (const p of st.points) { su += p.u; sv += p.v; n++; }
  const centroid = n > 0 ? { u: su / n, v: sv / n } : { u: 0.5, v: 0.5 };

  // Safety clamps — keep wall printable
  // Engraved: must not exceed wallThickness - 0.4mm (one nozzle of margin)
  const maxEngrave = Math.max(0.2, params.wallThickness - 0.4);
  // Raised: keep modest so spiral-mode overhangs stay sane
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

    // Walk segments
    for (let i = 0; i < pts.length - 1; i++) {
      stampSegment(
        data,
        pts[i],
        pts[i + 1],
        radiusMm,
        peakMm * sign,
        mmPerCellU,
        mmPerCellV,
      );
    }
  }

  return { data, width: GRID_U, height: GRID_V };
}

/**
 * Stamp a soft-edged capsule along (a → b) into the grid, taking the
 * larger-magnitude value at each cell so overlapping strokes don't add up
 * to wall-breaking depths.
 */
function stampSegment(
  data: Float32Array,
  a: { u: number; v: number },
  b: { u: number; v: number },
  radiusMm: number,
  peakMm: number, // signed
  mmPerCellU: number,
  mmPerCellV: number,
) {
  // Convert radius to grid cells along each axis
  const radCellsU = Math.max(1, Math.ceil(radiusMm / mmPerCellU));
  const radCellsV = Math.max(1, Math.ceil(radiusMm / mmPerCellV));

  // Handle u wrap — if segment crosses seam, split into two
  const du = b.u - a.u;
  if (Math.abs(du) > 0.5) {
    // crosses 0/1 boundary — duplicate one endpoint on the other side
    if (du > 0) {
      stampSegment(data, { u: a.u + 1, v: a.v }, b, radiusMm, peakMm, mmPerCellU, mmPerCellV);
      stampSegment(data, a, { u: b.u - 1, v: b.v }, radiusMm, peakMm, mmPerCellU, mmPerCellV);
    } else {
      stampSegment(data, a, { u: b.u + 1, v: b.v }, radiusMm, peakMm, mmPerCellU, mmPerCellV);
      stampSegment(data, { u: a.u - 1, v: a.v }, b, radiusMm, peakMm, mmPerCellU, mmPerCellV);
    }
    return;
  }

  // Compute bounding box in cells
  const minU = Math.min(a.u, b.u) - radCellsU / GRID_U;
  const maxU = Math.max(a.u, b.u) + radCellsU / GRID_U;
  const minV = Math.min(a.v, b.v) - radCellsV / GRID_V;
  const maxV = Math.max(a.v, b.v) + radCellsV / GRID_V;

  const x0 = Math.floor(minU * GRID_U);
  const x1 = Math.ceil(maxU * GRID_U);
  const y0 = Math.max(0, Math.floor(minV * GRID_V));
  const y1 = Math.min(GRID_V - 1, Math.ceil(maxV * GRID_V));

  // Segment in mm space
  const ax = a.u * GRID_U * mmPerCellU;
  const ay = a.v * GRID_V * mmPerCellV;
  const bx = b.u * GRID_U * mmPerCellU;
  const by = b.v * GRID_V * mmPerCellV;
  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;

  for (let y = y0; y <= y1; y++) {
    for (let xx = x0; xx <= x1; xx++) {
      const px = xx * mmPerCellU;
      const py = y * mmPerCellV;
      // Distance from (px,py) to segment a-b
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

      // Smooth falloff (cosine ramp) so the wall transitions printably
      const f = 0.5 * (1 + Math.cos((dist / radiusMm) * Math.PI));
      const value = peakMm * f;

      // Wrap u into grid index
      const ux = ((xx % GRID_U) + GRID_U) % GRID_U;
      const idx = y * GRID_U + ux;

      // Take larger-magnitude (signed-aware): keep value with the bigger |v|
      const cur = data[idx];
      if (Math.abs(value) > Math.abs(cur)) data[idx] = value;
    }
  }
}
