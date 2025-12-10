export type ObjectType = 'vase' | 'lamp' | 'sculpture';

export interface ParametricParams {
  // Basic dimensions
  height: number;
  baseRadius: number;
  topRadius: number;
  wallThickness: number;
  
  // Organic deformations
  wobbleFrequency: number;
  wobbleAmplitude: number;
  twistAngle: number;
  
  // Clay-like organic parameters
  bulgePosition: number;    // 0-1 where the belly bulges
  bulgeAmount: number;      // How much it bulges out
  pinchAmount: number;      // Pinch at top/bottom
  asymmetry: number;        // Asymmetric organic feel
  
  // Surface details
  rippleCount: number;      // Vertical ripples
  rippleDepth: number;      // Depth of ripples
  
  // Lip/rim
  lipFlare: number;         // Flare at the top edge
  lipHeight: number;        // How far down the lip extends
  
  // Organic noise
  organicNoise: number;     // Random organic variation
  noiseScale: number;       // Scale of noise pattern
}

export interface Preset {
  id: string;
  name: string;
  type: ObjectType;
  params: ParametricParams;
  thumbnail?: string;
}

export const defaultParams: Record<ObjectType, ParametricParams> = {
  vase: {
    height: 3,
    baseRadius: 1,
    topRadius: 0.8,
    wallThickness: 0.12,
    wobbleFrequency: 0,
    wobbleAmplitude: 0,
    twistAngle: 0,
    bulgePosition: 0.4,
    bulgeAmount: 0.2,
    pinchAmount: 0,
    asymmetry: 0,
    rippleCount: 0,
    rippleDepth: 0,
    lipFlare: 0.1,
    lipHeight: 0.05,
    organicNoise: 0,
    noiseScale: 1,
  },
  lamp: {
    height: 2.5,
    baseRadius: 0.6,
    topRadius: 1.4,
    wallThickness: 0.08,
    wobbleFrequency: 0,
    wobbleAmplitude: 0,
    twistAngle: 0,
    bulgePosition: 0.7,
    bulgeAmount: 0.1,
    pinchAmount: 0,
    asymmetry: 0,
    rippleCount: 0,
    rippleDepth: 0,
    lipFlare: 0,
    lipHeight: 0,
    organicNoise: 0,
    noiseScale: 1,
  },
  sculpture: {
    height: 4,
    baseRadius: 0.8,
    topRadius: 0.5,
    wallThickness: 0.15,
    wobbleFrequency: 3,
    wobbleAmplitude: 0.1,
    twistAngle: 45,
    bulgePosition: 0.5,
    bulgeAmount: 0.3,
    pinchAmount: 0.1,
    asymmetry: 0.1,
    rippleCount: 0,
    rippleDepth: 0,
    lipFlare: 0,
    lipHeight: 0,
    organicNoise: 0.05,
    noiseScale: 2,
  },
};

export const presets: Preset[] = [
  {
    id: 'classic-vase',
    name: 'Classic',
    type: 'vase',
    params: { ...defaultParams.vase },
  },
  {
    id: 'organic-belly',
    name: 'Belly',
    type: 'vase',
    params: { ...defaultParams.vase, bulgePosition: 0.35, bulgeAmount: 0.45, lipFlare: 0.15 },
  },
  {
    id: 'twisted-vase',
    name: 'Twisted',
    type: 'vase',
    params: { ...defaultParams.vase, twistAngle: 120, wobbleFrequency: 3, wobbleAmplitude: 0.08 },
  },
  {
    id: 'rippled-vase',
    name: 'Rippled',
    type: 'vase',
    params: { ...defaultParams.vase, rippleCount: 8, rippleDepth: 0.06, bulgeAmount: 0.25 },
  },
  {
    id: 'asymmetric-vase',
    name: 'Asymmetric',
    type: 'vase',
    params: { ...defaultParams.vase, asymmetry: 0.2, bulgeAmount: 0.3, organicNoise: 0.03 },
  },
  {
    id: 'modern-lamp',
    name: 'Modern',
    type: 'lamp',
    params: { ...defaultParams.lamp },
  },
  {
    id: 'spiral-lamp',
    name: 'Spiral',
    type: 'lamp',
    params: { ...defaultParams.lamp, twistAngle: 180, wobbleFrequency: 5, wobbleAmplitude: 0.06 },
  },
  {
    id: 'organic-lamp',
    name: 'Organic',
    type: 'lamp',
    params: { ...defaultParams.lamp, organicNoise: 0.08, noiseScale: 3, bulgeAmount: 0.15 },
  },
  {
    id: 'organic-sculpture',
    name: 'Organic',
    type: 'sculpture',
    params: { ...defaultParams.sculpture, organicNoise: 0.1, asymmetry: 0.15, bulgeAmount: 0.4 },
  },
  {
    id: 'minimal-sculpture',
    name: 'Minimal',
    type: 'sculpture',
    params: { ...defaultParams.sculpture, wobbleFrequency: 0, twistAngle: 0, organicNoise: 0 },
  },
  {
    id: 'wild-sculpture',
    name: 'Wild',
    type: 'sculpture',
    params: { ...defaultParams.sculpture, wobbleFrequency: 6, wobbleAmplitude: 0.15, twistAngle: 270, rippleCount: 12, rippleDepth: 0.04, organicNoise: 0.08 },
  },
  {
    id: 'pinched-sculpture',
    name: 'Pinched',
    type: 'sculpture',
    params: { ...defaultParams.sculpture, pinchAmount: 0.3, bulgePosition: 0.5, bulgeAmount: 0.5, asymmetry: 0.1 },
  },
];
