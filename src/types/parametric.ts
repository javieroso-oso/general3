export type ObjectType = 'vase' | 'lamp' | 'sculpture';

// Standard socket sizes in mm - internal cavity for stand plug
export type SocketSize = 40 | 50 | 60 | 70 | 80;

export const socketSizes: SocketSize[] = [40, 50, 60, 70, 80];

// Socket specifications (internal cavity at object base)
export const socketSpecs = {
  wallThickness: 2,     // mm - wall around socket cavity
  minDepth: 15,         // mm
  maxDepth: 30,         // mm
  clearance: 0.4,       // mm - gap for plug to fit
};

export interface ParametricParams {
  // Basic dimensions (mm for printing)
  height: number;
  baseRadius: number;
  topRadius: number;
  wallThickness: number;
  
  // Internal socket for stand connection (invisible flush mount)
  socketSize: SocketSize;       // Internal cavity diameter
  socketDepth: number;          // How deep the cavity goes (15-30mm)
  hasSocket: boolean;           // Enable/disable socket
  
  // Organic deformations
  wobbleFrequency: number;
  wobbleAmplitude: number;
  twistAngle: number;
  
  // Clay-like organic parameters
  bulgePosition: number;
  bulgeAmount: number;
  pinchAmount: number;
  asymmetry: number;
  
  // Surface details
  rippleCount: number;
  rippleDepth: number;
  
  // Lip/rim
  lipFlare: number;
  lipHeight: number;
  
  // Organic noise
  organicNoise: number;
  noiseScale: number;
  
  // Base for printing
  baseThickness: number;
  baseType: 'flat' | 'rounded' | 'pedestal';
}

// Stand types for modular stand system
export type StandType = 'none' | 'tripod' | 'pendant' | 'wall_arm';

export interface StandParams {
  enabled: boolean;
  type: StandType;
  socketSize: SocketSize;  // Must match object socketSize for compatibility
  height: number;          // Stand height in mm
  // Tripod-specific
  legCount: 3 | 4;
  legSpread: number;       // degrees
  // Pendant-specific
  cordLength: number;      // mm (visual only)
  // Wall arm-specific
  armLength: number;
  armAngle: number;
}

export const defaultStandParams: StandParams = {
  enabled: false,
  type: 'none',
  socketSize: 60,
  height: 150,
  legCount: 3,
  legSpread: 35,
  cordLength: 500,
  armLength: 200,
  armAngle: 15,
};

export interface PrintSettings {
  layerHeight: number;        // mm
  nozzleDiameter: number;     // mm
  infillPercent: number;      // 0-100
  printSpeed: number;         // mm/s
  material: 'PLA' | 'PETG' | 'ABS' | 'TPU';
  supportEnabled: boolean;
  brimWidth: number;          // mm
}

export interface PrintAnalysis {
  isValid: boolean;
  warnings: PrintWarning[];
  estimatedTime: number;      // minutes
  materialWeight: number;     // grams
  materialLength: number;     // meters
  layerCount: number;
  maxOverhang: number;        // degrees
  minWallThickness: number;   // mm
  baseContactArea: number;    // mm²
  centerOfMass: { x: number; y: number; z: number };
  needsSupport: boolean;
}

export interface PrintWarning {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  suggestion?: string;
}

export interface Preset {
  id: string;
  name: string;
  type: ObjectType;
  params: ParametricParams;
}

export const defaultPrintSettings: PrintSettings = {
  layerHeight: 0.2,
  nozzleDiameter: 0.4,
  infillPercent: 15,
  printSpeed: 50,
  material: 'PLA',
  supportEnabled: false,
  brimWidth: 5,
};

// Material densities in g/cm³
export const materialDensities: Record<PrintSettings['material'], number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  TPU: 1.21,
};

// Constraints for printability
export const printConstraints = {
  minWallThickness: 1.2,      // mm - minimum for structural integrity
  maxWallThickness: 10,       // mm
  minBaseThickness: 0.8,      // mm
  maxOverhangAngle: 45,       // degrees without support
  minBaseRadius: 10,          // mm for stability
  maxHeight: 300,             // mm - typical printer limit
  minHeight: 10,              // mm
  minBaseContactArea: 200,    // mm² for bed adhesion
};

export const defaultParams: Record<ObjectType, ParametricParams> = {
  vase: {
    height: 120,              // mm
    baseRadius: 40,           // mm
    topRadius: 35,            // mm
    wallThickness: 2.0,       // mm
    // Internal socket for stand plug
    socketSize: 60,
    socketDepth: 20,
    hasSocket: false,
    wobbleFrequency: 0,
    wobbleAmplitude: 0,
    twistAngle: 0,
    bulgePosition: 0.4,
    bulgeAmount: 0.15,
    pinchAmount: 0,
    asymmetry: 0,
    rippleCount: 0,
    rippleDepth: 0,
    lipFlare: 0.08,
    lipHeight: 0.05,
    organicNoise: 0,
    noiseScale: 1,
    baseThickness: 2.0,
    baseType: 'flat',
  },
  lamp: {
    height: 100,
    baseRadius: 30,
    topRadius: 60,
    wallThickness: 1.6,
    socketSize: 60,
    socketDepth: 20,
    hasSocket: false,
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
    baseThickness: 2.4,
    baseType: 'flat',
  },
  sculpture: {
    height: 150,
    baseRadius: 35,
    topRadius: 25,
    wallThickness: 3.0,
    socketSize: 60,
    socketDepth: 20,
    hasSocket: false,
    wobbleFrequency: 3,
    wobbleAmplitude: 0.08,
    twistAngle: 30,
    bulgePosition: 0.5,
    bulgeAmount: 0.25,
    pinchAmount: 0.05,
    asymmetry: 0.05,
    rippleCount: 0,
    rippleDepth: 0,
    lipFlare: 0,
    lipHeight: 0,
    organicNoise: 0.03,
    noiseScale: 2,
    baseThickness: 3.0,
    baseType: 'pedestal',
  },
};

export const presets: Preset[] = [
  { id: 'classic-vase', name: 'Classic', type: 'vase', params: { ...defaultParams.vase } },
  { id: 'belly-vase', name: 'Belly', type: 'vase', params: { ...defaultParams.vase, bulgePosition: 0.35, bulgeAmount: 0.35, lipFlare: 0.12 } },
  { id: 'twisted-vase', name: 'Twisted', type: 'vase', params: { ...defaultParams.vase, twistAngle: 90, wobbleFrequency: 3, wobbleAmplitude: 0.06 } },
  { id: 'rippled-vase', name: 'Rippled', type: 'vase', params: { ...defaultParams.vase, rippleCount: 8, rippleDepth: 0.04, bulgeAmount: 0.2 } },
  { id: 'modern-lamp', name: 'Modern', type: 'lamp', params: { ...defaultParams.lamp } },
  { id: 'spiral-lamp', name: 'Spiral', type: 'lamp', params: { ...defaultParams.lamp, twistAngle: 120, wobbleFrequency: 4, wobbleAmplitude: 0.05 } },
  { id: 'organic-sculpture', name: 'Organic', type: 'sculpture', params: { ...defaultParams.sculpture, organicNoise: 0.06, asymmetry: 0.08, bulgeAmount: 0.35 } },
  { id: 'minimal-sculpture', name: 'Minimal', type: 'sculpture', params: { ...defaultParams.sculpture, wobbleFrequency: 0, twistAngle: 0, organicNoise: 0, bulgeAmount: 0.1 } },
];

// Analyze printability
export function analyzePrint(params: ParametricParams, settings: PrintSettings): PrintAnalysis {
  const warnings: PrintWarning[] = [];
  
  // Check wall thickness
  const effectiveWall = params.wallThickness - (params.wobbleAmplitude * params.baseRadius * 0.5);
  if (effectiveWall < printConstraints.minWallThickness) {
    warnings.push({
      type: 'error',
      code: 'THIN_WALL',
      message: `Wall thickness too thin (${effectiveWall.toFixed(1)}mm)`,
      suggestion: `Increase wall thickness to at least ${printConstraints.minWallThickness}mm or reduce wobble amplitude`,
    });
  }
  
  // Check base contact area
  const baseArea = Math.PI * params.baseRadius * params.baseRadius;
  if (baseArea < printConstraints.minBaseContactArea) {
    warnings.push({
      type: 'warning',
      code: 'SMALL_BASE',
      message: `Base contact area is small (${baseArea.toFixed(0)}mm²)`,
      suggestion: 'Consider using a brim or increasing base radius for better adhesion',
    });
  }
  
  // Check overhang angles
  const radiusDiff = Math.abs(params.topRadius - params.baseRadius);
  const maxOverhang = Math.atan2(radiusDiff, params.height) * (180 / Math.PI);
  const needsSupport = maxOverhang > printConstraints.maxOverhangAngle;
  
  if (needsSupport && !settings.supportEnabled) {
    warnings.push({
      type: 'warning',
      code: 'OVERHANG',
      message: `Max overhang angle is ${maxOverhang.toFixed(1)}° (limit: ${printConstraints.maxOverhangAngle}°)`,
      suggestion: 'Enable supports or adjust radii to reduce overhang',
    });
  }
  
  // Check height
  if (params.height > printConstraints.maxHeight) {
    warnings.push({
      type: 'error',
      code: 'TOO_TALL',
      message: `Height exceeds printer limit (${params.height}mm > ${printConstraints.maxHeight}mm)`,
      suggestion: 'Reduce height or print in multiple parts',
    });
  }
  
  // Check asymmetry stability
  if (params.asymmetry > 0.15) {
    warnings.push({
      type: 'warning',
      code: 'ASYMMETRY',
      message: 'High asymmetry may cause print instability',
      suggestion: 'Consider reducing asymmetry or printing with a raft',
    });
  }
  
  // Calculate estimates
  const avgRadius = (params.baseRadius + params.topRadius) / 2;
  const shellVolume = Math.PI * params.height * (
    Math.pow(avgRadius, 2) - Math.pow(avgRadius - params.wallThickness, 2)
  );
  const baseVolume = Math.PI * params.baseRadius * params.baseRadius * params.baseThickness;
  const totalVolume = (shellVolume + baseVolume) * (1 + settings.infillPercent / 100 * 0.3); // mm³
  
  const materialWeight = (totalVolume / 1000) * materialDensities[settings.material]; // grams
  const materialLength = totalVolume / (Math.PI * Math.pow(1.75 / 2, 2)) / 1000; // meters (1.75mm filament)
  
  const layerCount = Math.ceil(params.height / settings.layerHeight);
  const perimeterLength = 2 * Math.PI * avgRadius * 2; // inner + outer walls
  const timePerLayer = (perimeterLength + avgRadius * 2) / settings.printSpeed / 60; // minutes
  const estimatedTime = layerCount * timePerLayer * 1.3; // 30% overhead for travel/retraction
  
  const isValid = !warnings.some(w => w.type === 'error');
  
  return {
    isValid,
    warnings,
    estimatedTime,
    materialWeight,
    materialLength,
    layerCount,
    maxOverhang,
    minWallThickness: effectiveWall,
    baseContactArea: baseArea,
    centerOfMass: { x: 0, y: params.height * 0.4, z: 0 },
    needsSupport,
  };
}

// Generate batch variations
export function generateBatchVariations(
  baseParams: ParametricParams,
  count: number,
  variationStrength: number = 0.1
): ParametricParams[] {
  const variations: ParametricParams[] = [];
  
  for (let i = 0; i < count; i++) {
    const varied = { ...baseParams };
    
    // Vary organic parameters within printable limits
    varied.bulgeAmount = clamp(baseParams.bulgeAmount + (Math.random() - 0.5) * variationStrength, 0, 0.5);
    varied.bulgePosition = clamp(baseParams.bulgePosition + (Math.random() - 0.5) * variationStrength * 0.5, 0.2, 0.8);
    varied.twistAngle = clamp(baseParams.twistAngle + (Math.random() - 0.5) * variationStrength * 60, 0, 180);
    varied.wobbleFrequency = Math.round(clamp(baseParams.wobbleFrequency + (Math.random() - 0.5) * 4, 0, 8));
    varied.rippleCount = Math.round(clamp(baseParams.rippleCount + (Math.random() - 0.5) * 6, 0, 16));
    varied.asymmetry = clamp(baseParams.asymmetry + (Math.random() - 0.5) * variationStrength * 0.1, 0, 0.1);
    
    variations.push(varied);
  }
  
  return variations;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
