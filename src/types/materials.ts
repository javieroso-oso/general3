export type MaterialPreset = 
  | 'ceramic' 
  | 'matte-clay' 
  | 'glossy-plastic' 
  | 'frosted-glass'
  | 'marble'
  | 'terracotta'
  | 'brushed-metal'
  | 'wood'
  | 'concrete'
  | 'custom';

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

export const MATERIAL_PRESETS: Record<Exclude<MaterialPreset, 'custom'>, MaterialConfig> = {
  'ceramic': {
    color: '#f5f5f5',
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.4,
  },
  'matte-clay': {
    color: '#d4c4b5',
    roughness: 0.85,
    metalness: 0.0,
    envMapIntensity: 0.2,
  },
  'glossy-plastic': {
    color: '#e8e8e8',
    roughness: 0.15,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.5,
  },
  'frosted-glass': {
    color: '#ffffff',
    roughness: 0.3,
    metalness: 0.0,
    transmission: 0.6,
    thickness: 2,
    ior: 1.5,
    envMapIntensity: 0.3,
  },
  'marble': {
    color: '#e8e0d8',
    roughness: 0.25,
    metalness: 0.0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.4,
  },
  'terracotta': {
    color: '#c4725c',
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.15,
  },
  'brushed-metal': {
    color: '#8a8a8a',
    roughness: 0.4,
    metalness: 0.9,
    envMapIntensity: 0.6,
  },
  'wood': {
    color: '#8b5a2b',
    roughness: 0.7,
    metalness: 0.0,
    envMapIntensity: 0.2,
  },
  'concrete': {
    color: '#9a9a9a',
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.1,
  },
};

export const MATERIAL_LABELS: Record<MaterialPreset, string> = {
  'ceramic': 'Ceramic',
  'matte-clay': 'Matte Clay',
  'glossy-plastic': 'Glossy',
  'frosted-glass': 'Frosted Glass',
  'marble': 'Marble',
  'terracotta': 'Terracotta',
  'brushed-metal': 'Brushed Metal',
  'wood': 'Wood',
  'concrete': 'Concrete',
  'custom': 'Custom Color',
};

export type BackgroundPreset = 'gradient' | 'dark' | 'light' | 'warm' | 'cool' | 'studio';

export const BACKGROUND_PRESETS: Record<BackgroundPreset, { from: string; to: string; label: string }> = {
  'gradient': { from: 'hsl(var(--secondary) / 0.3)', to: 'hsl(var(--secondary) / 0.6)', label: 'Default' },
  'dark': { from: '#1a1a2e', to: '#0f0f1a', label: 'Dark' },
  'light': { from: '#f5f5f5', to: '#e8e8e8', label: 'Light' },
  'warm': { from: '#2d1f1a', to: '#1a1210', label: 'Warm' },
  'cool': { from: '#1a2433', to: '#0f1520', label: 'Cool' },
  'studio': { from: '#252530', to: '#18181b', label: 'Studio' },
};
