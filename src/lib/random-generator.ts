import { ParametricParams } from '@/types/parametric';

type ProfileCurveType = 'linear' | 'convex' | 'concave' | 'hourglass' | 'wave';
const profileCurves: ProfileCurveType[] = ['linear', 'convex', 'concave', 'hourglass', 'wave'];

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBool(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

export function generateRandomParams(currentParams: ParametricParams): ParametricParams {
  // Start with current params to preserve leg/stand/print settings
  const newParams = { ...currentParams };

  // ============================================
  // CORE SHAPE
  // ============================================
  newParams.baseRadius = randomInRange(20, 60);
  newParams.topRadius = newParams.baseRadius * randomInRange(0.4, 1.4);
  newParams.height = newParams.baseRadius * randomInRange(1.5, 4);
  newParams.profileCurve = randomChoice(profileCurves);
  newParams.wallThickness = randomInRange(1.5, 3.5);

  // ============================================
  // ORGANIC SHAPE
  // ============================================
  newParams.bulgePosition = randomInRange(0.2, 0.8);
  newParams.bulgeAmount = randomInRange(0, 0.25);
  newParams.pinchAmount = randomInRange(0, 0.15);
  newParams.asymmetry = randomInRange(0, 0.12);

  // ============================================
  // DEFORMATIONS
  // ============================================
  newParams.twistAngle = randomInRange(0, 45);
  newParams.wobbleFrequency = randomInt(0, 4);
  newParams.wobbleAmplitude = randomInRange(0, 0.08);

  // ============================================
  // SPINE CURVE (20% chance to enable)
  // ============================================
  if (randomBool(0.2)) {
    newParams.spineEnabled = true;
    newParams.spineAmplitudeX = randomInRange(2, 8);
    newParams.spineAmplitudeZ = randomInRange(2, 8);
    newParams.spineFrequencyX = randomInRange(1, 2);
    newParams.spineFrequencyZ = randomInRange(1, 2);
    newParams.spinePhaseX = randomInRange(0, 1);
    newParams.spinePhaseZ = randomInRange(0, 1);
  } else {
    newParams.spineEnabled = false;
    newParams.spineAmplitudeX = 0;
    newParams.spineAmplitudeZ = 0;
  }

  // ============================================
  // MELT EFFECT (15% chance to enable)
  // ============================================
  if (randomBool(0.15)) {
    newParams.meltAmount = randomInRange(5, 15);
    newParams.meltLobes = randomInt(3, 5);
    newParams.meltVariation = randomInRange(0.2, 0.5);
    newParams.meltPhase = randomInRange(0, 1);
    newParams.meltDelay = randomInRange(0, 0.3);
    // 50% chance for lateral drag when melt is enabled
    if (randomBool(0.5)) {
      newParams.meltDragAmount = randomInRange(5, 12);
      newParams.meltDragAngle = randomInRange(0, 1);
    } else {
      newParams.meltDragAmount = 0;
    }
  } else {
    newParams.meltAmount = 0;
    newParams.meltDragAmount = 0;
  }

  // ============================================
  // SURFACE FEATURES (0-2 features enabled)
  // ============================================
  const surfaceFeatures = ['facets', 'spiralGrooves', 'horizontalRibs', 'fluting', 'rimWaves', 'ripples'] as const;
  const enabledFeatures = new Set<string>();
  const featureCount = randomInt(0, 2);
  
  while (enabledFeatures.size < featureCount) {
    enabledFeatures.add(randomChoice([...surfaceFeatures]));
  }

  // Reset all surface features first
  newParams.facetCount = 0;
  newParams.spiralGrooveCount = 0;
  newParams.spiralGrooveDepth = 0;
  newParams.horizontalRibCount = 0;
  newParams.horizontalRibDepth = 0;
  newParams.flutingCount = 0;
  newParams.flutingDepth = 0;
  newParams.rimWaveCount = 0;
  newParams.rimWaveDepth = 0;
  newParams.rippleCount = 0;
  newParams.rippleDepth = 0;

  // Enable selected features with corrected ranges matching slider maxes
  if (enabledFeatures.has('facets')) {
    newParams.facetCount = randomInt(5, 10);
    newParams.facetSharpness = randomInRange(0.3, 0.9);
  }
  if (enabledFeatures.has('spiralGrooves')) {
    newParams.spiralGrooveCount = randomInt(2, 6);
    newParams.spiralGrooveDepth = randomInRange(0.02, 0.1);
    newParams.spiralGrooveTwist = randomInRange(1, 5);
  }
  if (enabledFeatures.has('horizontalRibs')) {
    newParams.horizontalRibCount = randomInt(3, 10);
    newParams.horizontalRibDepth = randomInRange(0.01, 0.06);
    newParams.horizontalRibWidth = randomInRange(0.2, 0.4);
  }
  if (enabledFeatures.has('fluting')) {
    newParams.flutingCount = randomInt(5, 16);
    newParams.flutingDepth = randomInRange(0.02, 0.1);
  }
  if (enabledFeatures.has('rimWaves')) {
    newParams.rimWaveCount = randomInt(4, 8);
    newParams.rimWaveDepth = randomInRange(0.03, 0.10);
  }
  if (enabledFeatures.has('ripples')) {
    newParams.rippleCount = randomInt(3, 10);
    newParams.rippleDepth = randomInRange(0.02, 0.06);
  }

  // ============================================
  // ORGANIC NOISE (20% chance)
  // ============================================
  if (randomBool(0.2)) {
    newParams.organicNoise = randomInRange(0.005, 0.03);
    newParams.noiseScale = randomInRange(0.5, 2.5);
  } else {
    newParams.organicNoise = 0;
    newParams.noiseScale = 1;
  }

  // ============================================
  // LIP & RIM
  // ============================================
  newParams.lipFlare = randomInRange(0, 0.15);
  newParams.lipHeight = newParams.height * randomInRange(0, 0.05);

  // ============================================
  // LIGHT PATTERNS (preserve current settings)
  // ============================================
  // Light patterns are intentionally preserved from current params
  // to avoid random changes affecting a carefully designed perforation
  // User can manually enable/disable and configure

  return newParams;
}
