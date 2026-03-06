export type ObjectType = 'shape' | 'plotter';

// Shape style determines 3D-specific features (sockets, stands)
export type ShapeStyle = 'vase' | 'lamp' | 'sculpture';

// Alias for backward compatibility - 3D object types only (same as ShapeStyle)
export type ObjectType3D = ShapeStyle;

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
  // Shape style - determines 3D-specific features like lamp sockets
  shapeStyle: ShapeStyle;
  
  // Basic dimensions (mm for printing)
  height: number;
  baseRadius: number;
  topRadius: number;
  wallThickness: number;
  
  // Integrated legs (extending from base)
  addLegs: boolean;
  standType: StandType;       // Type of stand/support structure
  legStyle: LegStyle;         // Style of legs (tripod, riser, column, ball)
  legCount: 3 | 4;
  legHeight: number;          // Stand height in mm
  legSpread: number;          // Angle in degrees (15-45)
  legThickness: number;       // Leg thickness in mm (4-8)
  legTaper: number;           // Taper factor (0-1)
  legInset: number;           // How far inward from edge (0-1)
  
  // Wall mount parameters (planar cut style - no separate plate)
  wallMountCutOffset: number;       // mm - distance from center for cut plane (0 = exact half, positive = keep more)
  wallMountHoleCount: 2 | 3 | 4;    // number of mounting holes on flat back
  wallMountHoleDiameter: number;    // mm - mounting hole diameter
  wallMountHoleStyle: 'round' | 'keyhole' | 'countersink'; // hole style
  wallMountHoleMargin: number;      // 0-1 - distance from edge as percentage of available space
  wallMountCordHoleEnabled: boolean; // add cord exit hole through flat back
  wallMountStyle: 'back' | 'base';  // mounting style: back (flat cut) or base (plate with keyholes)
  
  // Hardware attachment bracket (separate printable piece)
  wallMountBracketEnabled: boolean;  // Enable separate hardware bracket
  wallMountBracketWidth: number;     // mm - bracket width
  wallMountBracketHeight: number;    // mm - bracket height
  wallMountBracketThickness: number; // mm - bracket plate thickness
  wallMountBracketHoleSpacing: number; // mm - spacing between screw holes
  
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
  // The spine is a continuous 3D curve that defines the center-line of the body
  spineEnabled: boolean;
  spineAmplitudeX: number;      // 0-50 mm: maximum lateral displacement in X
  spineFrequencyX: number;      // 0-4: number of half-periods (2 = one S-curve)
  spinePhaseX: number;          // 0-1: phase offset normalized
  spineAmplitudeZ: number;      // 0-50 mm: maximum lateral displacement in Z
  spineFrequencyZ: number;      // 0-4: number of half-periods
  spinePhaseZ: number;          // 0-1: phase offset normalized
  
  // Melt effect: vertical offset simulating gravity pulling softened material
  // δy(t, θ) = -M × envelope(t) × (1 + α × sin(nθ + φ))
  // where envelope(t) = ((t - delay) / (1 - delay))² for t > delay, else 0
  meltAmount: number;           // 0-30 mm: maximum vertical droop at top
  meltLobes: number;            // 0-8: number of angular variations (lobes)
  meltVariation: number;        // 0-1: amplitude of angular variation (α)
  meltPhase: number;            // 0-1: phase offset for angular variation
  meltDelay: number;            // 0-0.8: height at which melt begins (simulates viscosity gradient)
  
  // Lateral drag: sideways drift proportional to melt, simulating flow
  // δx = D × envelope(t) × cos(dragAngle), δz = D × envelope(t) × sin(dragAngle)
  meltDragAmount: number;       // 0-30 mm: how far sideways the top drifts
  meltDragAngle: number;        // 0-1: direction of drag (normalized to 0-2π)
  
  // Advanced body customization - Faceting
  facetCount: number;           // 0 = smooth, 6 = hexagonal, 8 = octagonal, etc.
  facetSharpness: number;       // 0-1: 0 = rounded facets, 1 = sharp edges
  
  // Spiral grooves
  spiralGrooveCount: number;    // 0-8: number of spiral grooves
  spiralGrooveDepth: number;    // 0-0.15: how deep the grooves cut
  spiralGrooveTwist: number;    // 1-10: how many turns around the body
  
  // Horizontal ribs
  horizontalRibCount: number;   // 0-20: number of horizontal ribs
  horizontalRibDepth: number;   // 0-0.1: depth of ribs
  horizontalRibWidth: number;   // 0.1-0.5: width of each rib as fraction of spacing
  
  // Fluting (vertical grooves)
  flutingCount: number;         // 0-24: number of vertical grooves
  flutingDepth: number;         // 0-0.15: depth of flutes
  
  // Rim waves
  rimWaveCount: number;         // 0-12: number of waves around the rim
  rimWaveDepth: number;         // 0-0.3: how much the rim dips/rises
  
  // Profile curve type
  profileCurve: 'linear' | 'convex' | 'concave' | 'hourglass' | 'wave';
  
  // Base for printing
  baseThickness: number;
  
  // Stand base sizing control
  baseSizeMode: 'auto' | 'tray' | 'custom';  // auto = fit bottom, tray = max radius, custom = user-defined
  standBaseRadius: number;  // mm - custom base radius when baseSizeMode is 'custom'
  
  // Pedestal-style base controls
  standBaseThickness: number;       // mm - height of the base disc (2-30mm)
  standBaseTaper: number;           // 0-0.5 - taper from bottom to top
  standBaseEdgeStyle: 'flat' | 'rounded' | 'chamfer';  // edge profile style
  standBaseLip: number;             // mm - raised lip height around edge (0-10mm)
  standBaseLipThickness: number;    // mm - lip wall thickness (1.5-8mm)
  standBaseLipEdgeStyle: 'flat' | 'rounded' | 'chamfer';  // lip top edge profile
  
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
  
  // Mold generation (for ceramics slip-casting)
  moldEnabled: boolean;              // Toggle mold generation mode
  moldWallThickness: number;         // mm - thickness of mold walls (15-50mm)
  moldBaseThickness: number;         // mm - thickness of mold base (10-30mm)
  moldPourHoleDiameter: number;      // mm - pour hole diameter (15-40mm)
  moldPourHoleTaper: number;         // degrees - funnel taper angle (5-30)
  moldRegistrationKeySize: number;   // mm - size of registration keys (5-15mm)
  moldRegistrationKeyCount: number;  // number of keys per seam (2-6)
  moldSplitAngle: number;            // degrees - rotation of split plane (0-180)
  moldDraftAngle: number;            // degrees - draft angle for easier demolding (0-5)
  moldGap: number;                   // mm - gap between halves for preview (0-20mm)
  moldOffset: number;                // mm - shrinkage/clearance offset (0-2mm)
  
  // Multi-part mold
  moldPartCount: 2 | 3 | 4;          // Number of mold parts (2, 3, or 4)
  moldAutoSplit: boolean;            // Use geometry-based automatic split detection
  moldSplitAngles?: number[];        // Manual override for split positions (radians)
  moldShowPartingLines: boolean;     // Show parting line visualization in preview
  
  // Mold colors for preview
  moldColors: string[];              // Hex colors for each mold part
  
  // Mold enhancements
  moldVentHolesEnabled: boolean;     // Toggle vent holes for air escape
  moldVentHoleCount: number;         // Number of vent holes (2-8)
  moldVentHoleDiameter: number;      // mm - vent hole diameter (2-5mm)
  moldVentHolePosition: number;      // 0-1 - position along height
  
  moldSpareEnabled: boolean;         // Toggle spare/reservoir collar
  moldSpareHeight: number;           // mm - height of spare collar (10-30mm)
  moldSpareDiameter: number;         // mm - diameter of spare (0 = auto)
  
  moldStrapNotchesEnabled: boolean;  // Toggle strap notches
  moldStrapNotchCount: number;       // Number of notches (2-4)
  moldStrapNotchWidth: number;       // mm - notch width (8-15mm)
  moldStrapNotchDepth: number;       // mm - notch depth (3-6mm)
  
  moldShowGhostBody: boolean;        // Show body outline inside mold
  
  // Wireframe lamp mode (structural ribs/rings for fabric shade)
  wireframeMode: boolean;
  wireframeRibCount: number;         // 4-24: number of vertical ribs
  wireframeRingCount: number;        // 2-10: number of horizontal rings
  wireframeThickness: number;        // 2-8mm: cross-section thickness of ribs/rings
  wireframeRibStyle: 'straight' | 'curved' | 'twisted';
  wireframeMountRingHeight: number;  // 3-15mm: height of top/bottom mounting rings

  // Light perforations (holes for light pass-through)
  lightPatternEnabled: boolean;      // Toggle light perforation pattern
  lightPatternType: 'dots' | 'lines' | 'organic' | 'geometric' | 'spiral';
  lightPatternDensity: number;       // 0.1-1 holes per unit area
  lightPatternSize: number;          // 2-15mm hole diameter
  lightPatternZoneStart: number;     // 0-0.9 height fraction where pattern begins
  lightPatternZoneEnd: number;       // 0.1-1 height fraction where pattern ends
  lightPatternRandomness: number;    // 0-1 placement variation
  lightPatternScaleWithHeight: boolean; // Holes get larger toward top
  lightPatternRimMargin: number;     // 0-0.2 avoid rim zone
  
  // Preview mode
  showBaseOnly: boolean;     // Show only base/legs without body for easier editing
  previewColor: string;      // Hex color for preview rendering
}

// Print modes
export type PrintMode = 'standard' | 'vase_spiral' | 'non_planar';

// Non-planar printing settings
export interface NonPlanarSettings {
  maxZAngle: number;           // Maximum nozzle tilt angle (degrees, typically 15-45°)
  curvedLayers: boolean;       // Enable curved layer paths
  topSurfaceOptimized: boolean; // Optimize top surface with curved layers
  fullSurfaceLayers: boolean;  // Stage 2: Follow entire object surface contour
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
  
  // Build plate dimensions for centering
  buildPlateWidth: number;    // mm (default 200)
  buildPlateDepth: number;    // mm (default 200)
  
  // Advanced print modes
  printMode: PrintMode;
  spiralVase: boolean;        // Spiral vase mode (single wall, continuous Z)
  nonPlanar: NonPlanarSettings;
}

// Non-planar printing analysis
export interface NonPlanarAnalysis {
  maxTiltAngle: number;           // Maximum tilt angle encountered (degrees)
  avgTiltAngle: number;           // Average tilt angle (degrees)
  nonPlanarLayerCount: number;    // Number of layers with non-planar paths
  totalLayerCount: number;        // Total layer count
  collisionRiskZones: Array<{     // Zones where collision might occur
    layerIndex: number;
    tiltAngle: number;
    x: number;
    y: number;
    z: number;
  }>;
  exceedsMaxAngle: boolean;       // True if any point exceeds configured max angle
  isSafeForPrinting: boolean;     // Overall safety assessment
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
  nonPlanarAnalysis?: NonPlanarAnalysis;  // Non-planar printing analysis (when in non-planar mode)
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
  type: ShapeStyle;  // Use ShapeStyle for presets (3D shapes only)
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
  minWallThickness: 1.2,      // mm - minimum for structural integrity
  maxWallThickness: 10,       // mm
  minBaseThickness: 0.8,      // mm
  maxOverhangAngle: 45,       // degrees without support
  minBaseRadius: 10,          // mm for stability
  maxHeight: 300,             // mm - typical printer limit
  minHeight: 10,              // mm
  minBaseContactArea: 200,    // mm² for bed adhesion
};

// Helper to create default params - reduces repetition
const createDefaultParams = (overrides: Partial<ParametricParams> = {}): ParametricParams => {
  const defaults: ParametricParams = {
    shapeStyle: 'vase',
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
    // Wireframe lamp mode - defaults
    wireframeMode: false,
    wireframeRibCount: 8,
    wireframeRingCount: 4,
    wireframeThickness: 3,
    wireframeRibStyle: 'curved',
    wireframeMountRingHeight: 5,
    // Light perforations - defaults
    lightPatternEnabled: false,
    lightPatternType: 'dots',
    lightPatternDensity: 0.3,
    lightPatternSize: 5,
    lightPatternZoneStart: 0.2,
    lightPatternZoneEnd: 0.8,
    lightPatternRandomness: 0.2,
    lightPatternScaleWithHeight: false,
    lightPatternRimMargin: 0.1,
    showBaseOnly: false,
    previewColor: '#e8e8e8',
  };
  return { ...defaults, ...overrides } as ParametricParams;
};

// Default params keyed by ShapeStyle
export const defaultShapeParams: Record<ShapeStyle, ParametricParams> = {
  vase: createDefaultParams(),
  lamp: createDefaultParams({
    height: 100,
    baseRadius: 30,
    topRadius: 60,
    wallThickness: 1.6,
    legHeight: 100,
    legSpread: 30,
    legThickness: 4,
    legTaper: 0.6,
    bulgePosition: 0.7,
    bulgeAmount: 0.1,
    cordHoleEnabled: true,
    centeringLipEnabled: true,
  }),
  sculpture: createDefaultParams({
    height: 150,
    baseRadius: 35,
    topRadius: 25,
    wallThickness: 3.0,
    legCount: 4,
    legHeight: 60,
    legSpread: 20,
    legThickness: 6,
    legTaper: 0.4,
    wobbleFrequency: 3,
    wobbleAmplitude: 0.08,
    twistAngle: 30,
    bulgePosition: 0.5,
    bulgeAmount: 0.25,
    pinchAmount: 0.05,
    asymmetry: 0.05,
    lipFlare: 0,
    lipHeight: 0,
    organicNoise: 0.03,
    noiseScale: 2,
    baseThickness: 2.4,
    wallMountCordHoleEnabled: false,
    cordHoleEnabled: false,
  }),
};

// Legacy alias for backward compatibility
export const defaultParams: Record<ObjectType, ParametricParams> = {
  shape: defaultShapeParams.vase, // Default shape uses vase style
  plotter: createDefaultParams(), // Plotter uses PlotterParams instead, this is a fallback
};

export const presets: Preset[] = [
  { id: 'classic-vase', name: 'Classic', type: 'vase', params: { ...defaultShapeParams.vase } },
  { id: 'belly-vase', name: 'Belly', type: 'vase', params: { ...defaultShapeParams.vase, bulgePosition: 0.35, bulgeAmount: 0.35, lipFlare: 0.12 } },
  { id: 'twisted-vase', name: 'Twisted', type: 'vase', params: { ...defaultShapeParams.vase, twistAngle: 90, wobbleFrequency: 3, wobbleAmplitude: 0.06 } },
  { id: 'rippled-vase', name: 'Rippled', type: 'vase', params: { ...defaultShapeParams.vase, rippleCount: 8, rippleDepth: 0.04, bulgeAmount: 0.2 } },
  { id: 'modern-lamp', name: 'Modern', type: 'lamp', params: { ...defaultShapeParams.lamp } },
  { id: 'spiral-lamp', name: 'Spiral', type: 'lamp', params: { ...defaultShapeParams.lamp, twistAngle: 120, wobbleFrequency: 4, wobbleAmplitude: 0.05 } },
  { id: 'organic-sculpture', name: 'Organic', type: 'sculpture', params: { ...defaultShapeParams.sculpture, organicNoise: 0.06, asymmetry: 0.08, bulgeAmount: 0.35 } },
  { id: 'minimal-sculpture', name: 'Minimal', type: 'sculpture', params: { ...defaultShapeParams.sculpture, wobbleFrequency: 0, twistAngle: 0, organicNoise: 0, bulgeAmount: 0.1 } },
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
