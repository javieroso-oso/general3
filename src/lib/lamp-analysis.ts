import { PrintSettings } from '@/types/parametric';
import {
  LampParams,
  LampHardware,
  LampSafetyAnalysis,
  socketDimensions,
  bulbDimensions,
  materialHeatLimits,
} from '@/types/lamp';

export function analyzeLampSafety(
  params: LampParams,
  hardware: LampHardware,
  printSettings: PrintSettings
): LampSafetyAnalysis {
  const socket = socketDimensions[hardware.socketType];
  const bulb = bulbDimensions[hardware.bulbShape];
  const materialLimits = materialHeatLimits[printSettings.material];
  
  const recommendations: string[] = [];
  const materialWarnings: string[] = [];
  
  // Calculate bulb position (socket mounting + socket height + bulb extends down)
  const bulbCenterHeight = params.socketMountingHeight - socket.height - bulb.height / 2;
  
  // Calculate shade radius at bulb center height
  const heightRatio = bulbCenterHeight / params.height;
  const shadeRadiusAtBulb = params.baseRadius + (params.topRadius - params.baseRadius) * heightRatio;
  
  // Distance from bulb to shade wall
  const bulbToShadeDistance = shadeRadiusAtBulb - bulb.diameter / 2 - params.wallThickness;
  
  // Heat zone analysis
  const heatZoneReached = bulbToShadeDistance < bulb.heatZoneRadius;
  
  // Determine heat clearance status
  let heatClearance: 'safe' | 'warning' | 'danger' = 'safe';
  if (bulbToShadeDistance < 10) {
    heatClearance = 'danger';
  } else if (bulbToShadeDistance < 25 || heatZoneReached) {
    heatClearance = 'warning';
  }
  
  // Calculate max safe wattage based on material and clearance
  let maxSafeWattage = materialLimits.maxWattage;
  
  if (heatClearance === 'danger') {
    maxSafeWattage = Math.min(5, maxSafeWattage);
  } else if (heatClearance === 'warning') {
    maxSafeWattage = Math.min(maxSafeWattage * 0.6, 15);
  }
  
  // Ventilation bonus
  if (params.ventilationSlots && params.ventSlotCount >= 4) {
    maxSafeWattage = Math.min(maxSafeWattage * 1.3, materialLimits.maxWattage * 1.5);
  }
  
  // Recommended wattage (conservative)
  const recommendedWattage = Math.floor(maxSafeWattage * 0.7);
  
  // Check if current wattage exceeds safe limits
  const wattageExceeded = hardware.bulbWattage > maxSafeWattage;
  
  // Ventilation adequacy
  const ventilationAdequate = 
    params.ventilationSlots && params.ventSlotCount >= 4 && params.ventSlotHeight >= 15 ||
    hardware.bulbWattage <= 10 ||
    hardware.bulbShape === 'Tube'; // LED tubes run cooler
  
  // Material-specific warnings
  if (printSettings.material === 'PLA') {
    if (hardware.bulbWattage > 10) {
      materialWarnings.push('PLA softens at 50°C - use LED bulbs only');
    }
    if (!params.ventilationSlots && hardware.bulbWattage > 5) {
      materialWarnings.push('Add ventilation slots for PLA at any wattage above 5W');
    }
  }
  
  if (printSettings.material === 'PETG' && hardware.bulbWattage > 20) {
    materialWarnings.push('PETG can handle moderate heat but ventilation is recommended');
  }
  
  if (heatClearance === 'danger') {
    materialWarnings.push('Bulb too close to shade - high risk of deformation or fire');
  }
  
  // Recommendations
  if (wattageExceeded) {
    recommendations.push(`Reduce bulb wattage to ${recommendedWattage}W or less`);
  }
  
  if (heatClearance !== 'safe' && !params.ventilationSlots) {
    recommendations.push('Add ventilation slots near the top of the shade');
  }
  
  if (bulbToShadeDistance < 20) {
    recommendations.push('Increase shade diameter or use a smaller bulb');
  }
  
  if (printSettings.material === 'PLA' && hardware.bulbWattage > 5) {
    recommendations.push('Consider using PETG or ABS for better heat resistance');
  }
  
  if (hardware.lampStyle === 'table' && params.baseThickness < 2) {
    recommendations.push('Add base thickness for table lamp stability');
  }
  
  if (hardware.cordExit === 'internal_channel' && params.wallThickness < 4) {
    recommendations.push('Wall thickness should be at least 4mm for internal cord channel');
  }
  
  // Socket hole validation
  const socketFits = params.socketHoleDiameter >= socket.outerDiameter;
  if (!socketFits) {
    recommendations.push(`Increase socket hole to at least ${socket.outerDiameter}mm for ${hardware.socketType} socket`);
  }
  
  const isValid = 
    heatClearance !== 'danger' && 
    !wattageExceeded && 
    socketFits && 
    materialWarnings.length < 2;
  
  return {
    isValid,
    heatClearance,
    bulbToShadeDistance,
    maxSafeWattage: Math.round(maxSafeWattage),
    recommendedWattage,
    ventilationAdequate,
    materialWarnings,
    recommendations,
  };
}

// Calculate proper socket hole diameter based on socket type
export function getRecommendedSocketHole(socketType: LampHardware['socketType']): number {
  const socket = socketDimensions[socketType];
  return socket.outerDiameter + 2; // 2mm clearance
}

// Get bulb clearance requirement
export function getBulbClearanceRequirement(bulbShape: LampHardware['bulbShape'], wattage: number): number {
  const bulb = bulbDimensions[bulbShape];
  // Higher wattage = more clearance needed
  const wattageMultiplier = Math.max(1, wattage / 10);
  return bulb.heatZoneRadius * wattageMultiplier * 0.5;
}
