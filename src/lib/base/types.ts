/**
 * Simplified Base System Types
 * 
 * Keeping only what works: tripod legs and wall mount.
 */

// ============ STAND TYPES ============

export type StandType = 'tripod' | 'wall-mount';

export interface TripodConfig {
  legCount: 3 | 4;
  legHeight: number;            // mm
  legSpread: number;            // degrees (15-45)
  legThickness: number;         // mm (3-10)
  legTaper: number;             // 0-1
  legInset: number;             // 0-1 how far from edge
}

export interface WallMountConfig {
  style: 'back-cut' | 'base-plate';
  cutOffset: number;            // mm from center
  holeCount: 2 | 3 | 4;
  holeMargin: number;           // 0-1 distance from edge
  cordHoleEnabled: boolean;
}

export interface StandConfig {
  type: StandType;
  tripod?: TripodConfig;
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

export const DEFAULT_WALL_MOUNT_CONFIG: WallMountConfig = {
  style: 'back-cut',
  cutOffset: 0,
  holeCount: 2,
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
