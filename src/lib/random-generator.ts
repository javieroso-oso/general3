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

  // Core shape - more conservative ranges for printable shapes
  newParams.height = randomInRange(80, 150);
  newParams.baseRadius = randomInRange(25, 45);
  newParams.topRadius = randomInRange(20, 50);
  newParams.profileCurve = randomChoice(profileCurves);

  // Organic deformations - toned down for realistic shapes
  newParams.bulgePosition = randomInRange(0.3, 0.7);
  newParams.bulgeAmount = randomInRange(0, 0.2);
  newParams.pinchAmount = randomInRange(0, 0.15);
  newParams.wobbleFrequency = randomInt(0, 4);
  newParams.wobbleAmplitude = randomInRange(0, 0.08);
  newParams.twistAngle = randomInRange(0, 45);
  newParams.asymmetry = randomInRange(0, 0.1);

  // Lip parameters - more subtle
  newParams.lipFlare = randomInRange(0, 0.15);
  newParams.lipHeight = randomInRange(0, 8);

  // Surface details - randomly enable 0-1 features (less chaotic)
  const surfaceFeatures = ['facets', 'spiralGrooves', 'horizontalRibs', 'fluting', 'rimWaves'] as const;
  const enabledFeatures = new Set<string>();
  const featureCount = randomInt(0, 1);
  
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

  // Enable selected features with more subtle values
  if (enabledFeatures.has('facets')) {
    newParams.facetCount = randomInt(5, 8);
  }
  if (enabledFeatures.has('spiralGrooves')) {
    newParams.spiralGrooveCount = randomInt(2, 5);
    newParams.spiralGrooveDepth = randomInRange(0.3, 1.5);
  }
  if (enabledFeatures.has('horizontalRibs')) {
    newParams.horizontalRibCount = randomInt(3, 8);
    newParams.horizontalRibDepth = randomInRange(0.3, 1);
  }
  if (enabledFeatures.has('fluting')) {
    newParams.flutingCount = randomInt(6, 12);
    newParams.flutingDepth = randomInRange(0.3, 1.5);
  }
  if (enabledFeatures.has('rimWaves')) {
    newParams.rimWaveCount = randomInt(4, 8);
    newParams.rimWaveDepth = randomInRange(0.05, 0.2);
  }

  // Small chance to add organic noise (reduced intensity)
  if (randomBool(0.2)) {
    newParams.organicNoise = randomInRange(0.01, 0.03);
    newParams.noiseScale = randomInRange(0.8, 2);
  } else {
    newParams.organicNoise = 0;
    newParams.noiseScale = 1;
  }

  return newParams;
}
