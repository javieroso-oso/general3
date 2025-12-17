import { ParametricParams, printConstraints } from '@/types/parametric';

// Maximum overhang angle without supports (in degrees)
const MAX_OVERHANG_ANGLE = 45;

/**
 * Calculate the maximum top radius at a given height to maintain support-free printing
 * Based on 45° overhang limit
 */
export function getMaxTopRadius(baseRadius: number, height: number): number {
  // At 45°, the radius can increase by at most height/tan(45°) = height
  return baseRadius + height;
}

/**
 * Calculate the minimum top radius at a given height to maintain support-free printing
 * For inward tapers, the same 45° rule applies
 */
export function getMinTopRadius(baseRadius: number, height: number): number {
  // Can decrease by at most height (45° inward slope is ok)
  return Math.max(5, baseRadius - height);
}

/**
 * Calculate maximum deformation amplitude to stay within overhang limits
 */
export function getMaxDeformationAmplitude(
  baseRadius: number,
  height: number,
  t: number // position along height (0-1)
): number {
  // More conservative deformation at higher positions
  // and where profile is already changing rapidly
  const heightFactor = 1 - t * 0.5; // Less deformation allowed at top
  const maxAmplitude = height * 0.02 * heightFactor; // ~2% of height
  return Math.min(maxAmplitude, baseRadius * 0.1);
}

/**
 * Calculate overhang angle at a given position
 */
export function getOverhangAngle(
  radiusBelow: number,
  radiusAbove: number,
  layerHeight: number
): number {
  const radiusDiff = radiusAbove - radiusBelow;
  if (radiusDiff <= 0) return 0; // No overhang if radius is decreasing or same
  
  const angle = Math.atan2(radiusDiff, layerHeight) * (180 / Math.PI);
  return angle;
}

/**
 * Check if parameters are support-free compliant
 */
export function checkSupportFreeCompliance(params: ParametricParams): {
  isCompliant: boolean;
  issues: string[];
  maxOverhang: number;
} {
  const issues: string[] = [];
  let maxOverhang = 0;
  
  // Check basic radius relationship
  const radiusDiff = params.topRadius - params.baseRadius;
  const baseOverhang = Math.atan2(Math.abs(radiusDiff), params.height) * (180 / Math.PI);
  maxOverhang = Math.max(maxOverhang, baseOverhang);
  
  if (baseOverhang > MAX_OVERHANG_ANGLE) {
    issues.push(`Base profile overhang: ${baseOverhang.toFixed(1)}° exceeds ${MAX_OVERHANG_ANGLE}°`);
  }
  
  // Check bulge contribution
  if (params.bulgeAmount > 0) {
    // Bulge creates localized overhangs
    const bulgeOverhang = params.bulgeAmount * 60; // Approximation
    maxOverhang = Math.max(maxOverhang, bulgeOverhang);
    if (bulgeOverhang > MAX_OVERHANG_ANGLE) {
      issues.push(`Bulge creates overhang of ~${bulgeOverhang.toFixed(0)}°`);
    }
  }
  
  // Check wobble contribution
  if (params.wobbleAmplitude > 0 && params.wobbleFrequency > 0) {
    const wobbleOverhang = params.wobbleAmplitude * 100 * params.wobbleFrequency * 0.5;
    maxOverhang = Math.max(maxOverhang, wobbleOverhang);
    if (wobbleOverhang > MAX_OVERHANG_ANGLE) {
      issues.push(`Wobble creates overhangs of ~${wobbleOverhang.toFixed(0)}°`);
    }
  }
  
  // Check lip flare
  if (params.lipFlare > 0) {
    const lipOverhang = params.lipFlare * 200; // Lip flares create steep overhangs
    maxOverhang = Math.max(maxOverhang, lipOverhang);
    if (lipOverhang > MAX_OVERHANG_ANGLE) {
      issues.push(`Lip flare creates overhang of ~${lipOverhang.toFixed(0)}°`);
    }
  }
  
  return {
    isCompliant: issues.length === 0,
    issues,
    maxOverhang,
  };
}

/**
 * Get support-free constrained limits for each parameter
 */
export function getSupportFreeConstraints(params: ParametricParams): {
  topRadius: { min: number; max: number };
  bulgeAmount: { max: number };
  wobbleAmplitude: { max: number };
  lipFlare: { max: number };
  asymmetry: { max: number };
} {
  const { baseRadius, height } = params;
  
  // Top radius: must maintain <45° angle from base
  const maxTopRadius = getMaxTopRadius(baseRadius, height);
  const minTopRadius = getMinTopRadius(baseRadius, height);
  
  // Bulge: limited to prevent steep local overhangs
  // At 45° max, bulge can be about height * tan(45°) / baseRadius / 4 ≈ 0.25 * h/r
  const maxBulge = Math.min(0.3, (height / baseRadius) * 0.15);
  
  // Wobble: limited based on frequency (higher freq = steeper local changes)
  const maxWobble = 0.15 / Math.max(1, params.wobbleFrequency * 0.5);
  
  // Lip flare: very limited as it creates steep overhangs
  const maxLipFlare = 0.1;
  
  // Asymmetry: moderate limit
  const maxAsymmetry = 0.06;
  
  return {
    topRadius: { min: minTopRadius, max: maxTopRadius },
    bulgeAmount: { max: maxBulge },
    wobbleAmplitude: { max: maxWobble },
    lipFlare: { max: maxLipFlare },
    asymmetry: { max: maxAsymmetry },
  };
}

/**
 * Apply support-free constraints to parameters, clamping values as needed
 */
export function applySupportFreeConstraints(params: ParametricParams): ParametricParams {
  const constraints = getSupportFreeConstraints(params);
  
  return {
    ...params,
    topRadius: Math.max(constraints.topRadius.min, Math.min(constraints.topRadius.max, params.topRadius)),
    bulgeAmount: Math.min(constraints.bulgeAmount.max, params.bulgeAmount),
    wobbleAmplitude: Math.min(constraints.wobbleAmplitude.max, params.wobbleAmplitude),
    lipFlare: Math.min(constraints.lipFlare.max, params.lipFlare),
    asymmetry: Math.min(constraints.asymmetry.max, params.asymmetry),
  };
}

/**
 * Analyze overhang angles at multiple points along the object height
 * Returns array of { t, angle } for visualization
 */
export function analyzeOverhangs(params: ParametricParams, segments: number = 32): Array<{ t: number; angle: number }> {
  const results: Array<{ t: number; angle: number }> = [];
  const { height, baseRadius, topRadius, bulgePosition, bulgeAmount, lipFlare, lipHeight } = params;
  
  let prevRadius = baseRadius;
  
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const y = t * height;
    const layerHeight = height / segments;
    
    // Calculate radius at this height (simplified version of mesh generation)
    let radius = baseRadius + (topRadius - baseRadius) * t;
    
    // Add bulge effect
    const bulgeDist = Math.abs(t - bulgePosition);
    radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;
    
    // Add lip flare
    const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
    radius += lipT * lipT * lipFlare * baseRadius;
    
    const overhangAngle = getOverhangAngle(prevRadius, radius, layerHeight);
    results.push({ t, angle: overhangAngle });
    
    prevRadius = radius;
  }
  
  return results;
}

/**
 * Get color for overhang angle visualization
 */
export function getOverhangColor(angle: number): string {
  if (angle <= 30) return '#22c55e'; // Green - safe
  if (angle <= 40) return '#eab308'; // Yellow - caution
  if (angle <= 45) return '#f97316'; // Orange - at limit
  return '#ef4444'; // Red - needs support
}

/**
 * Get vertex colors array for overhang visualization in mesh
 */
export function getOverhangVertexColors(
  params: ParametricParams,
  heightSegments: number,
  radialSegments: number
): Float32Array {
  const overhangs = analyzeOverhangs(params, heightSegments);
  const numVertices = (heightSegments + 1) * (radialSegments + 1);
  const colors = new Float32Array(numVertices * 3);
  
  for (let i = 0; i <= heightSegments; i++) {
    const angle = i === 0 ? 0 : overhangs[i - 1]?.angle || 0;
    
    // Convert hex color to RGB
    const hexColor = getOverhangColor(angle);
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    
    for (let j = 0; j <= radialSegments; j++) {
      const idx = (i * (radialSegments + 1) + j) * 3;
      colors[idx] = r;
      colors[idx + 1] = g;
      colors[idx + 2] = b;
    }
  }
  
  return colors;
}
