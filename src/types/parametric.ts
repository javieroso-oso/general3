export type ObjectType = 'shape' | 'plotter';

// Surface stroke for drawing-to-3D feature
export type TexturePattern = 'dots' | 'crosshatch' | 'zigzag';

export interface SurfaceStroke {
  id: string;
  points: { u: number; v: number }[];  // u=0..1 (angle around body), v=0..1 (height)
  thickness: number;     // tube diameter in mm
  effect: 'raised' | 'engraved' | 'ribbon' | 'cut' | 'texture';
  depth: number;         // how far it protrudes or cuts in (mm)
  texturePattern?: TexturePattern; // only used when effect = 'texture'
  offsetU?: number;      // post-draw U offset (rotation around body), default 0
  offsetV?: number;      // post-draw V offset (shift up/down), default 0
  strokeScale?: number;  // post-draw scale factor, default 1
}

// Stand types - different structural support options
export type StandType = 'tripod' | 'wall_mount' | 'weighted_disc';

// Leg styles for tripod/riser stands
export type LegStyle = 'tripod' | 'riser' | 'column' | 'bun';

// Socket mount types for light source
export type SocketMountType = 'press-fit-ring' | 'led-puck' | 'led-strip' | 'none';

// Bulb socket types
export type BulbSocketType = 'E26' | 'E12' | 'E14' | 'GU10';

// Socket thread diameters in mm
export const SOCKET_THREAD_DIAMETERS: Record<BulbSocketType, number> = {
  E26: 26,
  E12: 12,
  E14: 14,
  GU10: 35,
};

export interface ParametricParams {
  // Basic dimensions (mm for printing)
  height: number;
  baseRadius: number;
  topRadius: number;
  wallThickness: number;
  
  // Integrated legs (extending from base)
  addLegs: boolean;
  standType: StandType;
  legStyle: LegStyle;
  legCount: 3 | 4;
  legHeight: number;
  legSpread: number;
  legThickness: number;
  legTaper: number;
  legInset: number;
  
  // Wall mount parameters
  wallMountCutOffset: number;
  wallMountHoleCount: 2 | 3 | 4;
  wallMountHoleDiameter: number;
  wallMountHoleStyle: 'round' | 'keyhole' | 'countersink';
  wallMountHoleMargin: number;
  wallMountCordHoleEnabled: boolean;
  wallMountStyle: 'back' | 'base';
  
  // Hardware attachment bracket
  wallMountBracketEnabled: boolean;
  wallMountBracketWidth: number;
  wallMountBracketHeight: number;
  wallMountBracketThickness: number;
  wallMountBracketHoleSpacing: number;
  
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
  
  // Spine-based geometry
  spineEnabled: boolean;
  spineAmplitudeX: number;
  spineFrequencyX: number;
  spinePhaseX: number;
  spineAmplitudeZ: number;
  spineFrequencyZ: number;
  spinePhaseZ: number;
  
  // Melt effect
  meltAmount: number;
  meltLobes: number;
  meltVariation: number;
  meltPhase: number;
  meltDelay: number;
  
  // Lateral drag
  meltDragAmount: number;
  meltDragAngle: number;
  
  // Advanced body customization - Faceting
  facetCount: number;
  facetSharpness: number;
  
  // Spiral grooves
  spiralGrooveCount: number;
  spiralGrooveDepth: number;
  spiralGrooveTwist: number;
  
  // Horizontal ribs
  horizontalRibCount: number;
  horizontalRibDepth: number;
  horizontalRibWidth: number;
  
  // Fluting (vertical grooves)
  flutingCount: number;
  flutingDepth: number;
  
  // Rim waves
  rimWaveCount: number;
  rimWaveDepth: number;
  
  // Profile curve type
  profileCurve: 'linear' | 'convex' | 'concave' | 'hourglass' | 'wave';

  // Roundness (superellipse exponent on height profile), split per half.
  // 0 = cylinder (default), 0.5 = soft pill, 1 = full sphere/ellipsoid.
  // `roundness` is kept for backwards compat and acts as a fallback when
  // top/bottom are not set.
  roundness: number;
  roundnessTop: number;
  roundnessBottom: number;

  // Smooth-blended lobes ("metaball" stack along the height axis)
  // 0 or 1 disables the effect; 2-4 stacks lobes that fuse into one continuous skin
  lobeCount: number;
  lobeBlend: number;          // 0..1 — higher = smoother fusion between lobes
  lobeSizeVariation: number;  // 0..1 — random size offset per lobe (deterministic)
  lobeHeightVariation: number; // 0..1 — random height offset per lobe

  // Flat bottom — keeps the base flat for printability when roundness/lobes
  // would otherwise curve the body inward at t=0.
  flatBottom: boolean;
  flatBottomHeight: number;   // 0..0.25 — fraction of total height held flat
  
  // Base for printing
  baseThickness: number;
  
  // Stand base sizing control
  baseSizeMode: 'auto' | 'tray' | 'custom';
  standBaseRadius: number;
  
  // Pedestal-style base controls
  standBaseThickness: number;
  standBaseTaper: number;
  standBaseEdgeStyle: 'flat' | 'rounded' | 'chamfer';
  standBaseLip: number;
  standBaseLipThickness: number;
  standBaseLipEdgeStyle: 'flat' | 'rounded' | 'chamfer';
  
  // Cord exit hole in base (for lamp wiring)
  cordHoleEnabled: boolean;
  cordHoleDiameter: number;
  
  // Centering lip sized to socket
  centeringLipEnabled: boolean;
  centeringLipHeight: number;
  socketType: 'E26' | 'E12' | 'E14' | 'GU10';
  
  // Support-free printing mode
  supportFreeMode: boolean;
  showOverhangMap: boolean;
  
  // Mold generation (for ceramics slip-casting)
  moldEnabled: boolean;
  moldWallThickness: number;
  moldBaseThickness: number;
  moldPourHoleDiameter: number;
  moldPourHoleTaper: number;
  moldRegistrationKeySize: number;
  moldRegistrationKeyCount: number;
  moldSplitAngle: number;
  moldDraftAngle: number;
  moldGap: number;
  moldOffset: number;
  
  // Multi-part mold
  moldPartCount: 2 | 3 | 4;
  moldAutoSplit: boolean;
  moldSplitAngles?: number[];
  moldShowPartingLines: boolean;
  
  // Mold colors for preview
  moldColors: string[];
  
  // Mold enhancements
  moldVentHolesEnabled: boolean;
  moldVentHoleCount: number;
  moldVentHoleDiameter: number;
  moldVentHolePosition: number;
  
  moldSpareEnabled: boolean;
  moldSpareHeight: number;
  moldSpareDiameter: number;
  
  moldStrapNotchesEnabled: boolean;
  moldStrapNotchCount: number;
  moldStrapNotchWidth: number;
  moldStrapNotchDepth: number;
  
  moldShowGhostBody: boolean;
  
  // Wireframe lamp mode (structural ribs/rings for fabric shade)
  wireframeMode: boolean;
  wireframeRibCount: number;
  wireframeRingCount: number;
  wireframeThickness: number;
  wireframeRibStyle: 'straight' | 'curved' | 'twisted';
  wireframeMountRingHeight: number;
  wireframeCrossSection: 'round' | 'square' | 'flat';
  wireframeJointBulge: number;
  wireframeFlatBase: boolean;
  wireframeRingThickness: number;
  wireframeDiagonalBracing: boolean;
  wireframeBraceFrequency: number;

  // Organic wireframe deformation
  wireframeOrganic: number;
  wireframeOrganicSeed: number;
  wireframeThicknessVariation: number;

  // Light perforations (holes for light pass-through)
  lightPatternEnabled: boolean;
  lightPatternType: 'dots' | 'lines' | 'organic' | 'geometric' | 'spiral';
  lightPatternDensity: number;
  lightPatternSize: number;
  lightPatternZoneStart: number;
  lightPatternZoneEnd: number;
  lightPatternRandomness: number;
  lightPatternScaleWithHeight: boolean;
  lightPatternRimMargin: number;
  
  // Surface art strokes
  surfaceStrokes: SurfaceStroke[];
  surfaceStrokesVisible: boolean;
  // Global placement for all strokes
  surfaceGlobalOffsetU: number;  // rotate all strokes around body (0..1 = 0..360°)
  surfaceGlobalOffsetV: number;  // shift all strokes up/down (fraction of height)
  surfaceGlobalScale: number;    // scale all strokes from center

  // Base plate (for spiral vase mode + LED puck light)
  basePlateEnabled: boolean;
  basePlatePuckDiameter: number;
  basePlatePuckDepth: number;
  basePlateThickness: number;

  // Funky Skin — XY-only surface texture (Bambu A1 safe)
  skinTextureMode: 'off' | 'fuzz' | 'knurl' | 'scales' | 'ribs' | 'brushed' | 'pixel';
  skinTextureAmplitude: number;       // 0..0.8 mm
  skinTextureDensity: number;         // pattern-specific (count / cell size / freq)
  skinTextureDirection: 'outward' | 'inward' | 'both'; // fuzz / pixel only
  skinTextureStartHeightPct: number;  // 0..0.3 — skip first N% (brim safety)
  skinTextureEndHeightPct: number;    // 0..0.3 — skip last N% (rim safety)
  skinTextureSeed: number;

  // Preview mode
  showBaseOnly: boolean;
  previewColor: string;
}

// Print modes
export type PrintMode = 'standard' | 'vase_spiral' | 'non_planar';

// Non-planar printing settings
export interface NonPlanarSettings {
  maxZAngle: number;
  curvedLayers: boolean;
  topSurfaceOptimized: boolean;
  fullSurfaceLayers: boolean;
  adaptiveLayerHeight: boolean;
  minLayerHeight: number;
  maxLayerHeight: number;
}

export interface PrintSettings {
  layerHeight: number;
  nozzleDiameter: number;
  infillPercent: number;
  printSpeed: number;
  material: 'PLA' | 'PETG' | 'ABS' | 'TPU';
  supportEnabled: boolean;
  brimWidth: number;
  
  buildPlateWidth: number;
  buildPlateDepth: number;
  
  printMode: PrintMode;
  spiralVase: boolean;
  nonPlanar: NonPlanarSettings;
}

// Non-planar printing analysis
export interface NonPlanarAnalysis {
  maxTiltAngle: number;
  avgTiltAngle: number;
  nonPlanarLayerCount: number;
  totalLayerCount: number;
  collisionRiskZones: Array<{
    layerIndex: number;
    tiltAngle: number;
    x: number;
    y: number;
    z: number;
  }>;
  exceedsMaxAngle: boolean;
  isSafeForPrinting: boolean;
}

export interface PrintAnalysis {
  isValid: boolean;
  warnings: PrintWarning[];
  estimatedTime: number;
  materialWeight: number;
  materialLength: number;
  layerCount: number;
  maxOverhang: number;
  minWallThickness: number;
  baseContactArea: number;
  centerOfMass: { x: number; y: number; z: number };
  needsSupport: boolean;
  guaranteedSupportFree: boolean;
  nonPlanarAnalysis?: NonPlanarAnalysis;
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
  params: ParametricParams;
}

export const defaultNonPlanarSettings: NonPlanarSettings = {
  maxZAngle: 30,
  curvedLayers: false,
  topSurfaceOptimized: false,
  fullSurfaceLayers: false,
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
  buildPlateWidth: 200,
  buildPlateDepth: 200,
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
  minWallThickness: 1.2,
  maxWallThickness: 10,
  minBaseThickness: 0.8,
  maxOverhangAngle: 45,
  minBaseRadius: 10,
  maxHeight: 300,
  minHeight: 10,
  minBaseContactArea: 200,
};

// Helper to create default params
const createDefaultParams = (overrides: Partial<ParametricParams> = {}): ParametricParams => {
  const defaults: ParametricParams = {
    height: 120,
    baseRadius: 40,
    topRadius: 35,
    wallThickness: 2.0,
    addLegs: false,
    standType: 'tripod',
    legStyle: 'tripod',
    legCount: 3,
    legHeight: 80,
    legSpread: 25,
    legThickness: 5,
    legTaper: 0.5,
    legInset: 0.3,
    wallMountCutOffset: 0,
    wallMountHoleCount: 2,
    wallMountHoleDiameter: 5,
    wallMountHoleStyle: 'round',
    wallMountHoleMargin: 0.15,
    wallMountCordHoleEnabled: true,
    wallMountStyle: 'back',
    wallMountBracketEnabled: false,
    wallMountBracketWidth: 60,
    wallMountBracketHeight: 80,
    wallMountBracketThickness: 5,
    wallMountBracketHoleSpacing: 50,
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
    spineEnabled: false,
    spineAmplitudeX: 0,
    spineFrequencyX: 2,
    spinePhaseX: 0,
    spineAmplitudeZ: 0,
    spineFrequencyZ: 2,
    spinePhaseZ: 0.25,
    meltAmount: 0,
    meltLobes: 3,
    meltVariation: 0.3,
    meltPhase: 0,
    meltDelay: 0,
    meltDragAmount: 0,
    meltDragAngle: 0,
    facetCount: 0,
    facetSharpness: 0.5,
    spiralGrooveCount: 0,
    spiralGrooveDepth: 0,
    spiralGrooveTwist: 2,
    horizontalRibCount: 0,
    horizontalRibDepth: 0,
    horizontalRibWidth: 0.3,
    flutingCount: 0,
    flutingDepth: 0,
    rimWaveCount: 0,
    rimWaveDepth: 0,
    profileCurve: 'linear',
    roundness: 0,
    roundnessTop: 0,
    roundnessBottom: 0,
    lobeCount: 1,
    lobeBlend: 0.5,
    lobeSizeVariation: 0.2,
    lobeHeightVariation: 0,
    flatBottom: true,
    flatBottomHeight: 0.08,
    baseThickness: 2.0,
    baseSizeMode: 'auto',
    standBaseRadius: 50,
    standBaseThickness: 3,
    standBaseTaper: 0,
    standBaseEdgeStyle: 'flat',
    standBaseLip: 0,
    standBaseLipThickness: 2,
    standBaseLipEdgeStyle: 'flat',
    cordHoleEnabled: false,
    cordHoleDiameter: 8,
    centeringLipEnabled: false,
    centeringLipHeight: 3,
    socketType: 'E26',
    supportFreeMode: false,
    showOverhangMap: false,
    moldEnabled: false,
    moldWallThickness: 25,
    moldBaseThickness: 15,
    moldPourHoleDiameter: 25,
    moldPourHoleTaper: 15,
    moldRegistrationKeySize: 8,
    moldRegistrationKeyCount: 4,
    moldSplitAngle: 0,
    moldDraftAngle: 2,
    moldGap: 10,
    moldOffset: 0.5,
    moldPartCount: 2,
    moldAutoSplit: false,
    moldShowPartingLines: false,
    moldColors: ['#C97B5D', '#7B9E87', '#8B7EC7', '#CBA670'],
    moldVentHolesEnabled: false,
    moldVentHoleCount: 4,
    moldVentHoleDiameter: 3,
    moldVentHolePosition: 0.8,
    moldSpareEnabled: false,
    moldSpareHeight: 20,
    moldSpareDiameter: 0,
    moldStrapNotchesEnabled: false,
    moldStrapNotchCount: 2,
    moldStrapNotchWidth: 12,
    moldStrapNotchDepth: 4,
    moldShowGhostBody: true,
    wireframeMode: false,
    wireframeRibCount: 8,
    wireframeRingCount: 4,
    wireframeThickness: 3,
    wireframeRibStyle: 'curved',
    wireframeMountRingHeight: 5,
    wireframeCrossSection: 'round',
    wireframeJointBulge: 0.5,
    wireframeFlatBase: true,
    wireframeRingThickness: 1.0,
    wireframeDiagonalBracing: false,
    wireframeBraceFrequency: 1,
    wireframeOrganic: 0,
    wireframeOrganicSeed: 42,
    wireframeThicknessVariation: 0,
    lightPatternEnabled: false,
    lightPatternType: 'dots',
    lightPatternDensity: 0.3,
    lightPatternSize: 5,
    lightPatternZoneStart: 0.2,
    lightPatternZoneEnd: 0.8,
    lightPatternRandomness: 0.2,
    lightPatternScaleWithHeight: false,
    lightPatternRimMargin: 0.1,
    basePlateEnabled: false,
    basePlatePuckDiameter: 70,
    basePlatePuckDepth: 10,
    basePlateThickness: 15,
    surfaceStrokes: [],
    surfaceStrokesVisible: true,
    surfaceGlobalOffsetU: 0,
    surfaceGlobalOffsetV: 0,
    surfaceGlobalScale: 1,
    skinTextureMode: 'off',
    skinTextureAmplitude: 0.3,
    skinTextureDensity: 1,
    skinTextureDirection: 'both',
    skinTextureStartHeightPct: 0.05,
    skinTextureEndHeightPct: 0.05,
    skinTextureSeed: 1337,
    showBaseOnly: false,
    previewColor: '#e8e8e8',
  };
  return { ...defaults, ...overrides } as ParametricParams;
};

// Single default params for Shape mode
export const defaultShapeParams: ParametricParams = createDefaultParams();

// Default params keyed by ObjectType
export const defaultParams: Record<ObjectType, ParametricParams> = {
  shape: defaultShapeParams,
  plotter: createDefaultParams(),
};

export const presets: Preset[] = [
  { id: 'classic', name: 'Classic', params: createDefaultParams() },
  { id: 'belly', name: 'Belly', params: createDefaultParams({ bulgePosition: 0.35, bulgeAmount: 0.35, lipFlare: 0.12 }) },
  { id: 'twisted', name: 'Twisted', params: createDefaultParams({ twistAngle: 90, wobbleFrequency: 3, wobbleAmplitude: 0.06 }) },
  { id: 'rippled', name: 'Rippled', params: createDefaultParams({ rippleCount: 8, rippleDepth: 0.04, bulgeAmount: 0.2 }) },
  { id: 'modern-lamp', name: 'Modern Lamp', params: createDefaultParams({ height: 100, baseRadius: 30, topRadius: 60, wallThickness: 1.6, bulgePosition: 0.7, bulgeAmount: 0.1, cordHoleEnabled: true, centeringLipEnabled: true }) },
  { id: 'spiral-lamp', name: 'Spiral Lamp', params: createDefaultParams({ height: 100, baseRadius: 30, topRadius: 60, wallThickness: 1.6, twistAngle: 120, wobbleFrequency: 4, wobbleAmplitude: 0.05, cordHoleEnabled: true, centeringLipEnabled: true }) },
  { id: 'organic', name: 'Organic', params: createDefaultParams({ height: 150, baseRadius: 35, topRadius: 25, wallThickness: 3.0, organicNoise: 0.06, asymmetry: 0.08, bulgeAmount: 0.35, wobbleFrequency: 3, wobbleAmplitude: 0.08, twistAngle: 30 }) },
  { id: 'minimal', name: 'Minimal', params: createDefaultParams({ height: 150, baseRadius: 35, topRadius: 25, wallThickness: 3.0, wobbleFrequency: 0, twistAngle: 0, organicNoise: 0, bulgeAmount: 0.1, lipFlare: 0, lipHeight: 0 }) },
  { id: 'cable-pass', name: 'Cable Pass', params: createDefaultParams({ height: 80, baseRadius: 50, topRadius: 45, wallThickness: 3.0, cordHoleEnabled: true, cordHoleDiameter: 60, centeringLipEnabled: false, baseThickness: 3.0 }) },
];

// Analyze printability
export function analyzePrint(params: ParametricParams, settings: PrintSettings): PrintAnalysis {
  const warnings: PrintWarning[] = [];
  
  const effectiveWall = params.wallThickness - (params.wobbleAmplitude * params.baseRadius * 0.5);
  if (effectiveWall < printConstraints.minWallThickness) {
    warnings.push({
      type: 'error',
      code: 'THIN_WALL',
      message: `Wall thickness too thin (${effectiveWall.toFixed(1)}mm)`,
      suggestion: `Increase wall thickness to at least ${printConstraints.minWallThickness}mm or reduce wobble amplitude`,
    });
  }
  
  const baseArea = Math.PI * params.baseRadius * params.baseRadius;
  if (baseArea < printConstraints.minBaseContactArea) {
    warnings.push({
      type: 'warning',
      code: 'SMALL_BASE',
      message: `Base contact area is small (${baseArea.toFixed(0)}mm²)`,
      suggestion: 'Consider using a brim or increasing base radius for better adhesion',
    });
  }
  
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
  
  if (params.height > printConstraints.maxHeight) {
    warnings.push({
      type: 'error',
      code: 'TOO_TALL',
      message: `Height exceeds printer limit (${params.height}mm > ${printConstraints.maxHeight}mm)`,
      suggestion: 'Reduce height or print in multiple parts',
    });
  }
  
  if (params.asymmetry > 0.15) {
    warnings.push({
      type: 'warning',
      code: 'ASYMMETRY',
      message: 'High asymmetry may cause print instability',
      suggestion: 'Consider reducing asymmetry or printing with a raft',
    });
  }
  
  const avgRadius = (params.baseRadius + params.topRadius) / 2;
  const shellVolume = Math.PI * params.height * (
    Math.pow(avgRadius, 2) - Math.pow(avgRadius - params.wallThickness, 2)
  );
  const baseVolume = Math.PI * params.baseRadius * params.baseRadius * params.baseThickness;
  const totalVolume = (shellVolume + baseVolume) * (1 + settings.infillPercent / 100 * 0.3);
  
  const materialWeight = (totalVolume / 1000) * materialDensities[settings.material];
  const materialLength = totalVolume / (Math.PI * Math.pow(1.75 / 2, 2)) / 1000;
  
  const layerCount = Math.ceil(params.height / settings.layerHeight);
  const perimeterLength = 2 * Math.PI * avgRadius * 2;
  const timePerLayer = (perimeterLength + avgRadius * 2) / settings.printSpeed / 60;
  const estimatedTime = layerCount * timePerLayer * 1.3;
  
  const isValid = !warnings.some(w => w.type === 'error');
  
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
