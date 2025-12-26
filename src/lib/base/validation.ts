/**
 * Base Configuration Validation
 * 
 * Validates that base configurations are physically sensible BEFORE generating geometry.
 * This prevents messy, bulky, or non-functional designs.
 */

import { 
  SocketMountConfig, 
  StandConfig, 
  ConnectorConfig,
  SOCKET_THREAD_DIAMETERS,
  BulbSocketType 
} from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fitAnalysis: {
    bodyBottomRadius: number;
    socketMountRadius: number;
    connectorClearance: number;
    standFootprint: number;
    stabilityRatio: number;       // footprint / height ratio (>0.3 is stable)
  };
}

/**
 * Validate base configuration before generating geometry
 */
export function validateBaseConfig(
  bodyBottomRadius: number,       // mm - radius at bottom of body
  bodyHeight: number,             // mm - total body height
  socketConfig: SocketMountConfig,
  standConfig: StandConfig,
  connectorConfig: ConnectorConfig
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Calculate socket mount radius
  let socketMountRadius = 0;
  if (socketConfig.type === 'press-fit-ring') {
    const socketType = socketConfig.socketType || 'E26';
    const threadDiameter = SOCKET_THREAD_DIAMETERS[socketType];
    const clearance = socketConfig.clearance || 0.5;
    const lipWall = 2; // mm lip wall thickness
    socketMountRadius = (threadDiameter / 2) + clearance + lipWall;
  } else if (socketConfig.type === 'led-puck') {
    socketMountRadius = (socketConfig.puckDiameter || 50) / 2 + 2;
  }
  
  // 1. Check socket mount fits inside body
  const minBodyRadius = socketMountRadius + 3; // 3mm minimum wall around socket
  if (bodyBottomRadius < minBodyRadius) {
    errors.push(
      `Body too narrow for socket (need ${minBodyRadius.toFixed(0)}mm radius, have ${bodyBottomRadius.toFixed(0)}mm)`
    );
  }
  
  // 2. Check connector dimensions
  const connectorClearance = bodyBottomRadius - socketMountRadius;
  if (connectorConfig.type !== 'integrated' && connectorClearance < 5) {
    warnings.push(
      `Limited space for connector interface (${connectorClearance.toFixed(1)}mm available)`
    );
  }
  
  // 3. Calculate stand footprint and stability
  let standFootprint = 0;
  
  if (standConfig.type === 'tripod' && standConfig.tripod) {
    const { legHeight, legSpread, legInset } = standConfig.tripod;
    const spreadRad = (legSpread * Math.PI) / 180;
    const attachRadius = bodyBottomRadius * (1 - legInset * 0.7);
    const horizontalDist = Math.sin(spreadRad) * legHeight;
    standFootprint = attachRadius + horizontalDist;
  } else if (standConfig.type === 'weighted-disc' && standConfig.weightedDisc) {
    standFootprint = standConfig.weightedDisc.discDiameter / 2;
  } else if (standConfig.type === 'wall-mount') {
    standFootprint = bodyBottomRadius; // Wall mounts don't need footprint
  }
  
  // 4. Check stability ratio (footprint vs height)
  const totalHeight = bodyHeight + (standConfig.tripod?.legHeight || 0);
  const stabilityRatio = standFootprint / totalHeight;
  
  if (standConfig.type !== 'wall-mount') {
    if (stabilityRatio < 0.2) {
      errors.push(
        `Unstable design: footprint too small for height (ratio: ${stabilityRatio.toFixed(2)}, need >0.2)`
      );
    } else if (stabilityRatio < 0.3) {
      warnings.push(
        `Marginally stable: consider increasing leg spread or using weighted base`
      );
    }
  }
  
  // 5. Check weighted disc cavity
  if (standConfig.type === 'weighted-disc' && standConfig.weightedDisc) {
    const { discDiameter, weightCavityDiameter, discThickness, weightCavityDepth } = standConfig.weightedDisc;
    
    if (weightCavityDiameter >= discDiameter - 10) {
      errors.push(
        `Weight cavity too large (${weightCavityDiameter}mm in ${discDiameter}mm disc)`
      );
    }
    
    if (weightCavityDepth >= discThickness - 2) {
      warnings.push(
        `Weight cavity leaves thin bottom (${discThickness - weightCavityDepth}mm)`
      );
    }
  }
  
  // 6. Check cord hole doesn't interfere with socket
  if (socketConfig.cordHoleEnabled) {
    const cordRadius = (socketConfig.cordHoleDiameter || 8) / 2;
    if (socketConfig.type === 'press-fit-ring') {
      const socketType = socketConfig.socketType || 'E26';
      const lipInnerRadius = SOCKET_THREAD_DIAMETERS[socketType] / 2 + 0.5;
      if (cordRadius > lipInnerRadius - 3) {
        warnings.push(
          `Cord hole large relative to socket opening`
        );
      }
    }
  }
  
  // 7. Check leg thickness for printability
  if (standConfig.type === 'tripod' && standConfig.tripod) {
    if (standConfig.tripod.legThickness < 4) {
      warnings.push(
        `Thin legs (${standConfig.tripod.legThickness}mm) may be fragile`
      );
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fitAnalysis: {
      bodyBottomRadius,
      socketMountRadius,
      connectorClearance,
      standFootprint,
      stabilityRatio,
    },
  };
}

/**
 * Get minimum body radius for a given socket configuration
 */
export function getMinimumBodyRadius(socketConfig: SocketMountConfig): number {
  if (socketConfig.type === 'press-fit-ring') {
    const socketType = socketConfig.socketType || 'E26';
    const threadDiameter = SOCKET_THREAD_DIAMETERS[socketType];
    const clearance = socketConfig.clearance || 0.5;
    const lipWall = 2;
    const bodyWall = 3; // minimum wall around socket
    return (threadDiameter / 2) + clearance + lipWall + bodyWall;
  } else if (socketConfig.type === 'led-puck') {
    return (socketConfig.puckDiameter || 50) / 2 + 5;
  }
  return 15; // Default minimum
}

/**
 * Calculate recommended leg height for stability
 */
export function getRecommendedLegHeight(
  bodyHeight: number,
  bodyRadius: number,
  targetStabilityRatio: number = 0.35
): number {
  // For a tripod with 25° spread, calculate leg height needed
  const spreadRad = (25 * Math.PI) / 180;
  
  // stabilityRatio = (attachRadius + horizontalDist) / totalHeight
  // horizontalDist = sin(spread) * legHeight
  // totalHeight = bodyHeight + cos(spread) * legHeight
  
  // Simplified: aim for footprint = targetStabilityRatio * totalHeight
  // footprint ≈ bodyRadius + sin(spread) * legHeight
  // totalHeight ≈ bodyHeight + legHeight
  
  // bodyRadius + sin(spread) * legHeight = targetStabilityRatio * (bodyHeight + legHeight)
  // bodyRadius + 0.42 * legHeight = 0.35 * bodyHeight + 0.35 * legHeight
  // bodyRadius - 0.35 * bodyHeight = 0.35 * legHeight - 0.42 * legHeight
  // bodyRadius - 0.35 * bodyHeight = -0.07 * legHeight
  // legHeight = (0.35 * bodyHeight - bodyRadius) / 0.07
  
  const sinSpread = Math.sin(spreadRad);
  const legHeight = (targetStabilityRatio * bodyHeight - bodyRadius) / (sinSpread - targetStabilityRatio);
  
  return Math.max(30, Math.min(200, legHeight)); // Clamp to reasonable range
}
