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

  // Core shape - randomize within sensible ranges
  newParams.height = randomInRange(60, 180);
  newParams.baseRadius = randomInRange(20, 55);
  newParams.topRadius = randomInRange(15, 70);
  newParams.profileCurve = randomChoice(profileCurves);

  // Organic deformations
  newParams.bulgePosition = randomInRange(0.2, 0.8);
  newParams.bulgeAmount = randomInRange(0, 0.4);
  newParams.pinchAmount = randomInRange(0, 0.3);
  newParams.wobbleFrequency = randomInt(0, 6);
  newParams.wobbleAmplitude = randomInRange(0, 0.15);
  newParams.twistAngle = randomInRange(0, 90);
  newParams.asymmetry = randomInRange(0, 0.2);

  // Lip parameters
  newParams.lipFlare = randomInRange(0, 0.3);
  newParams.lipHeight = randomInRange(0, 15);

  // Surface details - randomly enable 0-2 features
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

  // Enable selected features with random values
  if (enabledFeatures.has('facets')) {
    newParams.facetCount = randomInt(5, 12);
  }
  if (enabledFeatures.has('spiralGrooves')) {
    newParams.spiralGrooveCount = randomInt(2, 8);
    newParams.spiralGrooveDepth = randomInRange(0.5, 3);
  }
  if (enabledFeatures.has('horizontalRibs')) {
    newParams.horizontalRibCount = randomInt(3, 12);
    newParams.horizontalRibDepth = randomInRange(0.5, 2);
  }
  if (enabledFeatures.has('fluting')) {
    newParams.flutingCount = randomInt(6, 16);
    newParams.flutingDepth = randomInRange(0.5, 3);
  }
  if (enabledFeatures.has('rimWaves')) {
    newParams.rimWaveCount = randomInt(4, 12);
    newParams.rimWaveDepth = randomInRange(0.05, 0.3);
  }

  // Small chance to add organic noise
  if (randomBool(0.3)) {
    newParams.organicNoise = randomInRange(0.01, 0.05);
    newParams.noiseScale = randomInRange(0.5, 3);
  } else {
    newParams.organicNoise = 0;
    newParams.noiseScale = 1;
  }

  return newParams;
}
