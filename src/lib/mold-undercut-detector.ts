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

export interface PartingLineResult {
  splitAngles: number[];        // Optimal split angles in radians
  partCount: number;            // Recommended part count
  confidence: number;           // 0-1 confidence in the splits
  undercuts: UndercutAnalysis;  // Undercut analysis at these splits
}

export interface RadiusMaxima {
  angle: number;                // Angle in radians where maximum occurs
  radius: number;               // The radius value at this angle
  height: number;               // Height (0-1) where this was measured
}

const SCALE = 0.01;

/**
 * Find local radius maxima at a specific height
 * These are natural parting line candidates (widest points)
 */
export function findRadiusMaximaAtHeight(
  params: ParametricParams,
  _objectType?: string,
  heightT: number = 0.5,
  angleSamples: number = 72
): RadiusMaxima[] {
  const maxima: RadiusMaxima[] = [];
  const radii: number[] = [];
  const angles: number[] = [];
  
  // Sample radius at all angles
  for (let i = 0; i < angleSamples; i++) {
    const theta = (i / angleSamples) * Math.PI * 2;
    angles.push(theta);
    
    const radius = getBodyRadius(params, heightT, theta, {
      scale: SCALE,
      objectType: 'vase',
      includeTwist: true
    }) / SCALE; // Convert back to mm for comparison
    
    radii.push(radius);
  }
  
  // Find local maxima (peaks)
  for (let i = 0; i < angleSamples; i++) {
    const prev = (i - 1 + angleSamples) % angleSamples;
    const next = (i + 1) % angleSamples;
    
    // Check if this point is greater than its neighbors (local maximum)
    if (radii[i] > radii[prev] && radii[i] > radii[next]) {
      // Check it's a significant peak (at least 0.5mm above neighbors)
      const neighborAvg = (radii[prev] + radii[next]) / 2;
      if (radii[i] - neighborAvg > 0.3) {
        maxima.push({
          angle: angles[i],
          radius: radii[i],
          height: heightT
        });
      }
    }
  }
  
  return maxima;
}

/**
 * Find global parting lines by analyzing radius maxima across all heights
 * Clusters consistent "ridges" where the body protrudes outward
 */
export function findGlobalPartingLines(
  params: ParametricParams,
  _objectType?: string,
  heightSamples: number = 16
): { angles: number[]; strength: number[] } {
  const allMaxima: RadiusMaxima[] = [];
  
  // Sample at multiple heights (skip very bottom and top which can be irregular)
  for (let i = 1; i < heightSamples - 1; i++) {
    const t = i / heightSamples;
    const maxima = findRadiusMaximaAtHeight(params, undefined, t);
    allMaxima.push(...maxima);
  }
  
  // If no clear maxima found, return empty (will fall back to equal division)
  if (allMaxima.length === 0) {
    return { angles: [], strength: [] };
  }
  
  // Cluster maxima by angle (within 15° tolerance)
  const clusterTolerance = (15 / 180) * Math.PI;
  const clusters: { centerAngle: number; count: number; totalRadius: number }[] = [];
  
  for (const max of allMaxima) {
    // Find closest existing cluster
    let closestCluster = -1;
    let closestDistance = Infinity;
    
    for (let c = 0; c < clusters.length; c++) {
      let angleDiff = Math.abs(max.angle - clusters[c].centerAngle);
      // Handle wraparound
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
      
      if (angleDiff < closestDistance) {
        closestDistance = angleDiff;
        closestCluster = c;
      }
    }
    
    if (closestCluster >= 0 && closestDistance < clusterTolerance) {
      // Add to existing cluster (weighted average for center)
      const cluster = clusters[closestCluster];
      const newCount = cluster.count + 1;
      cluster.centerAngle = (cluster.centerAngle * cluster.count + max.angle) / newCount;
      cluster.count = newCount;
      cluster.totalRadius += max.radius;
    } else {
      // Create new cluster
      clusters.push({
        centerAngle: max.angle,
        count: 1,
        totalRadius: max.radius
      });
    }
  }
  
  // Sort clusters by strength (count × average radius)
  clusters.sort((a, b) => {
    const strengthA = a.count * (a.totalRadius / a.count);
    const strengthB = b.count * (b.totalRadius / b.count);
    return strengthB - strengthA;
  });
  
  // Normalize angles to [0, 2π] and return
  const angles = clusters.map(c => {
    let angle = c.centerAngle;
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
  });
  
  // Calculate relative strength (0-1)
  const maxStrength = clusters.length > 0 
    ? clusters[0].count * (clusters[0].totalRadius / clusters[0].count) 
    : 1;
  const strength = clusters.map(c => 
    (c.count * (c.totalRadius / c.count)) / maxStrength
  );
  
  return { angles, strength };
}

/**
 * Calculate optimal split positions based on geometry analysis
 * Places splits at natural parting lines (radius maxima) to minimize undercuts
 */
export function calculateOptimalSplits(
  params: ParametricParams,
  _objectType?: string,
  requestedPartCount?: number
): PartingLineResult {
  const { angles: partingAngles, strength } = findGlobalPartingLines(params);
  
  // If no clear geometry features, return equal division
  if (partingAngles.length < 2 || strength[0] < 0.3) {
    const partCount = requestedPartCount || 2;
    const equalSplits: number[] = [];
    for (let i = 0; i < partCount; i++) {
      equalSplits.push((i / partCount) * Math.PI * 2);
    }
    
    return {
      splitAngles: equalSplits,
      partCount,
      confidence: 0, // Low confidence - using fallback
      undercuts: analyzeUndercuts(params)
    };
  }
  
  // Determine optimal part count based on geometry
  let optimalPartCount = requestedPartCount || 2;
  
  // If user hasn't specified, recommend based on geometry
  if (!requestedPartCount) {
    // Use number of strong parting lines as guide
    const strongAngles = partingAngles.filter((_, i) => strength[i] > 0.5);
    if (strongAngles.length >= 4) {
      optimalPartCount = 4;
    } else if (strongAngles.length >= 3) {
      optimalPartCount = 3;
    } else {
      optimalPartCount = 2;
    }
  }
  
  // Select best N angles that are well-distributed
  const selectedAngles = selectDistributedAngles(partingAngles, strength, optimalPartCount);
  
  // Sort by angle
  selectedAngles.sort((a, b) => a - b);
  
  // Calculate confidence based on how well-distributed the splits are
  const angleSpans = [];
  for (let i = 0; i < selectedAngles.length; i++) {
    const next = (i + 1) % selectedAngles.length;
    let span = selectedAngles[next] - selectedAngles[i];
    if (span <= 0) span += Math.PI * 2;
    angleSpans.push(span);
  }
  
  const idealSpan = (Math.PI * 2) / optimalPartCount;
  const spanVariance = angleSpans.reduce((sum, span) => 
    sum + Math.pow(span - idealSpan, 2), 0
  ) / angleSpans.length;
  
  const confidence = Math.max(0, 1 - spanVariance / (idealSpan * idealSpan));
  
  return {
    splitAngles: selectedAngles,
    partCount: optimalPartCount,
    confidence,
    undercuts: analyzeUndercuts(params)
  };
}

/**
 * Select N angles from candidates that are well-distributed
 */
function selectDistributedAngles(
  candidates: number[],
  strength: number[],
  count: number
): number[] {
  if (candidates.length <= count) {
    // Not enough candidates - fill with equally-spaced angles
    const result = [...candidates];
    const existing = new Set(candidates.map(a => Math.round(a * 100)));
    
    for (let i = 0; result.length < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const rounded = Math.round(angle * 100);
      if (!existing.has(rounded)) {
        result.push(angle);
        existing.add(rounded);
      }
    }
    
    return result.slice(0, count);
  }
  
  // Greedy selection: start with strongest, then add farthest from existing
  const selected: number[] = [candidates[0]]; // Strongest first
  
  while (selected.length < count) {
    let bestCandidate = -1;
    let bestMinDistance = -1;
    
    for (let i = 0; i < candidates.length; i++) {
      // Skip if already selected (approximately)
      const alreadySelected = selected.some(s => {
        let diff = Math.abs(s - candidates[i]);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff < 0.1; // ~6 degrees tolerance
      });
      
      if (alreadySelected) continue;
      
      // Find minimum distance to any selected angle
      let minDist = Infinity;
      for (const s of selected) {
        let diff = Math.abs(s - candidates[i]);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        minDist = Math.min(minDist, diff);
      }
      
      // Weight by strength
      const weightedDist = minDist * (0.5 + 0.5 * strength[i]);
      
      if (weightedDist > bestMinDistance) {
        bestMinDistance = weightedDist;
        bestCandidate = i;
      }
    }
    
    if (bestCandidate >= 0) {
      selected.push(candidates[bestCandidate]);
    } else {
      // No good candidate found - add equally-spaced
      const angle = (selected.length / count) * Math.PI * 2;
      selected.push(angle);
    }
  }
  
  return selected;
}

/**
 * Analyze body profile for undercuts relative to split plane
 * Undercuts occur when the body curves inward (creating areas that would lock in the mold)
 */
export function analyzeUndercuts(
  params: ParametricParams,
  _objectType?: string
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
        objectType: 'vase',
        includeTwist: true
      }) / SCALE;
      
      const prevRadius = getBodyRadius(params, prevT, theta, {
        scale: SCALE,
        objectType: 'vase',
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
