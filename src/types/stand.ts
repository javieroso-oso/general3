import { SocketType, BulbShape } from './lamp';

// ============================================
// CONSTRAINED STAND ARCHETYPE SYSTEM
// Stands are systems, not sculptural objects
// All dimensions auto-derived from shade geometry
// ============================================

// Only 4 stand archetypes allowed
export type StandArchetype = 'column' | 'disc_base' | 'tripod' | 'pendant';

// Discrete size options (no free values)
export type BaseSize = 'small' | 'medium' | 'large';
export type FootSpread = 'small' | 'medium' | 'wide';
export type RodThickness = 8 | 10 | 12;
export type ColumnThickness = 'slim' | 'standard' | 'bold';

// Base size multipliers
export const baseSizeMultipliers: Record<BaseSize, number> = {
  small: 0.35,
  medium: 0.45,
  large: 0.55,
};

// Foot spread angles (degrees)
export const footSpreadAngles: Record<FootSpread, number> = {
  small: 15,
  medium: 20,
  wide: 25,
};

// Column thickness in mm
export const columnThicknessValues: Record<ColumnThickness, number> = {
  slim: 12,
  standard: 16,
  bold: 22,
};

// Wire channel minimum diameter (mm)
export const WIRE_CHANNEL_DIAMETER = 6;

// ============================================
// SHADE GEOMETRY (input from parametric object)
// ============================================
export interface ShadeGeometry {
  maxDiameter: number;    // mm - widest point of shade
  height: number;         // mm - shade height
  rimSize: number;        // mm - inner ring diameter at base
}

// ============================================
// STAND PARAMS (limited, constrained)
// ============================================
export interface ConstrainedStandParams {
  enabled: boolean;
  archetype: StandArchetype;
  
  // Shared params (limited range)
  overallHeight: number;  // mm - only user-adjustable dimension
  baseSize: BaseSize;
  
  // Column-specific
  columnThickness: ColumnThickness;
  
  // Disc base-specific  
  rodThickness: RodThickness;
  
  // Tripod-specific
  footSpread: FootSpread;
  legThickness: number;   // 4-8mm only
  
  // Pendant-specific
  cableLength: number;    // mm
  canopySize: BaseSize;
  
  // Hardware preview (for lamps)
  socketType: SocketType;
  bulbShape: BulbShape;
  bulbWattage: number;
  showHardwarePreview: boolean;
  showHeatZone: boolean;
  showWire: boolean;
}

// ============================================
// AUTO-CALCULATED DIMENSIONS
// Users never set these directly
// ============================================
export interface CalculatedStandDimensions {
  baseDiameter: number;
  baseThickness: number;
  connectorDiameter: number;
  columnDiameter: number;
  legAngle: number;
  cableRadius: number;
}

// Calculate stand dimensions from shade geometry
export function calculateStandDimensions(
  shade: ShadeGeometry,
  params: ConstrainedStandParams
): CalculatedStandDimensions {
  const baseMult = baseSizeMultipliers[params.baseSize];
  
  // Core auto-calculations
  const baseDiameter = Math.max(shade.maxDiameter * baseMult, params.overallHeight * 0.35);
  const baseThickness = Math.max(baseDiameter * 0.12, 8);
  const connectorDiameter = shade.rimSize;
  
  // Column-specific
  const columnDiameter = columnThicknessValues[params.columnThickness];
  
  // Tripod-specific
  const legAngle = footSpreadAngles[params.footSpread];
  
  // Cable always 3mm radius
  const cableRadius = 3;
  
  return {
    baseDiameter,
    baseThickness,
    connectorDiameter,
    columnDiameter,
    legAngle,
    cableRadius,
  };
}

// ============================================
// PRODUCT NAMING SYSTEM
// ============================================
export const standProductNames: Record<StandArchetype, string> = {
  column: 'Akari Column Stand',
  disc_base: 'Studio Disc Base',
  tripod: 'Tripod Classic',
  pendant: 'Pendant Drop',
};

export function getStandProductName(archetype: StandArchetype): string {
  return standProductNames[archetype];
}

// ============================================
// DEFAULT PARAMS
// ============================================
export const defaultConstrainedStandParams: ConstrainedStandParams = {
  enabled: false,
  archetype: 'disc_base',
  
  // Shared
  overallHeight: 120,
  baseSize: 'medium',
  
  // Column
  columnThickness: 'standard',
  
  // Disc base
  rodThickness: 10,
  
  // Tripod
  footSpread: 'medium',
  legThickness: 5,
  
  // Pendant
  cableLength: 500,
  canopySize: 'medium',
  
  // Hardware
  socketType: 'E26',
  bulbShape: 'A19',
  bulbWattage: 10,
  showHardwarePreview: false,
  showHeatZone: false,
  showWire: false,
};

// Default shade geometry (when object params not available)
export const defaultShadeGeometry: ShadeGeometry = {
  maxDiameter: 200,
  height: 150,
  rimSize: 80,
};

// ============================================
// LEGACY COMPATIBILITY EXPORTS
// Remove these once migration is complete
// ============================================
export type StandMountType = StandArchetype;
export type LegProfile = 'round' | 'square' | 'angular';
export type RimSize = 60 | 80 | 100 | 120;
export const rimSizes: RimSize[] = [60, 80, 100, 120];

// Legacy params interface for backward compatibility
export interface ParametricStandParams {
  enabled: boolean;
  mountType: StandMountType;
  socketSize: RimSize;
  socketCradleDepth: number;
  height: number;
  legCount: 3 | 4;
  legSpread: number;
  legProfile: LegProfile;
  legThickness: number;
  legTaper: number;
  pedestalDiameter: number;
  ribCount: number;
  ribDepth: number;
  baseFlare: number;
  cordLength: number;
  canopyDiameter: number;
  plateWidth: number;
  plateHeight: number;
  armLength: number;
  armAngle: number;
  socketType: SocketType;
  showSocketHolder: boolean;
  bulbShape: BulbShape;
  bulbWattage: number;
  showHardwarePreview: boolean;
  showHeatZone: boolean;
}

// Convert new params to legacy format for existing generators
export function toLegacyParams(
  params: ConstrainedStandParams,
  shade: ShadeGeometry
): ParametricStandParams {
  const dims = calculateStandDimensions(shade, params);
  
  const mountTypeMap: Record<StandArchetype, StandMountType> = {
    column: 'column',
    disc_base: 'disc_base',
    tripod: 'tripod',
    pendant: 'pendant',
  };
  
  return {
    enabled: params.enabled,
    mountType: mountTypeMap[params.archetype] as StandMountType,
    socketSize: (Math.round(shade.rimSize / 20) * 20) as RimSize,
    socketCradleDepth: 5,
    height: params.overallHeight,
    legCount: 3,
    legSpread: dims.legAngle,
    legProfile: 'round',
    legThickness: params.legThickness,
    legTaper: 0.4,
    pedestalDiameter: dims.baseDiameter,
    ribCount: 20,
    ribDepth: 2,
    baseFlare: 0.1,
    cordLength: params.cableLength,
    canopyDiameter: dims.baseDiameter * 0.6,
    plateWidth: 80,
    plateHeight: 80,
    armLength: 150,
    armAngle: 0,
    socketType: params.socketType,
    showSocketHolder: false,
    bulbShape: params.bulbShape,
    bulbWattage: params.bulbWattage,
    showHardwarePreview: params.showHardwarePreview,
    showHeatZone: params.showHeatZone,
  };
}

export const socketCradleSpecs = {
  wallThickness: 4,
  defaultDepth: 5,
  clearance: 0.5,
};

export const defaultParametricStandParams: ParametricStandParams = {
  enabled: false,
  mountType: 'tripod',
  socketSize: 80,
  socketCradleDepth: 5,
  height: 120,
  legCount: 3,
  legSpread: 20,
  legProfile: 'round',
  legThickness: 5,
  legTaper: 0.4,
  pedestalDiameter: 80,
  ribCount: 20,
  ribDepth: 2,
  baseFlare: 0.1,
  cordLength: 500,
  canopyDiameter: 80,
  plateWidth: 80,
  plateHeight: 80,
  armLength: 150,
  armAngle: 0,
  socketType: 'E26',
  showSocketHolder: false,
  bulbShape: 'A19',
  bulbWattage: 10,
  showHardwarePreview: false,
  showHeatZone: false,
};
