/**
 * Body Profile Generator
 * 
 * Shared utility that calculates the radius of the parametric body at any 
 * given height (t = 0..1) and angle (theta). This ensures consistent shape
 * calculation between ParametricMesh and mold-generator.
 */

import { ParametricParams, printConstraints } from '@/types/parametric';

// Deterministic noise for consistent results
const seededRandom = (x: number, y: number, z: number) => {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719;
  return (Math.sin(dot) * 43758.5453) % 1;
};

const noise3D = (x: number, y: number, z: number, scale: number) => {
  const sx = x * scale;
  const sy = y * scale;
  const sz = z * scale;
  
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const iz = Math.floor(sz);
  
  const fx = sx - ix;
  const fy = sy - iy;
  const fz = sz - iz;
  
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  
  const n000 = seededRandom(ix, iy, iz);
  const n100 = seededRandom(ix + 1, iy, iz);
  const n010 = seededRandom(ix, iy + 1, iz);
  const n110 = seededRandom(ix + 1, iy + 1, iz);
  const n001 = seededRandom(ix, iy, iz + 1);
  const n101 = seededRandom(ix + 1, iy, iz + 1);
  const n011 = seededRandom(ix, iy + 1, iz + 1);
  const n111 = seededRandom(ix + 1, iy + 1, iz + 1);
  
  const nx00 = n000 * (1 - ux) + n100 * ux;
  const nx10 = n010 * (1 - ux) + n110 * ux;
  const nx01 = n001 * (1 - ux) + n101 * ux;
  const nx11 = n011 * (1 - ux) + n111 * ux;
  
  const nxy0 = nx00 * (1 - uy) + nx10 * uy;
  const nxy1 = nx01 * (1 - uy) + nx11 * uy;
  
  return (nxy0 * (1 - uz) + nxy1 * uz) * 2 - 1;
};

export interface BodyProfileOptions {
  /** Scale factor (default: 1 for mm, use 0.01 for scene units) */
  scale?: number;
  /** Include twist in theta calculation */
  includeTwist?: boolean;
  /** Shape style for style-specific linear curves */
  objectType?: string;
}

/**
 * Calculate the body radius at a given height (t = 0..1) and angle (theta in radians).
 * This includes all parametric modifiers: profile curve, bulge, pinch, lip flare,
 * horizontal ribs, wobble, ripples, fluting, spiral grooves, asymmetry, and organic noise.
 * 
 * @param params - The parametric parameters
 * @param t - Height parameter (0 = bottom, 1 = top)
 * @param theta - Angular position in radians (0 to 2π)
 * @param options - Additional options for calculation
 * @returns Radius at the given position (in mm, or scaled if scale option is set)
 */
export function getBodyRadius(
  params: ParametricParams,
  t: number,
  theta: number,
  options: BodyProfileOptions = {}
): number {
  const {
    scale = 1,
    includeTwist = true,
    objectType = 'vase',
  } = options;

  const {
    baseRadius,
    topRadius,
    wallThickness,
    wobbleFrequency,
    wobbleAmplitude,
    twistAngle,
    bulgePosition,
    bulgeAmount,
    pinchAmount,
    asymmetry,
    rippleCount,
    rippleDepth,
    lipFlare,
    lipHeight,
    organicNoise,
    noiseScale,
    facetCount,
    facetSharpness,
    spiralGrooveCount,
    spiralGrooveDepth,
    spiralGrooveTwist,
    horizontalRibCount,
    horizontalRibDepth,
    horizontalRibWidth,
    flutingCount,
    flutingDepth,
    profileCurve,
  } = params;

  const roundness = (params as any).roundness ?? 0;
  const lobeCount = Math.max(1, Math.floor((params as any).lobeCount ?? 1));
  const lobeBlend = (params as any).lobeBlend ?? 0.5;
  const lobeSizeVariation = (params as any).lobeSizeVariation ?? 0;
  const lobeHeightVariation = (params as any).lobeHeightVariation ?? 0;
  const flatBottom = (params as any).flatBottom ?? true;
  const flatBottomHeight = Math.max(0, Math.min(0.25, (params as any).flatBottomHeight ?? 0.08));

  const bRad = baseRadius * scale;
  const tRad = topRadius * scale;
  const wall = wallThickness * scale;
  const height = params.height * scale;
  const y = t * height;

  // Base profile interpolation based on profileCurve
  let radius: number;
  const radiusDiff = tRad - bRad;
  
  switch (profileCurve) {
    case 'convex':
      radius = bRad + radiusDiff * t + Math.sin(t * Math.PI) * Math.abs(radiusDiff) * 0.3;
      break;
    case 'concave':
      radius = bRad + radiusDiff * t - Math.sin(t * Math.PI) * Math.abs(radiusDiff) * 0.3;
      break;
    case 'hourglass':
      radius = bRad + radiusDiff * t - Math.sin(t * Math.PI) * (bRad + tRad) * 0.15;
      break;
    case 'wave':
      radius = bRad + radiusDiff * t + Math.sin(t * Math.PI * 4) * bRad * 0.08;
      break;
    case 'linear':
    default:
      // Apply object-type specific curves on top of linear base
      if (objectType === 'lamp') {
        radius = bRad + (tRad - bRad) * Math.pow(t, 0.6);
      } else if (objectType === 'sculpture') {
        const curve = Math.sin(t * Math.PI);
        radius = bRad * (1 - t * 0.3) + tRad * t * 0.7 + curve * bRad * 0.2;
      } else {
        const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
        radius = bRad * (1 - t * 0.4) + tRad * t * 0.6 + curve * bRad * 0.12;
      }
      break;
  }

  // Capture the linear/profile-curve baseline BEFORE roundness/lobes shaping.
  // Used by the flat-bottom blend to keep the base printable.
  const baselineRadius = radius;

  // Roundness — superellipse envelope blended with the linear profile.
  // Interpolates the body shape between cylinder (0) and pill/sphere (1).
  if (roundness > 0) {
    const u = Math.abs(2 * t - 1);
    const n = 2;
    const envelope = Math.pow(Math.max(0, 1 - Math.pow(u, n)), 1 / n);
    const avgRad = (bRad + tRad) * 0.5;
    const sphereRadius = avgRad * envelope;
    radius = radius * (1 - roundness) + sphereRadius * roundness;
  }

  // Smooth-blended lobes — stack `lobeCount` ellipsoid radial fields along the
  // height and combine with a quadratic smooth-max so neighbors fuse smoothly.
  if (lobeCount >= 2) {
    const avgRad = (bRad + tRad) * 0.5;
    const smax = (a: number, b: number, k: number): number => {
      if (k <= 0.0001) return Math.max(a, b);
      const h = Math.max(k - Math.abs(a - b), 0) / k;
      return Math.max(a, b) + h * h * k * 0.25;
    };
    const jitter = (i: number) => {
      const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1;
    };
    const k = Math.max(0.05, lobeBlend) * avgRad * 1.2;
    let combined = -Infinity;
    for (let i = 0; i < lobeCount; i++) {
      const baseCenter = (i + 0.5) / lobeCount;
      const center = Math.min(0.95, Math.max(0.05,
        baseCenter + jitter(i + 1) * lobeHeightVariation * (0.5 / lobeCount)
      ));
      const sizeJ = 1 + jitter(i + 7) * lobeSizeVariation * 0.4;
      const halfHeight = (0.5 / lobeCount) * 1.4;
      const dy = (t - center) / halfHeight;
      const inside = 1 - dy * dy;
      const lobeR = inside > 0 ? avgRad * sizeJ * Math.sqrt(inside) : -avgRad * 0.5;
      combined = smax(combined, lobeR, k);
    }
    const lobeWeight = Math.min(1, 0.4 + lobeBlend * 0.6);
    radius = radius * (1 - lobeWeight) + Math.max(combined, bRad * 0.3) * lobeWeight;
  }

  // Flat bottom — blend the shaped radius back to the linear baseline near t=0
  // so the object sits flat on the print bed even with high roundness/low lobes.
  if (flatBottom && flatBottomHeight > 0 && t < flatBottomHeight) {
    const x = t / flatBottomHeight;
    // smoothstep: 1 at t=0 → 0 at t=flatBottomHeight
    const w = 1 - (x * x * (3 - 2 * x));
    radius = radius * (1 - w) + baselineRadius * w;
  }

  // Organic bulge
  const bulgeDist = Math.abs(t - bulgePosition);
  radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * bRad;

  // Pinch effect
  const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
  const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
  radius *= (1 - pinchTop - pinchBottom);

  // Lip flare
  if (lipHeight > 0 && lipFlare !== 0) {
    const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
    radius += lipT * lipT * lipFlare * bRad;
  }
  
  // Horizontal ribs (sinusoidal modulation based on height)
  if (horizontalRibCount > 0 && horizontalRibDepth > 0) {
    const ribPhase = t * horizontalRibCount * Math.PI * 2;
    const ribWave = Math.sin(ribPhase);
    const sharpness = 1 / horizontalRibWidth;
    const ribModifier = Math.pow(Math.abs(ribWave), sharpness) * Math.sign(ribWave);
    radius += ribModifier * horizontalRibDepth * bRad;
  }

  radius = Math.max(radius, printConstraints.minBaseRadius * scale * 0.5);

  // Apply twist to theta if enabled
  const twistRad = includeTwist ? (twistAngle * Math.PI / 180) * t : 0;
  let effectiveTheta = theta + twistRad;

  // Faceting
  if (facetCount > 0 && facetCount >= 3) {
    const facetAngle = (Math.PI * 2) / facetCount;
    const facetIndex = Math.floor(effectiveTheta / facetAngle + 0.5);
    const snappedTheta = facetIndex * facetAngle;
    effectiveTheta = theta + (snappedTheta - theta) * facetSharpness + twistRad;
  }

  let r = radius;

  // Wobble
  if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
    const maxWobble = Math.min(wobbleAmplitude, 0.15);
    r += Math.sin(t * Math.PI * 2 * wobbleFrequency + effectiveTheta * 2) * maxWobble * bRad;
  }

  // Ripples (angular)
  if (rippleCount > 0 && rippleDepth > 0) {
    const maxRipple = Math.min(rippleDepth, 0.1);
    r += Math.sin(effectiveTheta * rippleCount) * maxRipple * bRad;
  }
  
  // Fluting (vertical grooves like classical columns)
  if (flutingCount > 0 && flutingDepth > 0) {
    const fluteAngle = effectiveTheta * flutingCount;
    const fluteWave = Math.cos(fluteAngle);
    if (fluteWave < 0) {
      r += fluteWave * flutingDepth * bRad;
    }
  }
  
  // Spiral grooves (combine height and angle)
  if (spiralGrooveCount > 0 && spiralGrooveDepth > 0) {
    const spiralAngle = effectiveTheta + t * spiralGrooveTwist * Math.PI * 2;
    const spiralWave = Math.sin(spiralAngle * spiralGrooveCount);
    if (spiralWave < 0) {
      r += spiralWave * spiralGrooveDepth * bRad;
    }
  }

  // Asymmetry
  if (asymmetry > 0) {
    const primaryWave = Math.sin(effectiveTheta) * Math.cos(t * Math.PI) * asymmetry * bRad;
    const secondaryWave = Math.sin(effectiveTheta * 2 + t * Math.PI * 3) * asymmetry * 0.5 * bRad;
    const lean = Math.cos(effectiveTheta) * t * asymmetry * 0.4 * bRad;
    r += primaryWave + secondaryWave + lean;
  }

  // Organic noise
  // IMPORTANT: Noise coordinates are ALWAYS in scene units (scale=0.01) for consistency
  // between preview and export. This ensures the same noise pattern regardless of output scale.
  if (organicNoise > 0) {
    const maxNoise = Math.min(organicNoise, 0.1);
    // Convert to scene units for noise sampling (if scale != 0.01, normalize)
    const sceneScale = 0.01; // Target scene unit scale
    const normalizer = sceneScale / scale; // Convert current scale to scene units
    const nx = Math.cos(effectiveTheta) * r * normalizer;
    const ny = y * normalizer;
    const nz = Math.sin(effectiveTheta) * r * normalizer;
    r += noise3D(nx * 10, ny * 10, nz * 10, noiseScale) * maxNoise * bRad;
  }

  r = Math.max(r, wall * 2);

  return r;
}

/**
 * Sample the body profile at multiple heights and angles.
 * Returns a 2D array of radii: radii[heightIndex][angleIndex]
 * 
 * @param params - The parametric parameters
 * @param heightSegments - Number of height samples
 * @param angleSegments - Number of angle samples
 * @param options - Additional options for calculation
 * @returns 2D array of radii
 */
export function sampleBodyProfile(
  params: ParametricParams,
  heightSegments: number = 64,
  angleSegments: number = 64,
  options: BodyProfileOptions = {}
): number[][] {
  const radii: number[][] = [];
  
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const ringRadii: number[] = [];
    
    for (let j = 0; j <= angleSegments; j++) {
      const theta = (j / angleSegments) * Math.PI * 2;
      ringRadii.push(getBodyRadius(params, t, theta, options));
    }
    
    radii.push(ringRadii);
  }
  
  return radii;
}

/**
 * Find the maximum radius of the body across all heights and angles.
 * 
 * @param params - The parametric parameters
 * @param options - Additional options for calculation
 * @returns Maximum radius found
 */
export function getMaxBodyRadius(
  params: ParametricParams,
  options: BodyProfileOptions = {}
): number {
  let maxRadius = 0;
  
  for (let t = 0; t <= 1; t += 0.02) {
    for (let theta = 0; theta < Math.PI * 2; theta += 0.1) {
      const r = getBodyRadius(params, t, theta, options);
      if (r > maxRadius) maxRadius = r;
    }
  }
  
  return maxRadius;
}
