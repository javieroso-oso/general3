import { ParametricParams, PrintSettings } from './parametric';

// Socket types with real dimensions (mm)
export type SocketType = 'E26' | 'E27' | 'E12' | 'GU10' | 'G9' | 'LED_Strip';

// Bulb shapes for ghost preview
export type BulbShape = 'A19' | 'A21' | 'Globe' | 'Candle' | 'Edison' | 'PAR30' | 'Tube';

// Mounting/lamp styles
export type LampStyle = 'pendant' | 'table' | 'wall_sconce' | 'clip_on' | 'floor';

// Cord routing options
export type CordExit = 'bottom_center' | 'bottom_side' | 'top_hidden' | 'internal_channel';

// Light pattern cutout types
export type LightPatternType = 'none' | 'dots' | 'lines' | 'organic' | 'geometric';

export interface SocketDimensions {
  outerDiameter: number;  // mm
  height: number;         // mm
  collarHeight: number;   // mm
  threadDiameter: number; // mm
}

export interface BulbDimensions {
  diameter: number;       // mm
  height: number;         // mm
  neckDiameter: number;   // mm
  heatZoneRadius: number; // mm - heat dissipation zone
}

export interface LampHardware {
  socketType: SocketType;
  bulbShape: BulbShape;
  bulbWattage: number;
  cordExit: CordExit;
  cordDiameter: number;   // mm
  lampStyle: LampStyle;
}

export interface LampParams extends ParametricParams {
  // Socket mounting
  socketMountingHeight: number;  // mm from bottom (usually near top)
  socketHoleDiameter: number;    // mm - hole for socket
  
  // Ventilation
  ventilationSlots: boolean;
  ventSlotCount: number;
  ventSlotWidth: number;         // mm
  ventSlotHeight: number;        // mm
  
  // Light pattern cutouts
  lightPatternType: LightPatternType;
  patternDensity: number;        // 0-1
  patternSize: number;           // mm
  patternDepth: number;          // 0-1 (percentage of wall)
  
  // Translucency zone (thin wall section for light diffusion)
  translucencyEnabled: boolean;
  translucencyZoneStart: number; // 0-1 height percentage
  translucencyZoneEnd: number;   // 0-1 height percentage
  translucencyThickness: number; // mm - thinner wall for light pass
}

// Socket dimensions lookup (real measurements in mm)
export const socketDimensions: Record<SocketType, SocketDimensions> = {
  E26: { outerDiameter: 26, height: 47, collarHeight: 10, threadDiameter: 24 },
  E27: { outerDiameter: 27, height: 47, collarHeight: 10, threadDiameter: 25 },
  E12: { outerDiameter: 12, height: 30, collarHeight: 6, threadDiameter: 11 },
  GU10: { outerDiameter: 50, height: 55, collarHeight: 8, threadDiameter: 50 },
  G9: { outerDiameter: 18, height: 35, collarHeight: 5, threadDiameter: 9 },
  LED_Strip: { outerDiameter: 12, height: 20, collarHeight: 5, threadDiameter: 10 },
};

// Bulb dimensions lookup (in mm)
export const bulbDimensions: Record<BulbShape, BulbDimensions> = {
  A19: { diameter: 60, height: 110, neckDiameter: 26, heatZoneRadius: 80 },
  A21: { diameter: 68, height: 135, neckDiameter: 26, heatZoneRadius: 100 },
  Globe: { diameter: 80, height: 120, neckDiameter: 26, heatZoneRadius: 100 },
  Candle: { diameter: 35, height: 100, neckDiameter: 12, heatZoneRadius: 50 },
  Edison: { diameter: 64, height: 140, neckDiameter: 26, heatZoneRadius: 90 },
  PAR30: { diameter: 95, height: 90, neckDiameter: 26, heatZoneRadius: 120 },
  Tube: { diameter: 30, height: 120, neckDiameter: 26, heatZoneRadius: 60 },
};

// Material heat limits (max safe temperature in °C)
export const materialHeatLimits: Record<PrintSettings['material'], { maxTemp: number; maxWattage: number }> = {
  PLA: { maxTemp: 50, maxWattage: 15 },
  PETG: { maxTemp: 80, maxWattage: 25 },
  ABS: { maxTemp: 100, maxWattage: 40 },
  TPU: { maxTemp: 70, maxWattage: 20 },
};

export interface LampSafetyAnalysis {
  isValid: boolean;
  heatClearance: 'safe' | 'warning' | 'danger';
  bulbToShadeDistance: number;     // mm
  maxSafeWattage: number;
  recommendedWattage: number;
  ventilationAdequate: boolean;
  materialWarnings: string[];
  recommendations: string[];
}

export interface LampPreset {
  id: string;
  name: string;
  description: string;
  params: LampParams;
  hardware: LampHardware;
  thumbnail?: string;
}

// Default lamp hardware
export const defaultLampHardware: LampHardware = {
  socketType: 'E26',
  bulbShape: 'A19',
  bulbWattage: 10,
  cordExit: 'top_hidden',
  cordDiameter: 6,
  lampStyle: 'pendant',
};

// Default lamp params (extending base parametric params for lamp type)
export const defaultLampParams: LampParams = {
  height: 150,
  baseRadius: 40,
  topRadius: 80,
  wallThickness: 2.0,
  wobbleFrequency: 0,
  wobbleAmplitude: 0,
  twistAngle: 0,
  bulgePosition: 0.6,
  bulgeAmount: 0.1,
  pinchAmount: 0,
  asymmetry: 0,
  rippleCount: 0,
  rippleDepth: 0,
  lipFlare: 0.05,
  lipHeight: 0.03,
  organicNoise: 0,
  noiseScale: 1,
  baseThickness: 0,          // Lamps typically have open bottom
  baseType: 'flat',
  
  // Lamp-specific
  socketMountingHeight: 145, // Near top
  socketHoleDiameter: 40,
  ventilationSlots: false,
  ventSlotCount: 6,
  ventSlotWidth: 5,
  ventSlotHeight: 20,
  lightPatternType: 'none',
  patternDensity: 0.3,
  patternSize: 8,
  patternDepth: 0.8,
  translucencyEnabled: false,
  translucencyZoneStart: 0.3,
  translucencyZoneEnd: 0.7,
  translucencyThickness: 0.8,
};
