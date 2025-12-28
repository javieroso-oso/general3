export type MaterialPreset = 'ceramic' | 'matte-clay' | 'glossy-plastic' | 'frosted-glass';

export interface MaterialConfig {
  color: string;
  roughness: number;
  metalness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  thickness?: number;
  ior?: number;
  envMapIntensity?: number;
}

export const MATERIAL_PRESETS: Record<MaterialPreset, MaterialConfig> = {
  'ceramic': {
    color: '#f5f5f5',
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.6,
  },
  'matte-clay': {
    color: '#d4c4b5',
    roughness: 0.85,
    metalness: 0.0,
    envMapIntensity: 0.3,
  },
  'glossy-plastic': {
    color: '#e8e8e8',
    roughness: 0.15,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.8,
  },
  'frosted-glass': {
    color: '#ffffff',
    roughness: 0.3,
    metalness: 0.0,
    transmission: 0.6,
    thickness: 2,
    ior: 1.5,
    envMapIntensity: 0.5,
  },
};

export const MATERIAL_LABELS: Record<MaterialPreset, string> = {
  'ceramic': 'Ceramic',
  'matte-clay': 'Matte Clay',
  'glossy-plastic': 'Glossy',
  'frosted-glass': 'Frosted Glass',
};
