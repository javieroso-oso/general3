export type ObjectType = 'vase' | 'lamp' | 'sculpture';

export interface ParametricParams {
  height: number;
  baseRadius: number;
  topRadius: number;
  wallThickness: number;
  wobbleFrequency: number;
  twistAngle: number;
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
    wallThickness: 0.1,
    wobbleFrequency: 0,
    twistAngle: 0,
  },
  lamp: {
    height: 2.5,
    baseRadius: 0.6,
    topRadius: 1.2,
    wallThickness: 0.08,
    wobbleFrequency: 0,
    twistAngle: 0,
  },
  sculpture: {
    height: 4,
    baseRadius: 0.8,
    topRadius: 0.5,
    wallThickness: 0.15,
    wobbleFrequency: 3,
    twistAngle: 45,
  },
};

export const presets: Preset[] = [
  {
    id: 'classic-vase',
    name: 'Classic',
    type: 'vase',
    params: { height: 3, baseRadius: 1, topRadius: 0.7, wallThickness: 0.1, wobbleFrequency: 0, twistAngle: 0 },
  },
  {
    id: 'twisted-vase',
    name: 'Twisted',
    type: 'vase',
    params: { height: 3.5, baseRadius: 0.9, topRadius: 0.6, wallThickness: 0.1, wobbleFrequency: 0, twistAngle: 90 },
  },
  {
    id: 'wavy-vase',
    name: 'Wavy',
    type: 'vase',
    params: { height: 3, baseRadius: 1, topRadius: 0.8, wallThickness: 0.1, wobbleFrequency: 4, twistAngle: 0 },
  },
  {
    id: 'modern-lamp',
    name: 'Modern',
    type: 'lamp',
    params: { height: 2.5, baseRadius: 0.5, topRadius: 1.5, wallThickness: 0.06, wobbleFrequency: 0, twistAngle: 0 },
  },
  {
    id: 'spiral-lamp',
    name: 'Spiral',
    type: 'lamp',
    params: { height: 3, baseRadius: 0.8, topRadius: 1.2, wallThickness: 0.08, wobbleFrequency: 6, twistAngle: 120 },
  },
  {
    id: 'organic-sculpture',
    name: 'Organic',
    type: 'sculpture',
    params: { height: 4, baseRadius: 1, topRadius: 0.3, wallThickness: 0.2, wobbleFrequency: 5, twistAngle: 180 },
  },
  {
    id: 'minimal-sculpture',
    name: 'Minimal',
    type: 'sculpture',
    params: { height: 5, baseRadius: 0.6, topRadius: 0.6, wallThickness: 0.25, wobbleFrequency: 0, twistAngle: 45 },
  },
  {
    id: 'abstract-sculpture',
    name: 'Abstract',
    type: 'sculpture',
    params: { height: 3.5, baseRadius: 1.2, topRadius: 0.4, wallThickness: 0.15, wobbleFrequency: 8, twistAngle: 270 },
  },
];
