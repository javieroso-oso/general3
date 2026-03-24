/**
 * Surface Unwrap
 * 
 * Calculates the "unfolded" profile of a parametric body so that
 * the 2D drawing canvas can display the real shape of the surface.
 * The width at each height t is proportional to the circumference C(t) = 2πr(t).
 */

import { ParametricParams } from '@/types/parametric';
import { getBodyRadius } from '@/lib/body-profile-generator';

export interface UnwrapSample {
  t: number;           // 0..1 height fraction
  widthFraction: number; // 0..1 relative to max circumference
  radius: number;       // raw radius at this height
}

/**
 * Sample the body radius at N heights and return the normalised width fraction
 * at each height.  widthFraction = C(t) / C_max = r(t) / r_max.
 */
export function getUnwrapProfile(
  params: ParametricParams,
  sampleCount = 100,
): UnwrapSample[] {
  const samples: UnwrapSample[] = [];
  let maxR = 0;

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const r = getBodyRadius(params, t, 0, { scale: 1, includeTwist: false });
    samples.push({ t, widthFraction: 0, radius: r });
    if (r > maxR) maxR = r;
  }

  if (maxR === 0) {
    return samples.map(s => ({ ...s, widthFraction: 1 }));
  }

  for (const s of samples) {
    s.widthFraction = s.radius / maxR;
  }

  return samples;
}

/**
 * Given an unwrap profile, interpolate the widthFraction at an arbitrary v (0..1).
 */
export function interpolateWidthFraction(profile: UnwrapSample[], v: number): number {
  if (profile.length === 0) return 1;
  const clamped = Math.max(0, Math.min(1, v));
  const idx = clamped * (profile.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, profile.length - 1);
  const frac = idx - lo;
  return profile[lo].widthFraction * (1 - frac) + profile[hi].widthFraction * frac;
}

/**
 * Convert canvas-space U (0..1 within the visible unwrap shape) to real UV U (0..1 around full circumference).
 * 
 * In the unwrap canvas the drawable width at height v is widthFraction(v) * canvasWidth.
 * The left edge of the drawable area starts at x = (1 - wf) / 2 * canvasWidth.
 * So if the user draws at normalised x position `uCanvas` (0..1 of full canvas width):
 *   uReal = (uCanvas - leftMargin) / widthFraction
 * 
 * We clamp to [0,1] since strokes outside the shape shouldn't wrap oddly.
 */
export function canvasUToRealU(uCanvas: number, widthFraction: number): number {
  const margin = (1 - widthFraction) / 2;
  if (widthFraction <= 0) return 0.5;
  const uReal = (uCanvas - margin) / widthFraction;
  return Math.max(0, Math.min(1, uReal));
}

/**
 * Build a SVG/canvas clip-path string (polygon points) for the unwrap shape.
 * Returns an array of {x, y} in canvas pixel coordinates.
 */
export function getUnwrapClipPath(
  profile: UnwrapSample[],
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  // Right edge (top to bottom)
  for (let i = profile.length - 1; i >= 0; i--) {
    const wf = profile[i].widthFraction;
    const x = (1 + wf) / 2 * canvasWidth;
    const y = (1 - profile[i].t) * canvasHeight;
    points.push({ x, y });
  }

  // Left edge (bottom to top)
  for (let i = 0; i < profile.length; i++) {
    const wf = profile[i].widthFraction;
    const x = (1 - wf) / 2 * canvasWidth;
    const y = (1 - profile[i].t) * canvasHeight;
    points.push({ x, y });
  }

  return points;
}
