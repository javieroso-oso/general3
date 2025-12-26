/**
 * Stand Generator
 * 
 * Generates the structural support for lamps:
 * - Tripod legs extending from a base disc
 * - Weighted disc base with optional weight cavity and rubber feet
 * - Wall mount configurations
 */

import * as THREE from 'three';
import { 
  StandConfig, 
  TripodConfig, 
  WeightedDiscConfig,
  WallMountConfig,
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
  baseRadius: number
): THREE.BufferGeometry | null {
  switch (config.type) {
    case 'tripod':
      return generateTripodStand(config, baseRadius);
    case 'weighted-disc':
      return generateWeightedDisc(config, baseRadius);
    case 'wall-mount':
      return null; // Wall mount modifies body, doesn't add stand
    default:
      return null;
  }
}

/**
 * Generate tripod legs with base disc
 */
function generateTripodStand(
  config: StandConfig,
  baseRadius: number
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
  
  // 2. Create legs
  const legGeometries = createTripodLegs(
    baseRadius,
    tripod,
    config.baseThickness
  );
  geometries.push(...legGeometries);
  
  return mergeGeometries(geometries);
}

/**
 * Create the base disc with optional taper, edge styling, and lip
 */
function createBaseDisc(
  radius: number,
  thickness: number,
  taper: number,
  edgeStyle: 'flat' | 'rounded' | 'chamfer',
  lip: number
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const topRadius = radius;
  const bottomRadius = radius * (1 - taper);
  
  // For simplicity, create a tapered cylinder
  // More complex edge styles can be added later
  
  // Top surface
  const topCenterIdx = 0;
  vertices.push(0, 0, 0); // Top center at y=0
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(theta) * topRadius,
      0,
      Math.sin(theta) * topRadius
    );
  }
  
  // Top surface triangles
  for (let i = 0; i < segments; i++) {
    indices.push(topCenterIdx, i + 1, i + 2);
  }
  
  // Bottom surface
  const bottomCenterIdx = vertices.length / 3;
  vertices.push(0, -thickness, 0);
  
  const bottomRingStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(theta) * bottomRadius,
      -thickness,
      Math.sin(theta) * bottomRadius
    );
  }
  
  // Bottom surface triangles (reversed winding)
  for (let i = 0; i < segments; i++) {
    indices.push(bottomCenterIdx, bottomRingStart + i + 1, bottomRingStart + i);
  }
  
  // Side wall
  for (let i = 0; i < segments; i++) {
    const topA = i + 1;
    const topB = i + 2;
    const botA = bottomRingStart + i;
    const botB = bottomRingStart + i + 1;
    
    indices.push(topA, botA, topB);
    indices.push(topB, botA, botB);
  }
  
  // Add lip if specified
  if (lip > 0) {
    const lipInnerRadius = topRadius - 2; // 2mm wall for lip
    const lipTopStart = vertices.length / 3;
    
    // Lip top outer
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(
        Math.cos(theta) * topRadius,
        lip,
        Math.sin(theta) * topRadius
      );
    }
    
    // Lip top inner
    const lipInnerStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(
        Math.cos(theta) * lipInnerRadius,
        lip,
        Math.sin(theta) * lipInnerRadius
      );
    }
    
    // Lip bottom inner (at y=0)
    const lipBottomInnerStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(
        Math.cos(theta) * lipInnerRadius,
        0,
        Math.sin(theta) * lipInnerRadius
      );
    }
    
    // Outer wall of lip
    for (let i = 0; i < segments; i++) {
      indices.push(i + 1, lipTopStart + i, i + 2);
      indices.push(i + 2, lipTopStart + i, lipTopStart + i + 1);
    }
    
    // Top of lip
    for (let i = 0; i < segments; i++) {
      indices.push(lipTopStart + i, lipInnerStart + i, lipTopStart + i + 1);
      indices.push(lipTopStart + i + 1, lipInnerStart + i, lipInnerStart + i + 1);
    }
    
    // Inner wall of lip
    for (let i = 0; i < segments; i++) {
      indices.push(lipInnerStart + i, lipBottomInnerStart + i, lipInnerStart + i + 1);
      indices.push(lipInnerStart + i + 1, lipBottomInnerStart + i, lipBottomInnerStart + i + 1);
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create tripod legs
 */
function createTripodLegs(
  baseRadius: number,
  tripod: TripodConfig,
  discBottom: number
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const { legCount, legHeight, legSpread, legThickness, legTaper, legInset } = tripod;
  
  const spreadRad = (legSpread * Math.PI) / 180;
  const segments = 8;
  const heightSegments = 12;
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    // Leg attachment point
    const attachRadius = baseRadius * (1 - legInset * 0.7);
    const attachX = Math.cos(angle) * attachRadius;
    const attachZ = Math.sin(angle) * attachRadius;
    
    // Leg end point (foot)
    const outwardX = Math.cos(angle);
    const outwardZ = Math.sin(angle);
    const horizontalDist = Math.sin(spreadRad) * legHeight;
    const verticalDist = Math.cos(spreadRad) * legHeight;
    
    const footX = attachX + outwardX * horizontalDist;
    const footZ = attachZ + outwardZ * horizontalDist;
    const footY = -discBottom - verticalDist;
    
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Calculate leg direction
    const legDirX = footX - attachX;
    const legDirY = footY - (-discBottom);
    const legDirZ = footZ - attachZ;
    const legLen = Math.sqrt(legDirX * legDirX + legDirY * legDirY + legDirZ * legDirZ);
    
    const dirX = legDirX / legLen;
    const dirY = legDirY / legLen;
    const dirZ = legDirZ / legLen;
    
    // Perpendicular vectors for cylinder
    let perpX = -dirZ;
    let perpZ = dirX;
    const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ);
    if (perpLen > 0.001) {
      perpX /= perpLen;
      perpZ /= perpLen;
    } else {
      perpX = 1;
      perpZ = 0;
    }
    
    const perp2X = dirY * perpZ;
    const perp2Y = dirZ * perpX - dirX * perpZ;
    const perp2Z = -dirY * perpX;
    
    const topRadius = legThickness / 2;
    const bottomRadius = topRadius * (1 - legTaper * 0.6);
    
    // Build leg rings
    for (let h = 0; h <= heightSegments; h++) {
      const t = h / heightSegments;
      
      const px = attachX + (footX - attachX) * t;
      const py = -discBottom + (footY - (-discBottom)) * t;
      const pz = attachZ + (footZ - attachZ) * t;
      
      const r = topRadius + (bottomRadius - topRadius) * t;
      
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        const cx = Math.cos(segAngle) * perpX + Math.sin(segAngle) * perp2X;
        const cy = Math.sin(segAngle) * perp2Y;
        const cz = Math.cos(segAngle) * perpZ + Math.sin(segAngle) * perp2Z;
        vertices.push(px + cx * r, py + cy * r, pz + cz * r);
      }
    }
    
    // Index faces
    for (let h = 0; h < heightSegments; h++) {
      for (let s = 0; s < segments; s++) {
        const a = h * (segments + 1) + s;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    
    // Foot cap
    const footCenterIdx = vertices.length / 3;
    vertices.push(footX, footY, footZ);
    const lastRingStart = heightSegments * (segments + 1);
    for (let s = 0; s < segments; s++) {
      indices.push(lastRingStart + s, footCenterIdx, lastRingStart + s + 1);
    }
    
    // Top cap
    const topCenterIdx = vertices.length / 3;
    vertices.push(attachX, -discBottom, attachZ);
    for (let s = 0; s < segments; s++) {
      indices.push(s + 1, topCenterIdx, s);
    }
    
    const legGeo = new THREE.BufferGeometry();
    legGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    legGeo.setIndex(indices);
    legGeo.computeVertexNormals();
    geometries.push(legGeo);
  }
  
  return geometries;
}

/**
 * Generate weighted disc base
 */
function generateWeightedDisc(
  config: StandConfig,
  baseRadius: number
): THREE.BufferGeometry {
  const weightedDisc = config.weightedDisc;
  if (!weightedDisc) {
    return createBaseDisc(baseRadius, config.baseThickness, 0, 'flat', 0);
  }
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // Main disc
  const discRadius = weightedDisc.discDiameter / 2;
  const discGeometry = createBaseDisc(
    discRadius,
    weightedDisc.discThickness,
    config.baseTaper,
    config.baseEdgeStyle,
    config.baseLip
  );
  geometries.push(discGeometry);
  
  // Weight cavity would be subtracted in CSG (not implemented here)
  // Rubber feet recesses would also be CSG operations
  
  return mergeGeometries(geometries);
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
  
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;
  
  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    const idx = geo.getIndex();
    
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    }
    
    vertexOffset += pos?.count || 0;
  }
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  
  return merged;
}

/**
 * Calculate the footprint radius for stability analysis
 */
export function getStandFootprint(config: StandConfig, baseRadius: number): number {
  if (config.type === 'tripod' && config.tripod) {
    const { legHeight, legSpread, legInset } = config.tripod;
    const spreadRad = (legSpread * Math.PI) / 180;
    const attachRadius = baseRadius * (1 - legInset * 0.7);
    const horizontalDist = Math.sin(spreadRad) * legHeight;
    return attachRadius + horizontalDist;
  } else if (config.type === 'weighted-disc' && config.weightedDisc) {
    return config.weightedDisc.discDiameter / 2;
  }
  return baseRadius;
}
