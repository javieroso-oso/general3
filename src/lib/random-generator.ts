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

  // Core shape - use relative constraints for printable proportions
  newParams.baseRadius = randomInRange(28, 42);
  // Make topRadius relative to baseRadius (60-120% of base)
  newParams.topRadius = newParams.baseRadius * randomInRange(0.6, 1.2);
  // Height proportional to base (2x to 3.5x base radius)
  newParams.height = newParams.baseRadius * randomInRange(2, 3.5);
  newParams.profileCurve = randomChoice(profileCurves);

  // Organic deformations - very conservative for realistic shapes
  newParams.bulgePosition = randomInRange(0.35, 0.65);
  newParams.bulgeAmount = randomInRange(0, 0.12);
  newParams.pinchAmount = randomInRange(0, 0.08);
  newParams.wobbleFrequency = randomInt(0, 2);
  newParams.wobbleAmplitude = randomInRange(0, 0.04);
  newParams.twistAngle = randomInRange(0, 15);
  newParams.asymmetry = randomInRange(0, 0.05);

  // Lip parameters - proportional to height
  newParams.lipFlare = randomInRange(0, 0.08);
  newParams.lipHeight = newParams.height * randomInRange(0, 0.03);

  // Surface details - randomly enable 0-1 features
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

  // Enable selected features with subtle values
  if (enabledFeatures.has('facets')) {
    newParams.facetCount = randomInt(5, 6);
  }
  if (enabledFeatures.has('spiralGrooves')) {
    newParams.spiralGrooveCount = randomInt(2, 4);
    newParams.spiralGrooveDepth = randomInRange(0.2, 0.8);
  }
  if (enabledFeatures.has('horizontalRibs')) {
    newParams.horizontalRibCount = randomInt(3, 6);
    newParams.horizontalRibDepth = randomInRange(0.2, 0.5);
  }
  if (enabledFeatures.has('fluting')) {
    newParams.flutingCount = randomInt(6, 10);
    newParams.flutingDepth = randomInRange(0.2, 0.8);
  }
  if (enabledFeatures.has('rimWaves')) {
    newParams.rimWaveCount = randomInt(4, 6);
    newParams.rimWaveDepth = randomInRange(0.03, 0.1);
  }

  // Small chance to add organic noise (reduced intensity)
  if (randomBool(0.1)) {
    newParams.organicNoise = randomInRange(0.005, 0.015);
    newParams.noiseScale = randomInRange(0.8, 1.5);
  } else {
    newParams.organicNoise = 0;
    newParams.noiseScale = 1;
  }

  return newParams;
}
