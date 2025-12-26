/**
 * Preset Adapter
 * 
 * Converts BASE_PRESETS from the clean type system to ParametricParams for UI integration.
 */

import { BASE_PRESETS, DEFAULT_TRIPOD_CONFIG, DEFAULT_WEIGHTED_DISC_CONFIG, DEFAULT_WALL_MOUNT_CONFIG } from './types';
import { ParametricParams, StandType, AttachmentType } from '@/types/parametric';

export type BasePresetKey = keyof typeof BASE_PRESETS;

export interface PresetInfo {
  key: BasePresetKey;
  name: string;
  description: string;
  icon: 'lamp-tripod' | 'lamp-disc' | 'led-puck' | 'wall-sconce';
  standType: StandType;
}

export const PRESET_INFO: PresetInfo[] = [
  {
    key: 'table-lamp-tripod',
    name: 'Table Lamp (Tripod)',
    description: 'Classic tripod stand with E26 socket',
    icon: 'lamp-tripod',
    standType: 'tripod',
  },
  {
    key: 'table-lamp-weighted',
    name: 'Table Lamp (Weighted)',
    description: 'Heavy disc base for stability',
    icon: 'lamp-disc',
    standType: 'weighted_disc',
  },
  {
    key: 'led-puck-lamp',
    name: 'LED Puck Lamp',
    description: 'Battery LED with short tripod',
    icon: 'led-puck',
    standType: 'tripod',
  },
  {
    key: 'wall-sconce',
    name: 'Wall Sconce',
    description: 'Wall-mounted with keyholes',
    icon: 'wall-sconce',
    standType: 'wall_mount',
  },
];

/**
 * Convert a clean StandType to the parametric StandType
 */
function convertStandType(type: string): StandType {
  switch (type) {
    case 'weighted-disc': return 'weighted_disc';
    case 'wall-mount': return 'wall_mount';
    case 'tripod': return 'tripod';
    default: return 'tripod';
  }
}

/**
 * Convert a clean ConnectorType to AttachmentType
 */
function convertConnectorType(type: string): AttachmentType {
  switch (type) {
    case 'integrated': return 'integrated';
    case 'press-fit': return 'press_fit';
    case 'screw-m3': return 'screw_m3';
    case 'screw-m4': return 'screw_m4';
    case 'bayonet': return 'bayonet';
    default: return 'integrated';
  }
}

/**
 * Apply a base preset to existing params, returning new params with base settings overwritten
 */
export function applyBasePreset(
  currentParams: ParametricParams,
  presetKey: BasePresetKey
): Partial<ParametricParams> {
  const preset = BASE_PRESETS[presetKey];
  
  // Map stand type
  const standType = convertStandType(preset.stand.type);
  
  // Get tripod config using type guard pattern
  const tripodConfig = 'tripod' in preset.stand && preset.stand.tripod 
    ? preset.stand.tripod 
    : DEFAULT_TRIPOD_CONFIG;
  
  // Get weighted disc config
  const weightedDiscConfig = 'weightedDisc' in preset.stand && preset.stand.weightedDisc
    ? preset.stand.weightedDisc
    : DEFAULT_WEIGHTED_DISC_CONFIG;
  
  // Get wall mount config
  const wallMountConfig = 'wallMount' in preset.stand && preset.stand.wallMount
    ? preset.stand.wallMount
    : DEFAULT_WALL_MOUNT_CONFIG;
  
  // Get socket properties safely
  const cordHoleDiameter = 'cordHoleDiameter' in preset.socket ? preset.socket.cordHoleDiameter : 8;
  const lipHeight = 'lipHeight' in preset.socket ? preset.socket.lipHeight : 0;
  const socketType = 'socketType' in preset.socket ? preset.socket.socketType : 'E26';
  
  const updates: Partial<ParametricParams> = {
    // Enable legs/stand
    addLegs: preset.enabled,
    standType,
    
    // Tripod settings
    legCount: tripodConfig.legCount,
    legHeight: tripodConfig.legHeight,
    legSpread: tripodConfig.legSpread,
    legThickness: tripodConfig.legThickness,
    legTaper: tripodConfig.legTaper,
    legInset: tripodConfig.legInset,
    
    // Stand base styling
    standBaseThickness: preset.stand.baseThickness,
    standBaseTaper: preset.stand.baseTaper,
    standBaseEdgeStyle: preset.stand.baseEdgeStyle,
    standBaseLip: preset.stand.baseLip,
    
    // Attachment/connector
    attachmentType: convertConnectorType(preset.connector.type),
    
    // Socket settings
    cordHoleEnabled: preset.socket.cordHoleEnabled ?? true,
    cordHoleDiameter: cordHoleDiameter,
    centeringLipEnabled: (lipHeight ?? 0) > 0,
    centeringLipHeight: lipHeight ?? 3,
    socketType: socketType ?? 'E26',
    
    // Wall mount specific
    wallMountStyle: standType === 'wall_mount' ? 'base' : currentParams.wallMountStyle,
    wallMountHoleCount: wallMountConfig.holeCount,
    wallMountHoleMargin: wallMountConfig.holeMargin,
    wallMountCordHoleEnabled: wallMountConfig.cordHoleEnabled,
  };
  
  return updates;
}

/**
 * Get full ParametricParams with preset applied
 */
export function getParamsWithPreset(
  currentParams: ParametricParams,
  presetKey: BasePresetKey
): ParametricParams {
  const updates = applyBasePreset(currentParams, presetKey);
  return { ...currentParams, ...updates };
}
