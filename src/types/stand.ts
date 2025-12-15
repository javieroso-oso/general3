import { StandardRimSize } from './parametric';
import { SocketType, socketDimensions } from './lamp';

// ============================================
// MODULAR CONNECTION SYSTEM
// Hardware-based connection between objects and stands
// ============================================

export type ConnectionType = 'friction' | 'screw_insert';
export type ScrewSize = 'M3' | 'M4';
export type MountingHoleCount = 3 | 4 | 6;

export interface ConnectionSpec {
  type: ConnectionType;
  screwSize: ScrewSize;
  holeCount: MountingHoleCount;
  plateThickness: number;  // 4-6mm
}

// Screw dimensions for 3D printing
export const screwSpecs: Record<ScrewSize, { holeDiameter: number; insertLength: number }> = {
  'M3': { holeDiameter: 4.0, insertLength: 5 },
  'M4': { holeDiameter: 5.6, insertLength: 6 },
};

export const defaultConnectionSpec: ConnectionSpec = {
  type: 'screw_insert',
  screwSize: 'M4',
  holeCount: 3,
  plateThickness: 5,
};

// ============================================
// STAND STYLE SYSTEM
// WOOJ-inspired minimal aesthetics
// ============================================

// Stand style defines the overall aesthetic
export type StandStyle = 
  | 'minimalist'       // Clean, thin lines
  | 'industrial'       // Chunky, raw metal look
  | 'art_deco'         // Geometric, tapered, elegant
  | 'organic'          // Curved, flowing, natural
  | 'retro'            // Mid-century modern feel
  | 'brutalist'        // Bold, angular, heavy
  // WOOJ-inspired styles
  | 'wooj_splayed'     // Thin straight legs, no visible hub (Wavy lamp style)
  | 'ribbed_pedestal'  // Vertical fluted cylinder base (Brut lamp style)
  | 'floating_ring';   // Simple torus ring at base (Kinoko lamp style)

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
  | 'minimal'       // Nearly invisible
  | 'hidden';       // No hub - legs attach directly to plate

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
  // WOOJ-specific
  legSpreadOverride?: number;       // Override leg spread angle
  ribCount?: number;                // For ribbed pedestal
  isWoojStyle?: boolean;            // Enables special WOOJ rendering
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
  
  // WOOJ-specific params
  ribCount: number;         // For ribbed pedestal (12-24)
  ringThickness: number;    // For floating ring (4-10mm)
  
  // Connection system
  connection: ConnectionSpec;
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
  // Original styles
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
  // WOOJ-inspired styles
  {
    id: 'wooj_splayed',
    name: 'WOOJ Splayed',
    description: 'Ultra-thin straight legs with no visible hub',
    legProfile: 'round',
    hubStyle: 'hidden',
    footStyle: 'spike',
    legThicknessMultiplier: 0.4,
    legCurveAmount: 0,
    legTwistAmount: 0,
    legTaper: 0.8,
    hubSize: 0,
    footSize: 0.5,
    legSpreadOverride: 50,
    isWoojStyle: true,
  },
  {
    id: 'ribbed_pedestal',
    name: 'Ribbed Pedestal',
    description: 'Elegant fluted cylinder base',
    legProfile: 'round',
    hubStyle: 'hidden',
    footStyle: 'none',
    legThicknessMultiplier: 1,
    legCurveAmount: 0,
    legTwistAmount: 0,
    legTaper: 0,
    hubSize: 0,
    footSize: 0,
    ribCount: 16,
    isWoojStyle: true,
  },
  {
    id: 'floating_ring',
    name: 'Floating Ring',
    description: 'Minimal torus ring at base',
    legProfile: 'round',
    hubStyle: 'hidden',
    footStyle: 'none',
    legThicknessMultiplier: 0.5,
    legCurveAmount: 0,
    legTwistAmount: 0,
    legTaper: 0,
    hubSize: 0,
    footSize: 0,
    isWoojStyle: true,
  },
];

// Default parametric stand params
export const defaultParametricStandParams: ParametricStandParams = {
  enabled: false,
  mountType: 'tripod',
  style: 'wooj_splayed',
  rimSize: 80,
  height: 150,
  legCount: 3,
  legSpread: 50,
  cordLength: 500,
  armLength: 200,
  armAngle: 15,
  legProfile: 'round',
  legThickness: 4,
  legCurve: 0,
  legTwist: 0,
  legTaper: 0.8,
  hubStyle: 'hidden',
  hubScale: 1.0,
  footStyle: 'spike',
  footScale: 0.5,
  // Hardware (for lamps)
  socketType: 'E26',
  showSocketHolder: false,
  cordExitLeg: 0,
  // WOOJ params
  ribCount: 16,
  ringThickness: 6,
  // Connection
  connection: defaultConnectionSpec,
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
    legSpread: preset.legSpreadOverride ?? params.legSpread,
    ribCount: preset.ribCount ?? params.ribCount,
  };
}

// Get style preset by ID
export function getStylePreset(style: StandStyle): StandStylePreset | undefined {
  return standStylePresets.find(p => p.id === style);
}

// Check if style is a WOOJ-inspired style
export function isWoojStyle(style: StandStyle): boolean {
  const preset = getStylePreset(style);
  return preset?.isWoojStyle ?? false;
}
