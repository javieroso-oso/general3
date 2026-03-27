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
  | 'pla-filament'
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
  'pla-filament': {
    color: '#e0e0e0',
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.25,
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
  'pla-filament': 'PLA Filament',
  'custom': 'Custom Color',
};

export interface ExhibitSwatch {
  color: string;
  label: string;
  material: Exclude<MaterialPreset, 'custom'>;
}

export const EXHIBIT_SWATCHES: ExhibitSwatch[] = [
  { color: '#f5f5f5', label: 'Arctic White', material: 'ceramic' },
  { color: '#e8735a', label: 'Coral', material: 'matte-clay' },
  { color: '#c4725c', label: 'Terracotta', material: 'terracotta' },
  { color: '#8fae8b', label: 'Sage', material: 'matte-clay' },
  { color: '#5b8fa8', label: 'Ocean', material: 'glossy-plastic' },
  { color: '#2a2a3a', label: 'Midnight', material: 'glossy-plastic' },
  { color: '#d4a574', label: 'Sandstone', material: 'matte-clay' },
  { color: '#b8a9c9', label: 'Lavender', material: 'glossy-plastic' },
  { color: '#e8d5c4', label: 'Blush', material: 'ceramic' },
  { color: '#3d5a3e', label: 'Forest', material: 'matte-clay' },
  { color: '#c9b458', label: 'Brass', material: 'brushed-metal' },
  { color: '#1a1a1a', label: 'Obsidian', material: 'glossy-plastic' },
];

export type BackgroundPreset = 'white' | 'light-gray' | 'warm' | 'cool' | 'studio' | 'minimal';

export const BACKGROUND_PRESETS: Record<BackgroundPreset, { from: string; to: string; label: string }> = {
  'minimal': { from: '#fafafa', to: '#f0f0f2', label: 'Minimal' },
  'white': { from: '#ffffff', to: '#f0f0f0', label: 'White' },
  'light-gray': { from: '#e8e8e8', to: '#d0d0d0', label: 'Light Gray' },
  'warm': { from: '#f5e6d3', to: '#e8d5c4', label: 'Warm' },
  'cool': { from: '#d4e5f7', to: '#b8d4ed', label: 'Cool' },
  'studio': { from: '#3a3a4a', to: '#252530', label: 'Studio' },
};
