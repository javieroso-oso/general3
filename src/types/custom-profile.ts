// Custom profile types for drawing/image to 3D conversion

export interface ProfilePoint {
  x: number;  // Distance from center axis (mm)
  y: number;  // Height (mm)
  c1x?: number;  // Bezier control point 1 x
  c1y?: number;  // Bezier control point 1 y
  c2x?: number;  // Bezier control point 2 x
  c2y?: number;  // Bezier control point 2 y
}

export interface CustomProfile {
  id: string;
  name: string;
  points: ProfilePoint[];
  settings: ProfileSettings;
  createdAt: Date;
}

export interface ProfileSettings {
  wallThickness: number;  // mm
  segments: number;       // Number of segments around axis
  smoothing: number;      // 0-1, amount of bezier smoothing
  baseThickness: number;  // mm
  scale: number;          // Scale factor for the profile
}

export const defaultProfileSettings: ProfileSettings = {
  wallThickness: 2,
  segments: 64,
  smoothing: 0.5,
  baseThickness: 2,
  scale: 1,
};

export interface ProfileValidation {
  isValid: boolean;
  warnings: ProfileWarning[];
  minRadius: number;
  maxRadius: number;
  height: number;
  estimatedVolume: number;
}

export interface ProfileWarning {
  type: 'error' | 'warning' | 'info';
  message: string;
  pointIndex?: number;
}

// Validate profile for printability
export function validateProfile(
  points: ProfilePoint[],
  settings: ProfileSettings
): ProfileValidation {
  const warnings: ProfileWarning[] = [];
  
  if (points.length < 2) {
    return {
      isValid: false,
      warnings: [{ type: 'error', message: 'Profile needs at least 2 points' }],
      minRadius: 0,
      maxRadius: 0,
      height: 0,
      estimatedVolume: 0,
    };
  }

  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);
  const minRadius = Math.min(...xValues);
  const maxRadius = Math.max(...xValues);
  const height = Math.max(...yValues) - Math.min(...yValues);

  // Check minimum wall thickness
  if (settings.wallThickness < 1.2) {
    warnings.push({
      type: 'warning',
      message: 'Wall thickness below 1.2mm may be fragile',
    });
  }

  // Check for very thin sections
  if (minRadius < 3) {
    warnings.push({
      type: 'warning',
      message: 'Very narrow profile section may be difficult to print',
    });
  }

  // Check overhang angles
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (dy !== 0) {
      const angle = Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
      if (angle > 45 && dx < 0) {
        warnings.push({
          type: 'warning',
          message: `Steep overhang (${angle.toFixed(0)}°) at point ${i} may need supports`,
          pointIndex: i,
        });
      }
    }
  }

  // Check height constraints
  if (height > 300) {
    warnings.push({
      type: 'warning',
      message: 'Height exceeds 300mm, may exceed print bed limits',
    });
  }

  // Estimate volume (rough calculation)
  let volume = 0;
  for (let i = 1; i < points.length; i++) {
    const r1 = points[i - 1].x;
    const r2 = points[i].x;
    const h = Math.abs(points[i].y - points[i - 1].y);
    // Volume of frustum
    volume += (Math.PI * h / 3) * (r1 * r1 + r1 * r2 + r2 * r2);
  }

  return {
    isValid: warnings.filter(w => w.type === 'error').length === 0,
    warnings,
    minRadius,
    maxRadius,
    height,
    estimatedVolume: volume,
  };
}
