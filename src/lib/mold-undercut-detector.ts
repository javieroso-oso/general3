import { ParametricParams, ObjectType } from '@/types/parametric';
import { getBodyRadius } from '@/lib/body-profile-generator';

export interface UndercutAnalysis {
  hasUndercuts: boolean;
  severity: number;             // 0-100% severity score
  problemZones: UndercutZone[];
  recommendations: string[];
}

export interface UndercutZone {
  heightStart: number;          // mm
  heightEnd: number;            // mm
  angle: number;                // degrees - worst undercut angle
  description: string;
}

const SCALE = 0.01;

/**
 * Analyze body profile for undercuts relative to split plane
 * Undercuts occur when the body curves inward (creating areas that would lock in the mold)
 */
export function analyzeUndercuts(
  params: ParametricParams,
  objectType: ObjectType
): UndercutAnalysis {
  const samples = 64;
  const angleSamples = 48;
  const height = params.height;
  const splitRotation = params.moldSplitAngle * Math.PI / 180;
  
  const problemZones: UndercutZone[] = [];
  let worstUndercut = 0;
  let currentZone: { start: number; end: number; worstAngle: number } | null = null;
  
  // Check profile from bottom to top for undercuts
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const prevT = (i - 1) / samples;
    const y = t * height;
    const prevY = prevT * height;
    
    // Sample around the perimeter at half-circle arcs (each mold half)
    let hasUndercutAtThisHeight = false;
    let maxUndercutAngleAtHeight = 0;
    
    for (let j = 0; j < angleSamples; j++) {
      const u = j / angleSamples;
      // Check first half (Half A)
      const theta = u * Math.PI + splitRotation;
      
      // Get radius at current and previous height
      const currentRadius = getBodyRadius(params, t, theta, {
        scale: SCALE,
        objectType,
        includeTwist: true
      }) / SCALE;
      
      const prevRadius = getBodyRadius(params, prevT, theta, {
        scale: SCALE,
        objectType,
        includeTwist: true
      }) / SCALE;
      
      // Calculate the angle of the wall relative to vertical (draft direction)
      const deltaY = y - prevY;
      const deltaR = currentRadius - prevRadius;
      
      // Positive deltaR (expanding outward going up) is fine
      // Negative deltaR (shrinking going up) creates undercuts
      if (deltaR < 0) {
        // Calculate undercut angle (how much it hooks inward)
        const undercutAngle = Math.atan2(-deltaR, deltaY) * (180 / Math.PI);
        
        // Subtract draft angle - if within draft, it's okay
        const effectiveUndercut = undercutAngle - params.moldDraftAngle;
        
        if (effectiveUndercut > 0) {
          hasUndercutAtThisHeight = true;
          maxUndercutAngleAtHeight = Math.max(maxUndercutAngleAtHeight, effectiveUndercut);
          worstUndercut = Math.max(worstUndercut, effectiveUndercut);
        }
      }
    }
    
    // Track continuous zones
    if (hasUndercutAtThisHeight) {
      if (currentZone) {
        currentZone.end = y;
        currentZone.worstAngle = Math.max(currentZone.worstAngle, maxUndercutAngleAtHeight);
      } else {
        currentZone = { start: prevY, end: y, worstAngle: maxUndercutAngleAtHeight };
      }
    } else if (currentZone) {
      // End current zone
      problemZones.push({
        heightStart: currentZone.start,
        heightEnd: currentZone.end,
        angle: currentZone.worstAngle,
        description: getZoneDescription(currentZone.start, currentZone.end, height)
      });
      currentZone = null;
    }
  }
  
  // Close any remaining zone
  if (currentZone) {
    problemZones.push({
      heightStart: currentZone.start,
      heightEnd: currentZone.end,
      angle: currentZone.worstAngle,
      description: getZoneDescription(currentZone.start, currentZone.end, height)
    });
  }
  
  // Calculate severity (0-100)
  // Based on worst undercut angle and total affected height
  const affectedHeight = problemZones.reduce((sum, zone) => sum + (zone.heightEnd - zone.heightStart), 0);
  const heightRatio = affectedHeight / height;
  const angleRatio = Math.min(worstUndercut / 45, 1); // Cap at 45 degrees
  const severity = Math.round((heightRatio * 0.4 + angleRatio * 0.6) * 100);
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (problemZones.length > 0) {
    if (worstUndercut > 15) {
      recommendations.push('Consider using a multi-part mold (3+ pieces) for this design');
    }
    if (params.moldDraftAngle < 3) {
      recommendations.push(`Increase draft angle from ${params.moldDraftAngle}° to at least 3°`);
    }
    if (problemZones.some(z => z.description.includes('top'))) {
      recommendations.push('Reduce lip flare or topRadius to eliminate top undercuts');
    }
    if (problemZones.some(z => z.description.includes('middle'))) {
      recommendations.push('Reduce bulge amount or adjust bulge position');
    }
    if (params.moldSplitAngle === 0) {
      recommendations.push('Try rotating the split plane (0-180°) to find a better orientation');
    }
  }
  
  return {
    hasUndercuts: problemZones.length > 0,
    severity,
    problemZones,
    recommendations
  };
}

function getZoneDescription(start: number, end: number, totalHeight: number): string {
  const midpoint = (start + end) / 2;
  const ratio = midpoint / totalHeight;
  
  if (ratio < 0.25) return 'Near base';
  if (ratio < 0.5) return 'Lower middle';
  if (ratio < 0.75) return 'Upper middle';
  return 'Near top';
}

/**
 * Calculate estimated mold volume and material requirements
 */
export function calculateMoldMaterialEstimate(
  params: ParametricParams,
  _objectType: ObjectType
): {
  volumeCm3: number;
  plasterKg: number;
  siliconeKg: number;
  totalMoldHeight: number;
  totalMoldWidth: number;
} {
  const height = params.height;
  const maxRadius = Math.max(params.baseRadius, params.topRadius) * (1 + params.bulgeAmount);
  const wallThickness = params.moldWallThickness;
  const baseThickness = params.moldBaseThickness;
  
  // Calculate outer mold dimensions
  const outerRadius = maxRadius + wallThickness;
  const totalHeight = height + baseThickness;
  const spareHeight = params.moldSpareEnabled ? params.moldSpareHeight : 0;
  
  // Approximate mold volume as outer cylinder minus inner cavity
  // Outer volume
  const outerVolume = Math.PI * outerRadius * outerRadius * (totalHeight + spareHeight);
  
  // Inner cavity volume (approximate as average of top and bottom area)
  const avgBodyRadius = (params.baseRadius + params.topRadius) / 2;
  const innerVolume = Math.PI * avgBodyRadius * avgBodyRadius * height;
  
  // Mold volume = outer - inner (approximate)
  const moldVolumeMm3 = outerVolume - innerVolume;
  const volumeCm3 = moldVolumeMm3 / 1000; // Convert mm³ to cm³
  
  // Material estimates
  // Plaster density: ~1.6 g/cm³ (pottery plaster)
  // Silicone density: ~1.1 g/cm³
  const plasterKg = (volumeCm3 * 1.6) / 1000;
  const siliconeKg = (volumeCm3 * 1.1) / 1000;
  
  return {
    volumeCm3: Math.round(volumeCm3),
    plasterKg: Math.round(plasterKg * 100) / 100,
    siliconeKg: Math.round(siliconeKg * 100) / 100,
    totalMoldHeight: Math.round(totalHeight + spareHeight),
    totalMoldWidth: Math.round(outerRadius * 2)
  };
}
