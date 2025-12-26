export type ObjectType = 'vase' | 'lamp' | 'sculpture';

// Stand types - different structural support options
export type StandType = 'tripod' | 'wall_mount';

// Wall mount options (simplified - no separate plate needed)

// Attachment types for body-to-stand connection
export type AttachmentType = 'integrated' | 'screw_m3' | 'screw_m4' | 'bayonet';

// Screw specifications for M3 and M4
export const SCREW_SPECS = {
  m3: {
    clearanceHole: 3.4,      // mm - hole diameter in base for screw to pass through
    nutAcrossFlats: 5.5,     // mm - hex nut size
    nutThickness: 2.4,       // mm - depth of nut recess
    headDiameter: 5.5,       // mm - screw head diameter
    headDepth: 3,            // mm - countersink depth
  },
  m4: {
    clearanceHole: 4.5,
    nutAcrossFlats: 7,
    nutThickness: 3.2,
    headDiameter: 7,
    headDepth: 4,
  },
};

// Bayonet lock specifications
export const BAYONET_SPECS = {
  tabWidth: 5,              // mm - width of locking tab
  tabHeight: 3,             // mm - height of tab protrusion
  tabDepth: 4,              // mm - depth of tab
  slotLength: 8,            // mm - L-slot vertical portion
  slotWidth: 5.5,           // mm - slot width (tab width + clearance)
  rotationAngle: 30,        // degrees - how far to twist to lock
};

export interface ParametricParams {
  // Basic dimensions (mm for printing)
  height: number;
  baseRadius: number;
  topRadius: number;
  wallThickness: number;
  
  // Integrated legs (extending from base)
  addLegs: boolean;
  standType: StandType;       // Type of stand/support structure
  legCount: 3 | 4;
  legHeight: number;          // Stand height in mm
  legSpread: number;          // Angle in degrees (15-45)
  legThickness: number;       // Leg thickness in mm (4-8)
  legTaper: number;           // Taper factor (0-1)
  legInset: number;           // How far inward from edge (0-1)
  
  // Stand-specific parameters
  pedestalDiameter: number;   // mm - pedestal base diameter
  pedestalTaper: number;      // 0-1 - taper from bottom to top
  pedestalHollow: boolean;    // Hollow for cord routing
  
  wireframeRibCount: number;  // 4-8 ribs for wireframe cage
  wireframeRingCount: number; // 2-4 horizontal rings
  wireframeThickness: number; // mm - rib/ring thickness
  
  pendantCanopyDiameter: number; // mm - ceiling canopy diameter
  pendantCanopyHeight: number;   // mm - canopy dome height
  pendantCordLength: number;     // mm - visual cord length in preview
  
  // Wall mount parameters (planar cut style - no separate plate)
  wallMountCutOffset: number;       // mm - distance from center for cut plane (0 = exact half, positive = keep more)
  wallMountHoleCount: 2 | 3 | 4;    // number of mounting holes on flat back
  wallMountHoleDiameter: number;    // mm - mounting hole diameter
  wallMountHoleStyle: 'round' | 'keyhole' | 'countersink'; // hole style
  wallMountHoleMargin: number;      // 0-1 - distance from edge as percentage of available space
  wallMountCordHoleEnabled: boolean; // add cord exit hole through flat back
  wallMountStyle: 'back' | 'base';  // mounting style: back (flat cut) or base (plate with keyholes)
  
  // Legacy wall bracket (kept for compatibility)
  wallBracketArmLength: number;  // mm - arm extension from wall
  wallBracketArmAngle: number;   // degrees - arm angle from horizontal
  wallBracketPlateSize: number;  // mm - wall plate dimensions
  
  ringBaseDiameter: number;      // mm - ring base diameter
  ringBaseThickness: number;     // mm - ring tube thickness
  
  // Body-to-stand attachment
  attachmentType: AttachmentType;
  screwCount: 3 | 4;          // Number of screws for screw mount
  
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
  
  // Cord exit hole in base (for lamp wiring)
  cordHoleEnabled: boolean;     // Toggle cord exit hole
  cordHoleDiameter: number;     // mm - cord exit hole diameter
  
  // Centering lip sized to socket (raised ring for socket alignment)
  centeringLipEnabled: boolean;  // Toggle centering lip
  centeringLipHeight: number;    // mm - height of centering lip (2-5mm)
  socketType: 'E26' | 'E12' | 'E14' | 'GU10';  // Socket type for lip sizing
  
  // Support-free printing mode
  supportFreeMode: boolean;
  showOverhangMap: boolean;
}

// Print modes
export type PrintMode = 'standard' | 'vase_spiral' | 'non_planar';

// Non-planar printing settings
export interface NonPlanarSettings {
  maxZAngle: number;           // Maximum nozzle tilt angle (degrees, typically 15-45°)
  curvedLayers: boolean;       // Enable curved layer paths
  topSurfaceOptimized: boolean; // Optimize top surface with curved layers
  adaptiveLayerHeight: boolean; // Vary layer height based on surface angle
  minLayerHeight: number;       // Minimum layer height for adaptive (mm)
  maxLayerHeight: number;       // Maximum layer height for adaptive (mm)
}

export interface PrintSettings {
  layerHeight: number;        // mm
  nozzleDiameter: number;     // mm
  infillPercent: number;      // 0-100
  printSpeed: number;         // mm/s
  material: 'PLA' | 'PETG' | 'ABS' | 'TPU';
  supportEnabled: boolean;
  brimWidth: number;          // mm
  
  // Advanced print modes
  printMode: PrintMode;
  spiralVase: boolean;        // Spiral vase mode (single wall, continuous Z)
  nonPlanar: NonPlanarSettings;
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
  guaranteedSupportFree: boolean;  // true when supportFreeMode is on and constraints met
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

export const defaultNonPlanarSettings: NonPlanarSettings = {
  maxZAngle: 30,
  curvedLayers: false,
  topSurfaceOptimized: false,
  adaptiveLayerHeight: false,
  minLayerHeight: 0.1,
  maxLayerHeight: 0.3,
};

export const defaultPrintSettings: PrintSettings = {
  layerHeight: 0.2,
  nozzleDiameter: 0.4,
  infillPercent: 15,
  printSpeed: 50,
  material: 'PLA',
  supportEnabled: false,
  brimWidth: 5,
  printMode: 'standard',
  spiralVase: false,
  nonPlanar: defaultNonPlanarSettings,
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
    height: 120,
    baseRadius: 40,
    topRadius: 35,
    wallThickness: 2.0,
    addLegs: false,
    standType: 'tripod',
    legCount: 3,
    legHeight: 80,
    legSpread: 25,
    legThickness: 5,
    legTaper: 0.5,
    legInset: 0.3,
    pedestalDiameter: 60,
    pedestalTaper: 0.3,
    pedestalHollow: true,
    wireframeRibCount: 6,
    wireframeRingCount: 3,
    wireframeThickness: 4,
    pendantCanopyDiameter: 80,
    pendantCanopyHeight: 20,
    pendantCordLength: 100,
    wallBracketArmLength: 150,
    wallBracketArmAngle: 15,
    wallBracketPlateSize: 80,
    ringBaseDiameter: 100,
    ringBaseThickness: 8,
    attachmentType: 'integrated',
    screwCount: 3,
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
    cordHoleEnabled: false,
    cordHoleDiameter: 8,
    centeringLipEnabled: false,
    centeringLipHeight: 3,
    socketType: 'E26',
    supportFreeMode: false,
    showOverhangMap: false,
    wallMountCutOffset: 0,
    wallMountHoleCount: 2,
    wallMountHoleDiameter: 5,
    wallMountHoleStyle: 'round',
    wallMountHoleMargin: 0.15,
    wallMountCordHoleEnabled: true,
    wallMountStyle: 'back',
  },
  lamp: {
    height: 100,
    baseRadius: 30,
    topRadius: 60,
    wallThickness: 1.6,
    addLegs: false,
    standType: 'tripod',
    legCount: 3,
    legHeight: 100,
    legSpread: 30,
    legThickness: 4,
    legTaper: 0.6,
    legInset: 0.3,
    pedestalDiameter: 50,
    pedestalTaper: 0.2,
    pedestalHollow: true,
    wireframeRibCount: 6,
    wireframeRingCount: 3,
    wireframeThickness: 3,
    pendantCanopyDiameter: 80,
    pendantCanopyHeight: 20,
    pendantCordLength: 100,
    wallBracketArmLength: 150,
    wallBracketArmAngle: 15,
    wallBracketPlateSize: 80,
    ringBaseDiameter: 80,
    ringBaseThickness: 6,
    attachmentType: 'screw_m3',
    screwCount: 3,
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
    cordHoleEnabled: true,
    cordHoleDiameter: 8,
    centeringLipEnabled: true,
    centeringLipHeight: 3,
    socketType: 'E26',
    supportFreeMode: false,
    showOverhangMap: false,
    wallMountCutOffset: 0,
    wallMountHoleCount: 2,
    wallMountHoleDiameter: 5,
    wallMountHoleStyle: 'round',
    wallMountHoleMargin: 0.15,
    wallMountCordHoleEnabled: true,
    wallMountStyle: 'back',
  },
  sculpture: {
    height: 150,
    baseRadius: 35,
    topRadius: 25,
    wallThickness: 3.0,
    addLegs: false,
    standType: 'tripod',
    legCount: 4,
    legHeight: 60,
    legSpread: 20,
    legThickness: 6,
    legTaper: 0.4,
    legInset: 0.3,
    pedestalDiameter: 70,
    pedestalTaper: 0.15,
    pedestalHollow: false,
    wireframeRibCount: 8,
    wireframeRingCount: 3,
    wireframeThickness: 5,
    pendantCanopyDiameter: 100,
    pendantCanopyHeight: 25,
    pendantCordLength: 150,
    wallBracketArmLength: 200,
    wallBracketArmAngle: 10,
    wallBracketPlateSize: 100,
    ringBaseDiameter: 100,
    ringBaseThickness: 8,
    attachmentType: 'integrated',
    screwCount: 4,
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
    cordHoleEnabled: false,
    cordHoleDiameter: 8,
    centeringLipEnabled: false,
    centeringLipHeight: 3,
    socketType: 'E26',
    supportFreeMode: false,
    showOverhangMap: false,
    wallMountCutOffset: 0,
    wallMountHoleCount: 2,
    wallMountHoleDiameter: 5,
    wallMountHoleStyle: 'round',
    wallMountHoleMargin: 0.15,
    wallMountCordHoleEnabled: false,
    wallMountStyle: 'back',
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
  
  // Check if support-free mode guarantees no supports needed
  const guaranteedSupportFree = params.supportFreeMode && maxOverhang <= printConstraints.maxOverhangAngle;
  
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
    guaranteedSupportFree,
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
    varied.asymmetry = clamp(baseParams.asymmetry + (Math.random() - 0.5) * variationStrength * 0.35, 0, 0.35);
    
    variations.push(varied);
  }
  
  return variations;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
