/**
 * Clean Base System Types
 * 
 * This module defines the core types for the lamp base system with clear separation:
 * - SocketMount: How the light source attaches (LED, bulb socket)
 * - Stand: The structural support (tripod legs, weighted disc, wall mount)
 * - Connector: How body and base connect (integrated, press-fit, threaded)
 */

// ============ SOCKET/LIGHT SOURCE TYPES ============

export type SocketMountType = 'press-fit-ring' | 'led-puck' | 'led-strip';

export type BulbSocketType = 'E26' | 'E12' | 'E14' | 'GU10';

// Socket thread diameters in mm
export const SOCKET_THREAD_DIAMETERS: Record<BulbSocketType, number> = {
  'E26': 26,   // US/Japan standard - 26mm thread diameter
  'E12': 12,   // Candelabra - 12mm thread diameter  
  'E14': 14,   // European candelabra - 14mm thread diameter
  'GU10': 35,  // GU10 uses pin base ~35mm body
};

export interface SocketMountConfig {
  type: SocketMountType;
  
  // For traditional bulb sockets
  socketType?: BulbSocketType;
  clearance?: number;           // mm added to socket diameter (default: 0.5)
  lipHeight?: number;           // mm height of centering lip (default: 3)
  
  // For LED pucks
  puckDiameter?: number;        // mm - diameter of LED puck recess
  puckDepth?: number;           // mm - depth of recess
  
  // Common
  cordHoleEnabled?: boolean;    // Enable cord exit hole
  cordHoleDiameter?: number;    // mm - cord hole diameter (default: 8)
}

export const DEFAULT_SOCKET_CONFIG: SocketMountConfig = {
  type: 'press-fit-ring',
  socketType: 'E26',
  clearance: 0.5,
  lipHeight: 3,
  cordHoleEnabled: true,
  cordHoleDiameter: 8,
};

// ============ STAND TYPES ============

export type StandType = 'tripod' | 'weighted-disc' | 'wall-mount';

export interface TripodConfig {
  legCount: 3 | 4;
  legHeight: number;            // mm
  legSpread: number;            // degrees (15-45)
  legThickness: number;         // mm (3-10)
  legTaper: number;             // 0-1
  legInset: number;             // 0-1 how far from edge
}

export interface WeightedDiscConfig {
  discDiameter: number;         // mm
  discThickness: number;        // mm (5-15)
  weightCavityEnabled: boolean;
  weightCavityDiameter: number; // mm - for coins/washers
  weightCavityDepth: number;    // mm
  rubberFeetEnabled: boolean;
  rubberFeetCount: 3 | 4;
  rubberFeetDiameter: number;   // mm - recess diameter
}

export interface WallMountConfig {
  style: 'back-cut' | 'base-plate';
  
  // For back-cut style
  cutOffset: number;            // mm from center
  
  // Mounting holes
  holeCount: 2 | 3 | 4;
  holeType: 'keyhole' | 'round' | 'countersink';
  holeDiameter: number;         // mm
  holeMargin: number;           // 0-1 distance from edge
  
  // Cord
  cordHoleEnabled: boolean;
}

export interface StandConfig {
  type: StandType;
  tripod?: TripodConfig;
  weightedDisc?: WeightedDiscConfig;
  wallMount?: WallMountConfig;
  
  // Common base styling
  baseThickness: number;        // mm
  baseTaper: number;            // 0-0.5
  baseEdgeStyle: 'flat' | 'rounded' | 'chamfer';
  baseLip: number;              // mm raised edge
}

export const DEFAULT_TRIPOD_CONFIG: TripodConfig = {
  legCount: 3,
  legHeight: 80,
  legSpread: 25,
  legThickness: 5,
  legTaper: 0.5,
  legInset: 0.3,
};

export const DEFAULT_WEIGHTED_DISC_CONFIG: WeightedDiscConfig = {
  discDiameter: 100,
  discThickness: 8,
  weightCavityEnabled: true,
  weightCavityDiameter: 60,
  weightCavityDepth: 4,
  rubberFeetEnabled: true,
  rubberFeetCount: 3,
  rubberFeetDiameter: 10,
};

export const DEFAULT_WALL_MOUNT_CONFIG: WallMountConfig = {
  style: 'back-cut',
  cutOffset: 0,
  holeCount: 2,
  holeType: 'keyhole',
  holeDiameter: 5,
  holeMargin: 0.15,
  cordHoleEnabled: true,
};

export const DEFAULT_STAND_CONFIG: StandConfig = {
  type: 'tripod',
  tripod: DEFAULT_TRIPOD_CONFIG,
  baseThickness: 3,
  baseTaper: 0,
  baseEdgeStyle: 'flat',
  baseLip: 0,
};

// ============ CONNECTOR TYPES ============

export type ConnectorType = 'integrated' | 'press-fit' | 'threaded-insert' | 'screw-m3' | 'screw-m4' | 'bayonet';

export interface ConnectorConfig {
  type: ConnectorType;
  tolerance: number;            // mm - press-fit tolerance (0.2-0.4)
  insertDepth: number;          // mm - how deep connector goes into body
  screwCount?: 3 | 4;           // for screw types
}

export const DEFAULT_CONNECTOR_CONFIG: ConnectorConfig = {
  type: 'integrated',
  tolerance: 0.3,
  insertDepth: 5,
};

// Screw specifications
export const SCREW_SPECS = {
  m3: {
    clearanceHole: 3.4,
    nutAcrossFlats: 5.5,
    nutThickness: 2.4,
    headDiameter: 5.5,
    headDepth: 3,
  },
  m4: {
    clearanceHole: 4.5,
    nutAcrossFlats: 7,
    nutThickness: 3.2,
    headDiameter: 7,
    headDepth: 4,
  },
};

// Bayonet specifications
export const BAYONET_SPECS = {
  tabWidth: 5,
  tabHeight: 3,
  tabDepth: 4,
  slotWidth: 5.5,
  slotLength: 8,
  rotationAngle: 30,
};

// ============ COMPLETE BASE CONFIG ============

export interface BaseConfig {
  enabled: boolean;
  socket: SocketMountConfig;
  stand: StandConfig;
  connector: ConnectorConfig;
}

export const DEFAULT_BASE_CONFIG: BaseConfig = {
  enabled: false,
  socket: DEFAULT_SOCKET_CONFIG,
  stand: DEFAULT_STAND_CONFIG,
  connector: DEFAULT_CONNECTOR_CONFIG,
};

// ============ FUNCTIONAL PRESETS ============

export const BASE_PRESETS = {
  'table-lamp-tripod': {
    enabled: true,
    socket: { 
      type: 'press-fit-ring' as SocketMountType, 
      socketType: 'E26' as BulbSocketType, 
      cordHoleEnabled: true,
      cordHoleDiameter: 8,
      lipHeight: 3,
    },
    stand: { 
      type: 'tripod' as StandType, 
      tripod: DEFAULT_TRIPOD_CONFIG,
      baseThickness: 3,
      baseTaper: 0,
      baseEdgeStyle: 'flat' as const,
      baseLip: 0,
    },
    connector: { type: 'integrated' as ConnectorType, tolerance: 0.3, insertDepth: 5 },
  },
  'table-lamp-weighted': {
    enabled: true,
    socket: { 
      type: 'press-fit-ring' as SocketMountType, 
      socketType: 'E26' as BulbSocketType, 
      cordHoleEnabled: true,
      cordHoleDiameter: 8,
      lipHeight: 3,
    },
    stand: { 
      type: 'weighted-disc' as StandType, 
      weightedDisc: DEFAULT_WEIGHTED_DISC_CONFIG,
      baseThickness: 8,
      baseTaper: 0.1,
      baseEdgeStyle: 'chamfer' as const,
      baseLip: 0,
    },
    connector: { type: 'press-fit' as ConnectorType, tolerance: 0.3, insertDepth: 8 },
  },
  'led-puck-lamp': {
    enabled: true,
    socket: { 
      type: 'led-puck' as SocketMountType, 
      puckDiameter: 50,
      puckDepth: 10,
      cordHoleEnabled: false,
    },
    stand: { 
      type: 'tripod' as StandType, 
      tripod: { ...DEFAULT_TRIPOD_CONFIG, legHeight: 60 },
      baseThickness: 3,
      baseTaper: 0,
      baseEdgeStyle: 'flat' as const,
      baseLip: 0,
    },
    connector: { type: 'integrated' as ConnectorType, tolerance: 0.3, insertDepth: 5 },
  },
  'wall-sconce': {
    enabled: true,
    socket: { 
      type: 'press-fit-ring' as SocketMountType, 
      socketType: 'E12' as BulbSocketType, 
      cordHoleEnabled: true,
      cordHoleDiameter: 6,
      lipHeight: 3,
    },
    stand: { 
      type: 'wall-mount' as StandType, 
      wallMount: DEFAULT_WALL_MOUNT_CONFIG,
      baseThickness: 3,
      baseTaper: 0,
      baseEdgeStyle: 'flat' as const,
      baseLip: 0,
    },
    connector: { type: 'integrated' as ConnectorType, tolerance: 0.3, insertDepth: 5 },
  },
} as const;
