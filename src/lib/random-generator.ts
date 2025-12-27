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

  // Core shape - expanded ranges for more variety
  newParams.baseRadius = randomInRange(20, 60);
  // Make topRadius relative to baseRadius (40-140% of base)
  newParams.topRadius = newParams.baseRadius * randomInRange(0.4, 1.4);
  // Height proportional to base (1.5x to 4x base radius)
  newParams.height = newParams.baseRadius * randomInRange(1.5, 4);
  newParams.profileCurve = randomChoice(profileCurves);

  // Organic deformations - more noticeable effects
  newParams.bulgePosition = randomInRange(0.2, 0.8);
  newParams.bulgeAmount = randomInRange(0, 0.25);
  newParams.pinchAmount = randomInRange(0, 0.15);
  newParams.wobbleFrequency = randomInt(0, 4);
  newParams.wobbleAmplitude = randomInRange(0, 0.08);
  newParams.twistAngle = randomInRange(0, 45);
  newParams.asymmetry = randomInRange(0, 0.12);

  // Lip parameters - more variety
  newParams.lipFlare = randomInRange(0, 0.15);
  newParams.lipHeight = newParams.height * randomInRange(0, 0.05);

  // Surface details - allow 0-2 features
  const surfaceFeatures = ['facets', 'spiralGrooves', 'horizontalRibs', 'fluting', 'rimWaves'] as const;
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

  // Enable selected features with corrected ranges matching slider maxes
  if (enabledFeatures.has('facets')) {
    newParams.facetCount = randomInt(5, 10);
  }
  if (enabledFeatures.has('spiralGrooves')) {
    newParams.spiralGrooveCount = randomInt(2, 6);
    newParams.spiralGrooveDepth = randomInRange(0.02, 0.1); // Fixed: was 0.2-0.8, slider max is 0.15
  }
  if (enabledFeatures.has('horizontalRibs')) {
    newParams.horizontalRibCount = randomInt(3, 10);
    newParams.horizontalRibDepth = randomInRange(0.01, 0.06); // Fixed: was 0.2-0.5, slider max is 0.1
  }
  if (enabledFeatures.has('fluting')) {
    newParams.flutingCount = randomInt(5, 16);
    newParams.flutingDepth = randomInRange(0.02, 0.1); // Fixed: was 0.2-0.8, slider max is 0.15
  }
  if (enabledFeatures.has('rimWaves')) {
    newParams.rimWaveCount = randomInt(3, 9);
    newParams.rimWaveDepth = randomInRange(0.03, 0.18);
  }

  // Higher chance for organic noise with wider range
  if (randomBool(0.2)) {
    newParams.organicNoise = randomInRange(0.005, 0.03);
    newParams.noiseScale = randomInRange(0.5, 2.5);
  } else {
    newParams.organicNoise = 0;
    newParams.noiseScale = 1;
  }

  return newParams;
}
