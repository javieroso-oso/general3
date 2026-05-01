/**
 * Funky Skin — XY-only surface texture generator.
 *
 * Adds a radial perturbation (in mm) to the body wall as a function of
 * (theta, t, layerIdx, seed). All Z stays untouched, so output prints safely
 * on any planar FDM printer including the Bambu A1.
 *
 * Each mode returns a value in [-1, 1], multiplied by amplitude (mm) and
 * shaped by `crispness` (0=smooth, 1=razor sharp) before being added to the
 * radius at the end of `getBodyRadius`. Viewport, STL, and G-code all pick
 * it up automatically through the same chokepoint.
 */

import type { ParametricParams } from '@/types/parametric';

const TAU = Math.PI * 2;

// Cheap, deterministic, frame-stable pseudo-random in [-1, 1]
const hash3 = (a: number, b: number, c: number) => {
  const dot = a * 12.9898 + b * 78.233 + c * 37.719;
  return ((Math.sin(dot) * 43758.5453) % 1) * 2 - 1;
};

const hash3pos = (a: number, b: number, c: number) => (hash3(a, b, c) + 1) * 0.5; // [0,1]

// Triangle wave in [-1, 1] — sharper than sine
const tri = (x: number) => {
  const p = ((x / TAU) % 1 + 1) % 1; // [0,1)
  return 1 - 4 * Math.abs(p - 0.5);
};

// 2D value noise (kept for brushed mode), returns [-1, 1]
const valueNoise2D = (u: number, v: number, seed: number) => {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fu = u - iu;
  const fv = v - iv;
  const su = fu * fu * (3 - 2 * fu);
  const sv = fv * fv * (3 - 2 * fv);
  const n00 = hash3(iu, iv, seed);
  const n10 = hash3(iu + 1, iv, seed);
  const n01 = hash3(iu, iv + 1, seed);
  const n11 = hash3(iu + 1, iv + 1, seed);
  const nx0 = n00 * (1 - su) + n10 * su;
  const nx1 = n01 * (1 - su) + n11 * su;
  return nx0 * (1 - sv) + nx1 * sv;
};

export interface SkinTextureSettings {
  mode: ParametricParams['skinTextureMode'];
  amplitude: number;
  density: number;
  direction: ParametricParams['skinTextureDirection'];
  startHeightPct: number;
  endHeightPct: number;
  seed: number;
  crispness: number;     // 0..1
  threadPitch: number;   // turns over full height (threads mode)
}

export interface SkinTextureContext {
  layerIdx?: number;
  layerHeightMm?: number;
  heightMm?: number;
}

const AMP_HARD_CAP_MM = 1.2;

/**
 * Apply crispness to a value in [-1, 1].
 * crispness=0 -> identity (smooth). crispness=1 -> sign step (binary).
 * In between: signed power curve sharpens edges by raising magnitude exponent.
 */
const sharpen = (v: number, crispness: number) => {
  const c = Math.max(0, Math.min(1, crispness));
  if (c <= 0) return v;
  if (c >= 0.999) return Math.sign(v);
  const exp = 1 - c * 0.92;          // 1 -> ~0.08
  return Math.sign(v) * Math.pow(Math.abs(v), exp);
};

// === Per-mode pure functions: return delta in [-1, 1], pre-sharpen ===

const fuzzDelta = (theta: number, _t: number, layerIdx: number, settings: SkinTextureSettings) => {
  // Per-(layer, angular bucket) hash — true sandpaper. 512 buckets at density=1.
  const angularBuckets = Math.max(32, Math.round(512 * settings.density));
  const bucket = Math.floor((((theta / TAU) % 1) + 1) % 1 * angularBuckets);
  return hash3(bucket, layerIdx, settings.seed);
};

const knurlDelta = (theta: number, t: number, _layerIdx: number, settings: SkinTextureSettings) => {
  // Two interfering triangle waves -> sharp diamond pyramids
  const N = Math.max(4, Math.round(32 * settings.density));
  const pitch = N * 0.5;
  const a = tri(theta * N + t * Math.PI * pitch);
  const b = tri(theta * N - t * Math.PI * pitch);
  // Multiply: peaks where both crests align; flatten valleys
  const v = a * b; // already [-1, 1]-ish
  return Math.max(-1, Math.min(1, v));
};

const scalesDelta = (theta: number, t: number, _layerIdx: number, settings: SkinTextureSettings) => {
  // Brick-offset hex-ish grid with arc-clipped half-circle shingles
  const around = Math.max(8, Math.round(40 * settings.density));
  const tall = Math.max(8, Math.round(60 * settings.density));
  const u = (theta / TAU) * around;
  const v = t * tall;
  const row = Math.floor(v);
  const offset = (row % 2) * 0.5;
  const cu = u + offset;
  const fcu = cu - Math.floor(cu) - 0.5;       // [-0.5, 0.5]
  const fv = v - row;                            // [0, 1]
  // Half-circle shingle: bump near bottom of cell, fade upward
  const shingleY = fv;                           // 0 = bottom (visible edge)
  const dist = Math.sqrt(fcu * fcu * 4 + (shingleY - 0.0) * (shingleY - 0.0));
  const inside = Math.max(0, 1 - dist);          // [0,1]
  // Map [0,1] -> [-1, 1] but bias outward (positive)
  return inside * 2 - 0.6;
};

const ribsDelta = (theta: number, _t: number, _layerIdx: number, settings: SkinTextureSettings) => {
  // True triangle wave around theta -> sharp vertical flutes
  const N = Math.max(4, Math.round(48 * settings.density));
  return tri(theta * N);
};

const brushedDelta = (theta: number, _t: number, layerIdx: number, settings: SkinTextureSettings) => {
  // Anisotropic noise — long horizontal streaks (low theta freq, high z freq)
  const u = theta * 3 * settings.density;
  const v = layerIdx * 1.4 * settings.density;
  // Layer two octaves for fibrous look
  const a = valueNoise2D(u, v, settings.seed);
  const b = valueNoise2D(u * 2.1, v * 2.3, settings.seed + 11) * 0.5;
  return Math.max(-1, Math.min(1, a + b));
};

const pixelDelta = (theta: number, _t: number, layerIdx: number, settings: SkinTextureSettings) => {
  // Hard binary voxels — true Minecraft look
  const around = Math.max(8, Math.round(80 * settings.density));
  const layerStride = Math.max(1, Math.round(3 / Math.max(0.25, settings.density)));
  const tCell = Math.floor((((theta / TAU) % 1) + 1) % 1 * around);
  const lCell = Math.floor(layerIdx / layerStride);
  return hash3(tCell, lCell, settings.seed) > 0 ? 1 : -1;
};

const hammeredDelta = (theta: number, t: number, _layerIdx: number, settings: SkinTextureSettings) => {
  // Jittered grid of concave dimples — beaten copper
  const around = Math.max(6, Math.round(24 * settings.density));
  const tall = Math.max(6, Math.round(36 * settings.density));
  const u = (theta / TAU) * around;
  const v = t * tall;
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  // Find the closest jittered cell center across 3x3 neighbors
  let best = 1e9;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = iu + dx;
      const cy = iv + dy;
      const jx = hash3pos(cx, cy, settings.seed) * 0.7 + 0.15;
      const jy = hash3pos(cx, cy, settings.seed + 31) * 0.7 + 0.15;
      const px = cx + jx;
      const py = cy + jy;
      const ddx = (u - px);
      const ddy = (v - py);
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < best) best = d;
    }
  }
  // Concave dimples: closer to center -> deeper inward
  const radius = 0.55;
  if (best > radius) return 0;
  const inside = 1 - best / radius;       // [0,1]
  // Smooth concave bowl, biased inward
  return -(inside * inside);              // [-1, 0]
};

const threadsDelta = (theta: number, t: number, _layerIdx: number, settings: SkinTextureSettings) => {
  // Single helical groove — looks like a screw thread
  const turns = Math.max(1, settings.threadPitch || 8);
  const phase = theta + t * turns * TAU;
  // Asymmetric thread profile: sharp negative groove, flat crest
  const tw = tri(phase);
  // Map so peaks are flat (~+0.4) and grooves dip hard
  return tw < 0 ? tw : tw * 0.4;
};

/**
 * Returns the radial delta in mm to add to the body radius at (t, theta).
 * Returns 0 when mode is off or amplitude is zero.
 */
export function getSkinPerturbation(
  t: number,
  theta: number,
  settings: SkinTextureSettings,
  ctx: SkinTextureContext = {}
): number {
  if (!settings || settings.mode === 'off') return 0;

  const amp = Math.min(Math.max(settings.amplitude, 0), AMP_HARD_CAP_MM);
  if (amp <= 0) return 0;

  if (t < settings.startHeightPct) return 0;
  if (t > 1 - settings.endHeightPct) return 0;

  const layerHeight = ctx.layerHeightMm ?? 0.2;
  const heightMm = ctx.heightMm ?? 100;
  const layerIdx = ctx.layerIdx ?? Math.floor((t * heightMm) / layerHeight);

  let raw = 0;
  switch (settings.mode) {
    case 'fuzz':     raw = fuzzDelta(theta, t, layerIdx, settings); break;
    case 'knurl':    raw = knurlDelta(theta, t, layerIdx, settings); break;
    case 'scales':   raw = scalesDelta(theta, t, layerIdx, settings); break;
    case 'ribs':     raw = ribsDelta(theta, t, layerIdx, settings); break;
    case 'brushed':  raw = brushedDelta(theta, t, layerIdx, settings); break;
    case 'pixel':    raw = pixelDelta(theta, t, layerIdx, settings); break;
    case 'hammered': raw = hammeredDelta(theta, t, layerIdx, settings); break;
    case 'threads':  raw = threadsDelta(theta, t, layerIdx, settings); break;
    default: return 0;
  }

  // Sharpen (skip for hammered/scales which are already shaped, and pixel which is already binary)
  if (settings.mode !== 'pixel' && settings.mode !== 'hammered' && settings.mode !== 'scales') {
    raw = sharpen(raw, settings.crispness);
  }

  // Directional bias for fuzz / pixel
  if (settings.mode === 'fuzz' || settings.mode === 'pixel') {
    if (settings.direction === 'outward') raw = (raw + 1) * 0.5;
    else if (settings.direction === 'inward') raw = (raw - 1) * 0.5;
  }

  return raw * amp;
}

/** Convenience: pull settings off ParametricParams. */
export function skinSettingsFromParams(params: ParametricParams): SkinTextureSettings {
  return {
    mode: params.skinTextureMode ?? 'off',
    amplitude: params.skinTextureAmplitude ?? 0,
    density: params.skinTextureDensity ?? 1,
    direction: params.skinTextureDirection ?? 'both',
    startHeightPct: params.skinTextureStartHeightPct ?? 0,
    endHeightPct: params.skinTextureEndHeightPct ?? 0,
    seed: params.skinTextureSeed ?? 1337,
    crispness: params.skinTextureCrispness ?? 0.7,
    threadPitch: params.skinTextureThreadPitch ?? 8,
  };
}
