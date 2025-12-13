import { StandardRimSize } from './parametric';
import { SocketType, socketDimensions } from './lamp';

// ============================================
// STAND STYLE SYSTEM
// Hybrid approach: Style presets + Parametric control
// ============================================

// Stand style defines the overall aesthetic
export type StandStyle = 
  | 'minimalist'    // Clean, thin lines
  | 'industrial'    // Chunky, raw metal look
  | 'art_deco'      // Geometric, tapered, elegant
  | 'organic'       // Curved, flowing, natural
  | 'retro'         // Mid-century modern feel
  | 'brutalist';    // Bold, angular, heavy

// Stand type for mounting
export type StandMountType = 'tripod' | 'pendant' | 'wall_arm';

// Leg profile shape
export type LegProfile = 
  | 'round'         // Circular cross-section
  | 'square'        // Square cross-section
  | 'tapered'       // Tapers from thick to thin
  | 'twisted'       // Twisted/spiral effect
  | 'curved'        // Curved/bowed legs
  | 'angular';      // Faceted/angular

// Hub style (where legs meet)
export type HubStyle = 
  | 'smooth'        // Smooth transition
  | 'sphere'        // Spherical hub
  | 'disc'          // Flat disc
  | 'cone'          // Conical hub
  | 'minimal';      // Nearly invisible

// Foot style
export type FootStyle = 
  | 'pad'           // Flat pad
  | 'sphere'        // Ball foot
  | 'spike'         // Pointed spike
  | 'flare'         // Flared out
  | 'none';         // No foot

// Style preset configuration
export interface StandStylePreset {
  id: StandStyle;
  name: string;
  description: string;
  // Default parametric values for this style
  legProfile: LegProfile;
  hubStyle: HubStyle;
  footStyle: FootStyle;
  legThicknessMultiplier: number;  // 0.5 = thin, 2.0 = thick
  legCurveAmount: number;           // 0 = straight, 1 = max curve
  legTwistAmount: number;           // 0 = none, 1 = full twist
  legTaper: number;                 // 0 = uniform, 1 = strong taper
  hubSize: number;                  // 0.5 = small, 2.0 = large
  footSize: number;                 // 0.5 = small, 2.0 = large
}

// Full parametric stand params
export interface ParametricStandParams {
  enabled: boolean;
  mountType: StandMountType;
  style: StandStyle;
  rimSize: StandardRimSize;
  
  // Dimensions
  height: number;
  
  // Tripod-specific
  legCount: 3 | 4 | 5 | 6;
  legSpread: number;        // degrees
  
  // Pendant-specific
  cordLength: number;
  
  // Wall arm-specific
  armLength: number;
  armAngle: number;
  
  // Parametric leg controls (override style defaults)
  legProfile: LegProfile;
  legThickness: number;     // 4-20mm
  legCurve: number;         // 0-1
  legTwist: number;         // 0-360 degrees
  legTaper: number;         // 0-1
  
  // Hub controls
  hubStyle: HubStyle;
  hubScale: number;         // 0.5-2.0
  
  // Foot controls
  footStyle: FootStyle;
  footScale: number;        // 0.5-2.0
  
  // Hardware integration (for lamps)
  socketType: SocketType;
  showSocketHolder: boolean;
  cordExitLeg: number;      // Which leg the cord exits (0-based index)
}

// Get socket holder dimensions based on socket type
export function getSocketHolderDims(socketType: SocketType) {
  const socket = socketDimensions[socketType];
  return {
    innerRadius: (socket.outerDiameter + 1) / 2,  // Tight fit
    outerRadius: (socket.outerDiameter + 10) / 2, // Wall thickness
    height: socket.height + 15,                    // Extra for cord
    cordHoleRadius: 4,                             // 8mm diameter cord hole
    collarHeight: socket.collarHeight,
  };
}

// Style presets library
export const standStylePresets: StandStylePreset[] = [
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Clean, thin lines with subtle elegance',
    legProfile: 'round',
    hubStyle: 'minimal',
    footStyle: 'pad',
    legThicknessMultiplier: 0.6,
    legCurveAmount: 0,
    legTwistAmount: 0,
    legTaper: 0.3,
    hubSize: 0.7,
    footSize: 0.8,
  },
  {
    id: 'industrial',
    name: 'Industrial',
    description: 'Bold, chunky with raw metal aesthetic',
    legProfile: 'square',
    hubStyle: 'disc',
    footStyle: 'pad',
    legThicknessMultiplier: 1.5,
    legCurveAmount: 0,
    legTwistAmount: 0,
    legTaper: 0,
    hubSize: 1.2,
    footSize: 1.3,
  },
  {
    id: 'art_deco',
    name: 'Art Deco',
    description: 'Geometric elegance with sophisticated taper',
    legProfile: 'tapered',
    hubStyle: 'cone',
    footStyle: 'flare',
    legThicknessMultiplier: 0.9,
    legCurveAmount: 0,
    legTwistAmount: 0,
    legTaper: 0.7,
    hubSize: 0.9,
    footSize: 1.1,
  },
  {
    id: 'organic',
    name: 'Organic',
    description: 'Flowing curves inspired by nature',
    legProfile: 'curved',
    hubStyle: 'smooth',
    footStyle: 'sphere',
    legThicknessMultiplier: 0.85,
    legCurveAmount: 0.6,
    legTwistAmount: 0,
    legTaper: 0.4,
    hubSize: 1.0,
    footSize: 1.0,
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Mid-century modern with playful angles',
    legProfile: 'tapered',
    hubStyle: 'sphere',
    footStyle: 'sphere',
    legThicknessMultiplier: 0.75,
    legCurveAmount: 0.2,
    legTwistAmount: 0,
    legTaper: 0.5,
    hubSize: 0.85,
    footSize: 0.9,
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    description: 'Heavy, angular with dramatic presence',
    legProfile: 'angular',
    hubStyle: 'disc',
    footStyle: 'pad',
    legThicknessMultiplier: 1.8,
    legCurveAmount: 0,
    legTwistAmount: 0,
    legTaper: 0.1,
    hubSize: 1.4,
    footSize: 1.5,
  },
];

// Default parametric stand params
export const defaultParametricStandParams: ParametricStandParams = {
  enabled: false,
  mountType: 'tripod',
  style: 'minimalist',
  rimSize: 80,
  height: 150,
  legCount: 3,
  legSpread: 35,
  cordLength: 500,
  armLength: 200,
  armAngle: 15,
  legProfile: 'round',
  legThickness: 8,
  legCurve: 0,
  legTwist: 0,
  legTaper: 0.3,
  hubStyle: 'minimal',
  hubScale: 1.0,
  footStyle: 'pad',
  footScale: 1.0,
  // Hardware (for lamps)
  socketType: 'E26',
  showSocketHolder: false,
  cordExitLeg: 0,
};

// Apply style preset to params
export function applyStylePreset(
  params: ParametricStandParams, 
  style: StandStyle
): ParametricStandParams {
  const preset = standStylePresets.find(p => p.id === style);
  if (!preset) return params;
  
  return {
    ...params,
    style,
    legProfile: preset.legProfile,
    legThickness: 8 * preset.legThicknessMultiplier,
    legCurve: preset.legCurveAmount,
    legTwist: preset.legTwistAmount * 180,
    legTaper: preset.legTaper,
    hubStyle: preset.hubStyle,
    hubScale: preset.hubSize,
    footStyle: preset.footStyle,
    footScale: preset.footSize,
  };
}

// Get style preset by ID
export function getStylePreset(style: StandStyle): StandStylePreset | undefined {
  return standStylePresets.find(p => p.id === style);
}
