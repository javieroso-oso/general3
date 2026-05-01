/**
 * Funky Skin — XY-only surface texture generator.
 *
 * Adds a radial perturbation (in mm) to the body wall as a function of
 * (theta, t, layerIdx, seed). All Z stays untouched, so output prints safely
 * on any planar FDM printer including the Bambu A1.
 *
 * Six modes share the same shape: `f(theta, t, seed) -> mm`. The output is
 * added to the radius at the end of `getBodyRadius`, so viewport, STL, and
 * G-code all pick it up automatically.
 */

import type { ParametricParams } from '@/types/parametric';

const TAU = Math.PI * 2;

// Cheap, deterministic, frame-stable pseudo-random in [-1, 1]
const hash3 = (a: number, b: number, c: number) => {
  const dot = a * 12.9898 + b * 78.233 + c * 37.719;
  return ((Math.sin(dot) * 43758.5453) % 1) * 2 - 1;
};

// 2D value noise on (u, v) with smoothstep interpolation, returns [-1, 1]
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
}

export interface SkinTextureContext {
  /** Layer index — optional. If omitted, derived from t and a default layer height. */
  layerIdx?: number;
  /** Approximate vertical resolution to use when layerIdx is missing (mm). */
  layerHeightMm?: number;
  /** Total body height in mm — used to map t back to a layer index. */
  heightMm?: number;
}

const AMP_HARD_CAP_MM = 0.8;

// === Per-mode pure functions: return delta in [-1, 1], scaled by amplitude later ===

const fuzzDelta = (theta: number, t: number, layerIdx: number, settings: SkinTextureSettings) => {
  // High-frequency hash; density acts as angular sample multiplier
  const angularBuckets = Math.max(8, Math.floor(64 * settings.density));
  const tBucket = Math.floor(theta / TAU * angularBuckets);
  return hash3(tBucket, layerIdx, settings.seed);
};

const knurlDelta = (theta: number, t: number, _layerIdx: number, settings: SkinTextureSettings) => {
  const count = Math.max(1, Math.round(8 * settings.density));
  const pitch = count * 0.6;
  const a = Math.sin(theta * count + t * Math.PI * pitch);
  const b = Math.sin(theta * count - t * Math.PI * pitch);
  return a * b; // diamond pattern, [-1, 1]
};

const scalesDelta = (theta: number, t: number, _layerIdx: number, settings: SkinTextureSettings) => {
  // Hex cell distance field in (theta, t) space
  const cellsAround = Math.max(4, Math.round(12 * settings.density));
  const cellsTall = Math.max(4, Math.round(20 * settings.density));
  const u = (theta / TAU) * cellsAround;
  const v = t * cellsTall + (Math.floor(u) % 2 === 0 ? 0 : 0.5); // brick offset
  const cu = u - Math.floor(u) - 0.5;
  const cv = v - Math.floor(v) - 0.5;
  const dist = Math.sqrt(cu * cu + cv * cv);
  // Cell center bumps outward, fades to zero at edge (radius ~0.5)
  const bump = Math.max(0, 1 - dist * 2);
  return bump * 2 - 1; // remap [0,1] -> [-1,1] so amplitude direction reads cleanly
};

const ribsDelta = (theta: number, _t: number, _layerIdx: number, settings: SkinTextureSettings) => {
  const count = Math.max(2, Math.round(20 * settings.density));
  return Math.cos(theta * count);
};

const brushedDelta = (theta: number, t: number, layerIdx: number, settings: SkinTextureSettings) => {
  // Anisotropic noise: high freq on Z, low on theta -> brushed grain
  const u = theta * 4 * settings.density;
  const v = layerIdx * 0.6 * settings.density;
  return valueNoise2D(u, v, settings.seed);
};

const pixelDelta = (theta: number, t: number, layerIdx: number, settings: SkinTextureSettings) => {
  const cellsAround = Math.max(4, Math.round(24 * settings.density));
  const layerStride = Math.max(1, Math.round(4 / Math.max(0.25, settings.density)));
  const tCell = Math.floor(theta / TAU * cellsAround);
  const lCell = Math.floor(layerIdx / layerStride);
  const h = hash3(tCell, lCell, settings.seed);
  // Quantize to {0, 0.5, 1} then remap to [-1, 1]
  const q = h < -0.33 ? 0 : h < 0.33 ? 0.5 : 1;
  return q * 2 - 1;
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

  // Range gate (skip top / bottom)
  if (t < settings.startHeightPct) return 0;
  if (t > 1 - settings.endHeightPct) return 0;

  // Resolve layer index for vertical patterns
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
    default: return 0;
  }

  // Apply directional bias for modes where it makes sense
  if (settings.mode === 'fuzz' || settings.mode === 'pixel') {
    if (settings.direction === 'outward') raw = (raw + 1) * 0.5;       // [0, 1]
    else if (settings.direction === 'inward') raw = (raw - 1) * 0.5;   // [-1, 0]
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
  };
}
