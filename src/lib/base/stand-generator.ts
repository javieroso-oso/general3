/**
 * Stand Generator
 * 
 * Generates the structural support for lamps:
 * - Tripod legs extending from a base disc
 * - Wall mount configurations (modifies body, no separate stand)
 */

import * as THREE from 'three';
import { 
  StandConfig, 
  TripodConfig, 
  DEFAULT_TRIPOD_CONFIG 
} from './types';

/**
 * Generate stand geometry
 * 
 * @param config Stand configuration
 * @param baseRadius The radius to fit the stand to (body bottom radius)
 * @returns Stand geometry
 */
export function generateStand(
  config: StandConfig,
  baseRadius: number,
  bodyBottomRadius?: number
): THREE.BufferGeometry | null {
  switch (config.type) {
    case 'tripod':
      return generateTripodStand(config, baseRadius, bodyBottomRadius);
    case 'wall-mount':
      return null; // Wall mount modifies body, doesn't add stand
    default:
      return null;
  }
}

/**
 * Generate tripod legs with base disc and flush attachment ring
 */
function generateTripodStand(
  config: StandConfig,
  baseRadius: number,
  bodyBottomRadius?: number
): THREE.BufferGeometry {
  const tripod = config.tripod || DEFAULT_TRIPOD_CONFIG;
  const geometries: THREE.BufferGeometry[] = [];
  
  // 1. Create base disc
  const discGeometry = createBaseDisc(
    baseRadius,
    config.baseThickness,
    config.baseTaper,
    config.baseEdgeStyle,
    config.baseLip
  );
  geometries.push(discGeometry);
  
  // 2. Create legs with flush attachment to disc
  const legGeometries = createTripodLegs(
    baseRadius,
    tripod,
    config.baseThickness
  );
  geometries.push(...legGeometries);
  
  return mergeGeometries(geometries);
}

/**
 * Create base disc with optional styling
 */
function createBaseDisc(
  radius: number,
  thickness: number,
  taper: number,
  edgeStyle: 'flat' | 'rounded' | 'chamfer',
  lip: number
): THREE.BufferGeometry {
  const segments = 64;
  const bottomRadius = radius * (1 - taper);
  
  // Simple disc with taper
  const shape = new THREE.Shape();
  shape.moveTo(0, -thickness);
  shape.lineTo(bottomRadius, -thickness);
  
  if (edgeStyle === 'chamfer') {
    const chamfer = Math.min(2, thickness * 0.3);
    shape.lineTo(radius - chamfer, -thickness);
    shape.lineTo(radius, -thickness + chamfer);
  } else if (edgeStyle === 'rounded') {
    const roundRadius = Math.min(2, thickness * 0.3);
    shape.lineTo(radius - roundRadius, -thickness);
    shape.quadraticCurveTo(radius, -thickness, radius, -thickness + roundRadius);
  } else {
    shape.lineTo(radius, -thickness);
  }
  
  shape.lineTo(radius, 0);
  
  // Add lip if specified
  if (lip > 0) {
    // Lip thickness scales with height (min 1.5mm, or 40% of lip height)
    const lipThickness = Math.max(1.5, lip * 0.4);
    shape.lineTo(radius, lip);
    shape.lineTo(radius - lipThickness, lip);
    shape.lineTo(radius - lipThickness, 0);
  }
  
  shape.lineTo(0, 0);
  shape.closePath();
  
  const geo = new THREE.LatheGeometry(
    shape.getPoints(32).map(p => new THREE.Vector2(p.x, p.y)),
    segments
  );
  
  return geo;
}

/**
 * Create tripod legs
 */
function createTripodLegs(
  baseRadius: number,
  config: TripodConfig,
  baseThickness: number
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const { legCount, legHeight, legSpread, legThickness, legTaper, legInset } = config;
  
  const attachRadius = baseRadius * (1 - legInset);
  const spreadRad = (legSpread * Math.PI) / 180;
  
  for (let i = 0; i < legCount; i++) {
    const angle = (i / legCount) * Math.PI * 2;
    
    // Calculate leg path
    const startX = Math.cos(angle) * attachRadius;
    const startZ = Math.sin(angle) * attachRadius;
    const startY = -baseThickness;
    
    // End point - angled outward
    const horizontalDist = Math.sin(spreadRad) * legHeight;
    const verticalDist = Math.cos(spreadRad) * legHeight;
    const endX = startX + Math.cos(angle) * horizontalDist;
    const endZ = startZ + Math.sin(angle) * horizontalDist;
    const endY = startY - verticalDist;
    
    // Create tapered cylinder for leg
    const topThickness = legThickness;
    const bottomThickness = legThickness * (1 - legTaper);
    
    const legGeo = new THREE.CylinderGeometry(
      bottomThickness / 2,
      topThickness / 2,
      legHeight,
      16
    );
    
    // Position and rotate leg
    const legLength = legHeight;
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const midZ = (startZ + endZ) / 2;
    
    legGeo.translate(0, 0, 0);
    legGeo.rotateZ(Math.PI / 2 - spreadRad);
    legGeo.rotateY(-angle);
    legGeo.translate(midX, midY, midZ);
    
    geometries.push(legGeo);
  }
  
  return geometries;
}

/**
 * Merge multiple geometries into one
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }
  if (geometries.length === 1) {
    return geometries[0];
  }
  
  let totalPositions = 0;
  let totalIndices = 0;
  
  for (const geo of geometries) {
    totalPositions += geo.getAttribute('position').count * 3;
    if (geo.index) {
      totalIndices += geo.index.count;
    }
  }
  
  const positions = new Float32Array(totalPositions);
  const indices: number[] = [];
  let posOffset = 0;
  let vertexOffset = 0;
  
  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    const posArray = pos.array as Float32Array;
    positions.set(posArray, posOffset);
    
    if (geo.index) {
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i++) {
        indices.push(idx[i] + vertexOffset);
      }
    }
    
    posOffset += posArray.length;
    vertexOffset += pos.count;
  }
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (indices.length > 0) {
    merged.setIndex(indices);
  }
  merged.computeVertexNormals();
  
  return merged;
}

/**
 * Calculate stand footprint radius
 */
export function getStandFootprint(
  config: StandConfig,
  baseRadius: number
): number {
  if (config.type === 'tripod' && config.tripod) {
    const tripod = config.tripod;
    const attachRadius = baseRadius * (1 - tripod.legInset);
    const spreadRad = (tripod.legSpread * Math.PI) / 180;
    const legHeight = tripod.legHeight;
    const horizontalDist = Math.sin(spreadRad) * legHeight;
    return attachRadius + horizontalDist;
  }
  return baseRadius;
}
