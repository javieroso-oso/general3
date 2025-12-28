import { ParametricParams, PrintSettings } from './parametric';

// Socket types with real dimensions (mm)
export type SocketType = 'E26' | 'E27' | 'E12' | 'GU10' | 'G9' | 'LED_Strip';

// Bulb shapes for ghost preview
export type BulbShape = 'A19' | 'A21' | 'Globe' | 'Candle' | 'Edison' | 'PAR30' | 'Tube';

// Stand types (Akari-inspired modular system)
export type StandType = 'tripod' | 'pendant_cord' | 'wall_arm';

// Cord routing options
export type CordExit = 'bottom_center' | 'bottom_side' | 'top_hidden' | 'internal_channel';

// Light pattern cutout types
export type LightPatternType = 'none' | 'dots' | 'lines' | 'organic' | 'geometric';

// Standard rim sizes (shade must match stand)
export type StandardRimSize = 100 | 150 | 200 | 250;

// Shade-stand connection type
export type RimConnectionType = 'drop_in' | 'clip_on' | 'friction_fit';

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

// Hardware shopping list item
export interface HardwareItem {
  name: string;
  specification: string;
  notes: string;
  searchTerm: string;
}

// Complete hardware shopping list
export interface HardwareShoppingList {
  socket: HardwareItem;
  cord: HardwareItem;
  bulb: HardwareItem;
  additionalItems: HardwareItem[];
  assemblySteps: string[];
}

// ============================================
// AKARI-INSPIRED MODULAR SYSTEM
// Shade + Stand as separate printable parts
// ============================================

// Shade configuration (purely decorative)
export interface ShadeConfig {
  rimDiameter: StandardRimSize;      // Must match stand
  rimConnection: RimConnectionType;  // How it connects to stand
  rimThickness: number;              // mm - thickness of rim edge
  rimLipHeight: number;              // mm - height of lip for drop-in
}

// Stand hardware configuration
export interface StandHardware {
  socketType: SocketType;
  bulbShape: BulbShape;
  bulbWattage: number;
  cordDiameter: number;   // mm
}

// Base stand parameters (shared across all types)
export interface BaseStandParams {
  type: StandType;
  rimDiameter: StandardRimSize;      // Must match shade
  socketType: SocketType;
  height: number;                    // mm - total height
  wallThickness: number;             // mm
}

// Tripod stand (table/floor lamp)
export interface TripodStandParams extends BaseStandParams {
  type: 'tripod';
  legCount: 3 | 4;
  legSpread: number;        // degrees from vertical
  legThickness: number;     // mm - leg cross-section
  socketHolderHeight: number; // mm - central column height
}

// Pendant cord stand (ceiling lamp)
export interface PendantCordParams extends BaseStandParams {
  type: 'pendant_cord';
  canopyDiameter: number;   // mm - ceiling mount
  canopyHeight: number;     // mm
  cordLength: number;       // mm (visual only)
}

// Wall arm stand (sconce)
export interface WallArmParams extends BaseStandParams {
  type: 'wall_arm';
  armLength: number;        // mm
  armAngle: number;         // degrees from horizontal
  backplateWidth: number;   // mm
  backplateHeight: number;  // mm
}

export type StandParams = TripodStandParams | PendantCordParams | WallArmParams;

// Complete lamp hardware config (socket + bulb + stand)
export interface LampHardware {
  socketType: SocketType;
  bulbShape: BulbShape;
  bulbWattage: number;
  cordDiameter: number;     // mm
  standType: StandType;
}

// Lamp shade parameters (organic shape + rim)
export interface LampParams extends ParametricParams {
  // Shade rim (where it rests on stand)
  shade: ShadeConfig;
  
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

// Stand parameters (structure that holds hardware)
export interface LampStand {
  params: StandParams;
  hardware: StandHardware;
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
  stand: StandParams;
  thumbnail?: string;
}

// Default shade config
export const defaultShadeConfig: ShadeConfig = {
  rimDiameter: 150,
  rimConnection: 'drop_in',
  rimThickness: 3,
  rimLipHeight: 8,
};

// Default stand params
export const defaultTripodParams: TripodStandParams = {
  type: 'tripod',
  rimDiameter: 150,
  socketType: 'E26',
  height: 250,
  wallThickness: 3,
  legCount: 3,
  legSpread: 35,
  legThickness: 8,
  socketHolderHeight: 80,
};

export const defaultPendantCordParams: PendantCordParams = {
  type: 'pendant_cord',
  rimDiameter: 150,
  socketType: 'E26',
  height: 60,
  wallThickness: 3,
  canopyDiameter: 100,
  canopyHeight: 25,
  cordLength: 1000,
};

export const defaultWallArmParams: WallArmParams = {
  type: 'wall_arm',
  rimDiameter: 150,
  socketType: 'E26',
  height: 150,
  wallThickness: 3,
  armLength: 180,
  armAngle: 15,
  backplateWidth: 100,
  backplateHeight: 140,
};

// Default lamp hardware
export const defaultLampHardware: LampHardware = {
  socketType: 'E26',
  bulbShape: 'A19',
  bulbWattage: 10,
  cordDiameter: 6,
  standType: 'tripod',
};

// Get default stand params for a stand type
export const getDefaultStandParams = (type: StandType): StandParams => {
  switch (type) {
    case 'tripod':
      return { ...defaultTripodParams };
    case 'pendant_cord':
      return { ...defaultPendantCordParams };
    case 'wall_arm':
      return { ...defaultWallArmParams };
  }
};

// Calculate socket holder dimensions for stand
export const getSocketHolderDimensions = (socketType: SocketType) => {
  const socket = socketDimensions[socketType];
  return {
    innerDiameter: socket.outerDiameter + 1, // Tight fit
    outerDiameter: socket.outerDiameter + 8, // Wall thickness
    height: socket.height + 10,              // Extra for cord
    cordHole: 8,                              // Standard cord hole
  };
};

// Generate hardware shopping list from current selection
export const generateShoppingList = (
  hardware: LampHardware,
  material: PrintSettings['material']
): HardwareShoppingList => {
  const bulb = bulbDimensions[hardware.bulbShape];
  const heatLimit = materialHeatLimits[material];
  
  const socketNames: Record<SocketType, string> = {
    E26: 'E26 Medium Base Socket',
    E27: 'E27 Edison Screw Socket',
    E12: 'E12 Candelabra Socket',
    GU10: 'GU10 Bi-Pin Socket',
    G9: 'G9 Bi-Pin Socket',
    LED_Strip: 'LED Strip Connector',
  };
  
  const bulbNames: Record<BulbShape, string> = {
    A19: 'A19 Standard LED Bulb',
    A21: 'A21 Large LED Bulb',
    Globe: 'G25 Globe LED Bulb',
    Candle: 'B11 Candle LED Bulb',
    Edison: 'ST64 Edison LED Bulb',
    PAR30: 'PAR30 Flood LED Bulb',
    Tube: 'T10 Tube LED Bulb',
  };
  
  const list: HardwareShoppingList = {
    socket: {
      name: socketNames[hardware.socketType],
      specification: `${hardware.socketType} base, keyless`,
      notes: 'Standard socket with cord hole at bottom',
      searchTerm: `${hardware.socketType} lamp socket keyless`,
    },
    cord: {
      name: '18/2 SPT-1 Lamp Cord with Plug',
      specification: `${hardware.cordDiameter}mm diameter, 6-8 feet`,
      notes: 'Pre-wired with plug preferred',
      searchTerm: 'lamp cord with plug 18 gauge',
    },
    bulb: {
      name: bulbNames[hardware.bulbShape],
      specification: `Ø${bulb.diameter}mm, max ${Math.min(hardware.bulbWattage, heatLimit.maxWattage)}W`,
      notes: hardware.bulbWattage > heatLimit.maxWattage 
        ? `⚠️ ${material} max ${heatLimit.maxWattage}W LED` 
        : 'LED recommended for low heat',
      searchTerm: `LED ${hardware.bulbShape} bulb ${Math.min(hardware.bulbWattage, heatLimit.maxWattage)}W`,
    },
    additionalItems: [],
    assemblySteps: [],
  };
  
  // Stand-specific items and assembly
  if (hardware.standType === 'tripod') {
    list.assemblySteps = [
      '1. Print the shade and tripod stand',
      '2. Thread cord up through stand legs and socket holder',
      '3. Wire cord terminals to socket',
      '4. Push socket into the socket holder (friction fit)',
      '5. Place shade on rim ring - it just drops in!',
      '6. Install bulb and test',
    ];
  } else if (hardware.standType === 'pendant_cord') {
    list.additionalItems.push({
      name: 'Ceiling Canopy Kit',
      specification: 'Matches cord diameter',
      notes: 'Covers ceiling junction box (or use printed canopy)',
      searchTerm: 'pendant light canopy kit',
    });
    list.assemblySteps = [
      '1. Print the shade and pendant bracket (with canopy)',
      '2. Wire cord to socket in the pendant bracket',
      '3. Mount canopy to ceiling junction box',
      '4. Hang shade on bracket rim - it just drops in!',
      '5. Install bulb and test',
    ];
  } else if (hardware.standType === 'wall_arm') {
    list.additionalItems.push({
      name: 'Wall Mounting Hardware',
      specification: '2× screws + anchors',
      notes: 'For mounting backplate to wall',
      searchTerm: 'wall sconce mounting screws',
    });
    list.assemblySteps = [
      '1. Print the shade and wall arm (with backplate)',
      '2. Mount backplate to wall using screws/anchors',
      '3. Route cord through arm to socket holder',
      '4. Wire cord to socket',
      '5. Place shade on arm rim ring',
      '6. Install bulb and test',
    ];
  }
  
  return list;
};

// Default lamp params (Akari-style: pure decorative shade)
export const defaultLampParams: LampParams = {
  // Base parametric shape
  height: 180,
  baseRadius: 60,
  topRadius: 100,
  wallThickness: 2.0,
  // Integrated legs
  addLegs: false,
  standType: 'tripod',
  legStyle: 'tripod',
  legCount: 3,
  legHeight: 100,
  legSpread: 30,
  legThickness: 4,
  legTaper: 0.6,
  legInset: 0.3,
  // Stand-specific parameters
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
  // Body-to-stand attachment
  attachmentType: 'screw_m3',
  screwCount: 3,
  wobbleFrequency: 0,
  wobbleAmplitude: 0,
  twistAngle: 0,
  bulgePosition: 0.5,
  bulgeAmount: 0.15,
  pinchAmount: 0,
  asymmetry: 0,
  rippleCount: 0,
  rippleDepth: 0,
  lipFlare: 0.08,
  lipHeight: 0.05,
  organicNoise: 0,
  noiseScale: 1,
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
  baseThickness: 0,
  baseType: 'flat',
  baseSizeMode: 'auto',
  standBaseRadius: 50,
  standBaseThickness: 3,
  standBaseTaper: 0,
  standBaseEdgeStyle: 'flat',
  standBaseLip: 0,
  cordHoleEnabled: true,
  cordHoleDiameter: 8,
  centeringLipEnabled: true,
  centeringLipHeight: 3,
  socketType: 'E26',
  supportFreeMode: false,
  showOverhangMap: false,
  showBaseOnly: false,
  previewColor: '#e8e8e8',
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
  stackingEnabled: false,
  topInterface: 'none',
  bottomInterface: 'none',
  stackingConnectorType: 'press_fit',
  stackingConnectorDiameter: 15,
  stackingConnectorDepth: 6,
  
  // Shade rim config
  shade: defaultShadeConfig,
  
  // Ventilation (optional)
  ventilationSlots: false,
  ventSlotCount: 6,
  ventSlotWidth: 5,
  ventSlotHeight: 20,
  
  // Light patterns
  lightPatternType: 'none',
  patternDensity: 0.3,
  patternSize: 8,
  patternDepth: 0.8,
  
  // Translucency
  translucencyEnabled: false,
  translucencyZoneStart: 0.3,
  translucencyZoneEnd: 0.7,
  translucencyThickness: 0.8,
};
