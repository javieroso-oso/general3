/**
 * Base Stroke Height Field
 *
 * Builds a 2D height field from BaseStrokes for displacing the floor of the
 * body. Coordinates are in real mm (centered on origin). Each stroke is a
 * polyline with thickness (mm) and height (mm); the field returns the max
 * stroke height at any (x, z) point, falling off smoothly across the half-
 * thickness so edges are rounded.
 */

import { BaseStroke, ParametricParams } from '@/types/parametric';

export interface BaseStrokeField {
  // Returns rib height in mm at world (x, z) coords (origin = base center)
  sample: (x: number, z: number) => number;
  // True bounds expanded by strokeMaxThickness/2
  hasAny: boolean;
}

interface PreparedSegment {
  ax: number; az: number; bx: number; bz: number;
  // Pre-computed for distance-to-segment
  dx: number; dz: number; len2: number;
  halfW: number;        // half thickness in mm
  height: number;       // rib height in mm
  // Bounding box (expanded by halfW)
  minX: number; maxX: number; minZ: number; maxZ: number;
}

/**
 * Builds a sampler over all base strokes.
 *
 * Stroke point coords are normalized to [-1..1] of baseRadius, so we convert
 * to mm using baseRadius. The resulting field lives in body-space (y-up scene,
 * x/z plane on the floor).
 *
 * NOTE: stroke.points uses a {x, y} 2D Cartesian system (BaseCanvas top-down
 * view). We map: world x = stroke.x * baseRadius, world z = -stroke.y * baseRadius
 * (negate y so screen-up maps to scene -z, matching what the user sees in the
 * top-down preview).
 */
export function buildBaseStrokeField(params: ParametricParams): BaseStrokeField {
  const strokes = params.baseStrokes ?? [];
  const baseR = params.baseRadius;

  const segments: PreparedSegment[] = [];

  for (const s of strokes) {
    if (!s.points || s.points.length < 2) continue;
    const halfW = s.thickness * 0.5;
    const height = s.height;
    for (let i = 0; i < s.points.length - 1; i++) {
      const ax = s.points[i].x * baseR;
      const az = -s.points[i].y * baseR;
      const bx = s.points[i + 1].x * baseR;
      const bz = -s.points[i + 1].y * baseR;
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz;
      if (len2 === 0) continue;
      segments.push({
        ax, az, bx, bz, dx, dz, len2, halfW, height,
        minX: Math.min(ax, bx) - halfW,
        maxX: Math.max(ax, bx) + halfW,
        minZ: Math.min(az, bz) - halfW,
        maxZ: Math.max(az, bz) + halfW,
      });
    }
  }

  const sample = (x: number, z: number): number => {
    let h = 0;
    for (const s of segments) {
      if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
      // Distance from (x,z) to segment (ax,az)-(bx,bz)
      const px = x - s.ax;
      const pz = z - s.az;
      let t = (px * s.dx + pz * s.dz) / s.len2;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const cx = s.ax + s.dx * t;
      const cz = s.az + s.dz * t;
      const ex = x - cx;
      const ez = z - cz;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist >= s.halfW) continue;
      // Smooth falloff: cosine taper from full height at center to 0 at edge
      const k = 1 - dist / s.halfW;
      // Cosine ease for a rounded crown
      const eased = 0.5 - 0.5 * Math.cos(k * Math.PI);
      const contrib = s.height * eased;
      if (contrib > h) h = contrib;
    }
    return h;
  };

  return { sample, hasAny: segments.length > 0 };
}
