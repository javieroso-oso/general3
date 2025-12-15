import { SocketType, socketDimensions } from './lamp';
import { RimSize, rimSizes } from './parametric';

// ============================================
// UNIVERSAL STANDARD RIM COLLAR SYSTEM
// Object has visible collar at base, stand has socket cradle
// Inspired by WOOJ Design and Akari lamps
// ============================================

// Socket cradle specifications (where object's collar sits)
export const socketCradleSpecs = {
  wallThickness: 3,     // mm - cradle wall thickness
  defaultDepth: 5,      // mm - how deep collar sits
  clearance: 0.5,       // mm - gap for easy fit
};

// ============================================
// STAND MOUNT TYPES
// ============================================

export type StandMountType = 'tripod' | 'ribbed_pedestal' | 'pendant' | 'wall_plate' | 'flat_back';

// Leg profile shape
export type LegProfile = 'round' | 'square' | 'angular';

// ============================================
// PARAMETRIC STAND PARAMS
// ============================================

export interface ParametricStandParams {
  enabled: boolean;
  mountType: StandMountType;
  
  // Socket cradle (where object's rim collar sits)
  socketSize: RimSize;        // Must match object's rimSize
  socketCradleDepth: number;  // How deep collar sits (3-8mm)
  
  // Dimensions
  height: number;             // Stand height in mm
  
  // Tripod-specific
  legCount: 3 | 4;
  legSpread: number;          // degrees (25-45° for tighter look)
  legProfile: LegProfile;
  legThickness: number;       // 3-8mm (thin for sleek look)
  legTaper: number;           // 0-0.8
  
  // Ribbed pedestal-specific
  pedestalDiameter: number;   // Auto-match or manual (50-150mm)
  ribCount: number;           // 12-32 ribs
  ribDepth: number;           // 1-5mm rib depth
  baseFlare: number;          // 0-1 flare at bottom
  
  // Pendant-specific
  cordLength: number;         // mm
  canopyDiameter: number;     // Ceiling canopy size
  
  // Wall mount-specific (wall_plate mode)
  plateWidth: number;         // Wall plate width
  plateHeight: number;        // Wall plate height
  armLength: number;          // Arm extending from wall
  armAngle: number;           // Angle of arm (0 = horizontal)
  
  // Hardware integration (for lamps)
  socketType: SocketType;
  showSocketHolder: boolean;
}

// Get socket holder dimensions based on socket type
export function getSocketHolderDims(socketType: SocketType) {
  const socket = socketDimensions[socketType];
  return {
    innerRadius: (socket.outerDiameter + 1) / 2,
    outerRadius: (socket.outerDiameter + 10) / 2,
    height: socket.height + 15,
    cordHoleRadius: 4,
    collarHeight: socket.collarHeight,
  };
}

// Default parametric stand params
export const defaultParametricStandParams: ParametricStandParams = {
  enabled: false,
  mountType: 'tripod',
  
  // Socket cradle
  socketSize: 80,
  socketCradleDepth: 5,
  
  // Dimensions
  height: 120,
  
  // Tripod (WOOJ-inspired thin legs)
  legCount: 3,
  legSpread: 30,
  legProfile: 'round',
  legThickness: 4,
  legTaper: 0.6,
  
  // Ribbed pedestal (Brut lamp inspired)
  pedestalDiameter: 80,
  ribCount: 20,
  ribDepth: 2,
  baseFlare: 0.15,
  
  // Pendant
  cordLength: 500,
  canopyDiameter: 80,
  
  // Wall mount
  plateWidth: 80,
  plateHeight: 80,
  armLength: 150,
  armAngle: 0,
  
  // Hardware
  socketType: 'E26',
  showSocketHolder: false,
};

// Re-export for convenience
export type { RimSize };
export { rimSizes };
