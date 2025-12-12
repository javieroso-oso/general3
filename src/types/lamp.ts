import { ParametricParams, PrintSettings } from './parametric';

// Socket types with real dimensions (mm)
export type SocketType = 'E26' | 'E27' | 'E12' | 'GU10' | 'G9' | 'LED_Strip';

// Bulb shapes for ghost preview
export type BulbShape = 'A19' | 'A21' | 'Globe' | 'Candle' | 'Edison' | 'PAR30' | 'Tube';

// Mounting/lamp styles
export type LampStyle = 'pendant' | 'standing' | 'wall_sconce';

// Cord routing options
export type CordExit = 'bottom_center' | 'bottom_side' | 'top_hidden' | 'internal_channel';

// Light pattern cutout types
export type LightPatternType = 'none' | 'dots' | 'lines' | 'organic' | 'geometric';

// Mount types for socket attachment
export type MountType = 'threaded_ring' | 'press_fit' | 'snap_ring';

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

// Threaded ring specifications (hardware you buy)
export interface ThreadedRingSpec {
  ringInnerDiameter: number;  // mm - fits over socket
  ringOuterDiameter: number;  // mm - seats in shade lip
  ringHeight: number;         // mm - depth of ring
  threadPitch: number;        // mm - for reference
}

// Mounting dimensions calculated from hardware selection
export interface MountingDimensions {
  holeDiameter: number;       // mm - main opening
  lipDepth: number;           // mm - how deep ring/collar seats
  lipInnerDiameter: number;   // mm - inner edge of lip
}

// Style-specific mounting parameters
export interface MountingParams {
  // Pendant - canopy at top
  canopyDiameter: number;      // mm
  canopyHeight: number;        // mm
  cordChannelDiameter: number; // mm
  
  // Wall sconce - backplate and arm
  backplateWidth: number;      // mm
  backplateHeight: number;     // mm
  armLength: number;           // mm
  armAngle: number;            // degrees
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
  threadedRing?: HardwareItem;
  snapRing?: HardwareItem;
  additionalItems: HardwareItem[];
  assemblySteps: string[];
}

export interface LampHardware {
  socketType: SocketType;
  bulbShape: BulbShape;
  bulbWattage: number;
  cordExit: CordExit;
  cordDiameter: number;   // mm
  lampStyle: LampStyle;
  mountType: MountType;
  mountTolerance: number; // mm - printer calibration (0.2-0.5)
}

export interface LampParams extends ParametricParams {
  // Socket mounting (auto-calculated, kept for compatibility)
  socketMountingHeight: number;  // mm from bottom (usually near top)
  socketHoleDiameter: number;    // mm - now auto-calculated but stored
  
  // Mounting parameters (style-specific)
  mounting: MountingParams;
  
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

// Threaded ring specs lookup (real hardware measurements)
export const threadedRingSpecs: Record<SocketType, ThreadedRingSpec> = {
  E26: { ringInnerDiameter: 33, ringOuterDiameter: 42, ringHeight: 10, threadPitch: 2.5 },
  E27: { ringInnerDiameter: 34, ringOuterDiameter: 43, ringHeight: 10, threadPitch: 2.5 },
  E12: { ringInnerDiameter: 18, ringOuterDiameter: 26, ringHeight: 6, threadPitch: 1.5 },
  GU10: { ringInnerDiameter: 50, ringOuterDiameter: 60, ringHeight: 8, threadPitch: 0 }, // twist-lock
  G9: { ringInnerDiameter: 15, ringOuterDiameter: 22, ringHeight: 8, threadPitch: 1.0 },
  LED_Strip: { ringInnerDiameter: 10, ringOuterDiameter: 18, ringHeight: 5, threadPitch: 0 },
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

// Default mounting params
export const defaultMountingParams: MountingParams = {
  // Pendant
  canopyDiameter: 100,
  canopyHeight: 15,
  cordChannelDiameter: 8,
  // Wall sconce
  backplateWidth: 80,
  backplateHeight: 120,
  armLength: 60,
  armAngle: 15,
};

// Default lamp hardware
export const defaultLampHardware: LampHardware = {
  socketType: 'E26',
  bulbShape: 'A19',
  bulbWattage: 10,
  cordExit: 'top_hidden',
  cordDiameter: 6,
  lampStyle: 'pendant',
  mountType: 'threaded_ring',
  mountTolerance: 0.3,
};

// Calculate mounting dimensions based on hardware selection
export const getMountingDimensions = (
  socketType: SocketType,
  mountType: MountType,
  tolerance: number
): MountingDimensions => {
  const socket = socketDimensions[socketType];
  const ring = threadedRingSpecs[socketType];
  
  switch (mountType) {
    case 'threaded_ring':
      return {
        holeDiameter: ring.ringOuterDiameter + tolerance,
        lipDepth: ring.ringHeight + 1,
        lipInnerDiameter: ring.ringInnerDiameter + tolerance,
      };
    case 'press_fit':
      return {
        holeDiameter: socket.outerDiameter + tolerance,
        lipDepth: socket.collarHeight,
        lipInnerDiameter: socket.outerDiameter - tolerance * 0.5, // undersized for friction
      };
    case 'snap_ring':
      return {
        holeDiameter: socket.outerDiameter + tolerance + 4, // extra space for ring
        lipDepth: 3,
        lipInnerDiameter: socket.outerDiameter + tolerance,
      };
  }
};

// Generate hardware shopping list from current selection
export const generateShoppingList = (
  hardware: LampHardware,
  material: PrintSettings['material']
): HardwareShoppingList => {
  const socket = socketDimensions[hardware.socketType];
  const ring = threadedRingSpecs[hardware.socketType];
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
      specification: `${hardware.socketType} base, Ø${socket.outerDiameter}mm`,
      notes: hardware.mountType === 'threaded_ring' 
        ? 'Must include threaded shade ring' 
        : 'Standard socket without ring',
      searchTerm: `${hardware.socketType} lamp socket ${hardware.mountType === 'threaded_ring' ? 'with threaded ring' : ''}`,
    },
    cord: {
      name: '18/2 SPT-1 Lamp Cord',
      specification: `${hardware.cordDiameter}mm diameter`,
      notes: 'Length as needed, typically 6-8 feet',
      searchTerm: 'lamp cord 18 gauge SPT-1',
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
  
  // Add mount-specific items
  if (hardware.mountType === 'threaded_ring') {
    list.threadedRing = {
      name: `${hardware.socketType} Threaded Shade Ring`,
      specification: `Ø${ring.ringOuterDiameter}mm outer, ${ring.ringHeight}mm height`,
      notes: 'Usually included with socket, verify before purchase',
      searchTerm: `${hardware.socketType} lamp shade ring threaded`,
    };
    list.assemblySteps = [
      '1. Thread cord through shade bottom opening',
      '2. Wire cord to socket terminals',
      '3. Place threaded ring in shade lip (seats on ledge)',
      '4. Screw socket into threaded ring from below',
      '5. Install bulb and test',
    ];
  } else if (hardware.mountType === 'press_fit') {
    list.assemblySteps = [
      '1. Thread cord through shade bottom opening',
      '2. Wire cord to socket terminals',
      '3. Press socket into shade collar (friction fit)',
      '4. Ensure socket is fully seated and secure',
      '5. Install bulb and test',
    ];
  } else {
    list.snapRing = {
      name: 'Lamp Socket Snap Ring',
      specification: `Ø${socket.outerDiameter + 2}mm internal`,
      notes: 'C-clip style retaining ring',
      searchTerm: 'lamp socket retaining ring snap',
    };
    list.assemblySteps = [
      '1. Thread cord through shade bottom opening',
      '2. Wire cord to socket terminals', 
      '3. Insert snap ring into shade groove',
      '4. Drop socket through ring (ring holds socket)',
      '5. Install bulb and test',
    ];
  }
  
  // Style-specific items
  if (hardware.lampStyle === 'pendant') {
    list.additionalItems.push({
      name: 'Ceiling Canopy Kit',
      specification: 'Matches cord diameter',
      notes: 'Covers ceiling junction box',
      searchTerm: 'pendant light canopy kit',
    });
  } else if (hardware.lampStyle === 'wall_sconce') {
    list.additionalItems.push({
      name: 'Wall Mounting Hardware',
      specification: '2× screws + anchors',
      notes: 'For mounting backplate to wall',
      searchTerm: 'wall sconce mounting screws',
    });
  }
  
  return list;
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
  baseThickness: 0,
  baseType: 'flat',
  
  // Lamp-specific
  socketMountingHeight: 145,
  socketHoleDiameter: 40,
  mounting: defaultMountingParams,
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
