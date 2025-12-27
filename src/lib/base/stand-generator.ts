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
  baseRadius: number,
  bodyBottomRadius?: number
): THREE.BufferGeometry | null {
  switch (config.type) {
    case 'tripod':
      return generateTripodStand(config, baseRadius, bodyBottomRadius);
    case 'weighted-disc':
      return generateWeightedDisc(config, baseRadius, bodyBottomRadius);
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
  
  // 2. Create flush attachment ring if body radius differs from base radius
  if (bodyBottomRadius && Math.abs(bodyBottomRadius - baseRadius) > 0.5) {
    const ringGeometry = createTransitionRing(
      Math.min(bodyBottomRadius, baseRadius),
      Math.max(bodyBottomRadius, baseRadius),
      config.baseThickness
    );
    geometries.push(ringGeometry);
  }
  
  // 3. Create legs with flush attachment to disc
  const legGeometries = createTripodLegs(
    baseRadius,
    tripod,
    config.baseThickness
  );
  geometries.push(...legGeometries);
  
  return mergeGeometries(geometries);
}

/**
 * Create a transition ring to bridge between body bottom and stand top
 */
function createTransitionRing(
  innerRadius: number,
  outerRadius: number,
  height: number
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Top inner ring
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * innerRadius, 0, Math.sin(theta) * innerRadius);
  }
  
  // Top outer ring
  const topOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * outerRadius, 0, Math.sin(theta) * outerRadius);
  }
  
  // Bottom inner ring
  const botInnerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * innerRadius, -height, Math.sin(theta) * innerRadius);
  }
  
  // Bottom outer ring
  const botOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * outerRadius, -height, Math.sin(theta) * outerRadius);
  }
  
  // Top face (ring)
  for (let i = 0; i < segments; i++) {
    indices.push(i, topOuterStart + i, i + 1);
    indices.push(i + 1, topOuterStart + i, topOuterStart + i + 1);
  }
  
  // Bottom face (ring)
  for (let i = 0; i < segments; i++) {
    indices.push(botInnerStart + i, botInnerStart + i + 1, botOuterStart + i);
    indices.push(botOuterStart + i, botInnerStart + i + 1, botOuterStart + i + 1);
  }
  
  // Inner wall
  for (let i = 0; i < segments; i++) {
    indices.push(i, i + 1, botInnerStart + i);
    indices.push(botInnerStart + i, i + 1, botInnerStart + i + 1);
  }
  
  // Outer wall
  for (let i = 0; i < segments; i++) {
    indices.push(topOuterStart + i, botOuterStart + i, topOuterStart + i + 1);
    indices.push(topOuterStart + i + 1, botOuterStart + i, botOuterStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
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
 * Generate weighted disc base with complete features:
 * - Main disc body with proper dimensions
 * - Weight cavity (optional) - hollow space for adding coins/washers for stability
 * - Rubber feet recesses - indentations for rubber bumpers
 * - Cord hole - channel for wiring
 * - Solid transition collar from body to disc
 */
function generateWeightedDisc(
  config: StandConfig,
  baseRadius: number,
  bodyBottomRadius?: number
): THREE.BufferGeometry {
  const weightedDisc = config.weightedDisc;
  if (!weightedDisc) {
    return createBaseDisc(baseRadius, config.baseThickness, 0, 'flat', 0);
  }
  
  const geometries: THREE.BufferGeometry[] = [];
  const segments = 64;
  
  const discRadius = weightedDisc.discDiameter / 2;
  const discThickness = weightedDisc.discThickness;
  const effectiveBodyRadius = bodyBottomRadius || baseRadius;
  
  // 1. Create main disc body (solid cylinder with top and bottom faces)
  const discGeo = createSolidDisc(discRadius, discThickness, segments, config.baseEdgeStyle);
  geometries.push(discGeo);
  
  // 2. Create weight cavity if enabled (hollow recess from bottom)
  if (weightedDisc.weightCavityEnabled && weightedDisc.weightCavityDiameter > 0) {
    const cavityRadius = Math.min(weightedDisc.weightCavityDiameter / 2, discRadius - 5);
    const cavityDepth = Math.min(weightedDisc.weightCavityDepth || discThickness - 2, discThickness - 2);
    
    if (cavityRadius > 5 && cavityDepth > 1) {
      // Visual representation of cavity (a darker cylinder inset from bottom)
      const cavityGeo = createCavityVisual(cavityRadius, cavityDepth, segments);
      geometries.push(cavityGeo);
    }
  }
  
  // 3. Create rubber feet recesses if enabled
  if (weightedDisc.rubberFeetEnabled && weightedDisc.rubberFeetCount > 0) {
    const feetCount = weightedDisc.rubberFeetCount;
    const feetRadius = (weightedDisc.rubberFeetDiameter || 10) / 2;
    const feetRecessDepth = 2; // 2mm deep recess
    const feetPlacementRadius = discRadius * 0.7; // 70% from center
    
    for (let i = 0; i < feetCount; i++) {
      const angle = (i / feetCount) * Math.PI * 2;
      const fx = Math.cos(angle) * feetPlacementRadius;
      const fz = Math.sin(angle) * feetPlacementRadius;
      
      const footGeo = createFootRecess(fx, fz, feetRadius, feetRecessDepth, -discThickness, segments);
      geometries.push(footGeo);
    }
  }
  
  // 4. Create solid transition collar from body bottom to disc top
  if (Math.abs(effectiveBodyRadius - discRadius) > 0.5 || effectiveBodyRadius < discRadius) {
    const collarHeight = Math.min(15, discThickness * 0.6);
    const collarGeo = createSolidTransitionCollar(
      effectiveBodyRadius,
      Math.min(effectiveBodyRadius + 2, discRadius), // Collar top radius
      collarHeight,
      segments
    );
    geometries.push(collarGeo);
  }
  
  // 5. Create cord hole if socket config has it enabled
  // Note: Cord hole is typically handled at socket level, but we add visual marker
  const cordHoleGeo = createCordHoleMarker(8, discThickness, segments);
  geometries.push(cordHoleGeo);
  
  return mergeGeometries(geometries);
}

/**
 * Create a solid disc with top, bottom, and side faces
 */
function createSolidDisc(
  radius: number,
  thickness: number,
  segments: number,
  edgeStyle: 'flat' | 'rounded' | 'chamfer'
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Chamfer size for edge style
  const chamferSize = edgeStyle === 'chamfer' ? Math.min(2, thickness * 0.3) : 0;
  
  // Top center
  const topCenterIdx = 0;
  vertices.push(0, 0, 0);
  
  // Top ring
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = edgeStyle === 'chamfer' ? radius - chamferSize : radius;
    vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
  }
  
  // Top face triangles
  for (let i = 0; i < segments; i++) {
    indices.push(topCenterIdx, i + 2, i + 1);
  }
  
  // If chamfered, add chamfer ring at top
  let chamferTopStart = 0;
  if (edgeStyle === 'chamfer') {
    chamferTopStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * radius, -chamferSize, Math.sin(theta) * radius);
    }
    
    // Connect top ring to chamfer ring
    for (let i = 0; i < segments; i++) {
      const topA = i + 1;
      const topB = i + 2;
      const chamA = chamferTopStart + i;
      const chamB = chamferTopStart + i + 1;
      
      indices.push(topA, chamA, topB);
      indices.push(topB, chamA, chamB);
    }
  }
  
  // Side wall
  const sideTopStart = edgeStyle === 'chamfer' ? chamferTopStart : 1;
  const sideBottomStart = vertices.length / 3;
  const bottomY = -thickness + (edgeStyle === 'chamfer' ? chamferSize : 0);
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * radius, bottomY, Math.sin(theta) * radius);
  }
  
  // Side faces
  for (let i = 0; i < segments; i++) {
    const topA = sideTopStart + i;
    const topB = sideTopStart + i + 1;
    const botA = sideBottomStart + i;
    const botB = sideBottomStart + i + 1;
    
    indices.push(topA, botA, topB);
    indices.push(topB, botA, botB);
  }
  
  // Bottom chamfer ring if chamfered
  let chamferBottomStart = 0;
  if (edgeStyle === 'chamfer') {
    chamferBottomStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = radius - chamferSize;
      vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
    }
    
    // Connect bottom chamfer
    for (let i = 0; i < segments; i++) {
      const sideA = sideBottomStart + i;
      const sideB = sideBottomStart + i + 1;
      const chamA = chamferBottomStart + i;
      const chamB = chamferBottomStart + i + 1;
      
      indices.push(sideA, chamA, sideB);
      indices.push(sideB, chamA, chamB);
    }
  }
  
  // Bottom face
  const bottomRingStart = edgeStyle === 'chamfer' ? chamferBottomStart : sideBottomStart;
  const bottomCenterIdx = vertices.length / 3;
  vertices.push(0, -thickness, 0);
  
  for (let i = 0; i < segments; i++) {
    indices.push(bottomCenterIdx, bottomRingStart + i, bottomRingStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create visual representation of weight cavity (cylindrical recess from bottom)
 */
function createCavityVisual(radius: number, depth: number, segments: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // This creates a visual "hole" indicator - in actual print, CSG would subtract
  // For now, we create a recessed visual ring
  
  const innerRadius = radius - 2; // 2mm wall
  const y = -depth;
  
  // Bottom of cavity (ring showing the cavity)
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * innerRadius, y, Math.sin(theta) * innerRadius);
  }
  
  // Outer edge at cavity bottom
  const outerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  
  // Cavity floor ring
  for (let i = 0; i < segments; i++) {
    indices.push(i, i + 1, outerStart + i);
    indices.push(outerStart + i, i + 1, outerStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create a rubber foot recess (circular depression)
 */
function createFootRecess(
  cx: number,
  cz: number,
  radius: number,
  depth: number,
  baseY: number,
  segments: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const footSegs = 16;
  
  // Ring at bottom surface level
  for (let i = 0; i <= footSegs; i++) {
    const theta = (i / footSegs) * Math.PI * 2;
    vertices.push(
      cx + Math.cos(theta) * radius,
      baseY,
      cz + Math.sin(theta) * radius
    );
  }
  
  // Ring at recess depth
  const recessStart = vertices.length / 3;
  for (let i = 0; i <= footSegs; i++) {
    const theta = (i / footSegs) * Math.PI * 2;
    vertices.push(
      cx + Math.cos(theta) * radius,
      baseY + depth,
      cz + Math.sin(theta) * radius
    );
  }
  
  // Recess wall
  for (let i = 0; i < footSegs; i++) {
    indices.push(i, recessStart + i, i + 1);
    indices.push(i + 1, recessStart + i, recessStart + i + 1);
  }
  
  // Recess floor (flat bottom)
  const centerIdx = vertices.length / 3;
  vertices.push(cx, baseY + depth, cz);
  
  for (let i = 0; i < footSegs; i++) {
    indices.push(centerIdx, recessStart + i + 1, recessStart + i);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create a solid transition collar (not hollow) from body to disc
 */
function createSolidTransitionCollar(
  topRadius: number,
  bottomRadius: number,
  height: number,
  segments: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Top cap (solid circle)
  const topCenterIdx = 0;
  vertices.push(0, 0, 0);
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * topRadius, 0, Math.sin(theta) * topRadius);
  }
  
  // Top cap faces
  for (let i = 0; i < segments; i++) {
    indices.push(topCenterIdx, i + 2, i + 1);
  }
  
  // Bottom ring (conical side)
  const bottomRingStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * bottomRadius, -height, Math.sin(theta) * bottomRadius);
  }
  
  // Conical side faces
  for (let i = 0; i < segments; i++) {
    const topA = i + 1;
    const topB = i + 2;
    const botA = bottomRingStart + i;
    const botB = bottomRingStart + i + 1;
    
    indices.push(topA, botA, topB);
    indices.push(topB, botA, botB);
  }
  
  // Bottom cap (solid circle)
  const bottomCenterIdx = vertices.length / 3;
  vertices.push(0, -height, 0);
  
  for (let i = 0; i < segments; i++) {
    indices.push(bottomCenterIdx, bottomRingStart + i, bottomRingStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create cord hole visual marker (a circle indicating where cord goes through)
 */
function createCordHoleMarker(diameter: number, discThickness: number, segments: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const radius = diameter / 2;
  const ringWidth = 1; // 1mm indicator ring
  
  // Top surface ring around cord hole
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * radius, 0.01, Math.sin(theta) * radius);
  }
  
  // Outer indicator ring
  const outerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * (radius + ringWidth), 0.01, Math.sin(theta) * (radius + ringWidth));
  }
  
  // Ring faces (visual indicator)
  for (let i = 0; i < segments; i++) {
    indices.push(i, outerStart + i, i + 1);
    indices.push(i + 1, outerStart + i, outerStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create a conical transition collar between body and stand
 */
function createTransitionCollar(
  topRadius: number,
  bottomRadius: number,
  height: number
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const wallThickness = 2; // mm
  const topInner = Math.max(topRadius - wallThickness, topRadius * 0.8);
  const bottomInner = Math.max(bottomRadius - wallThickness, bottomRadius * 0.8);
  
  // Top outer ring
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * topRadius, 0, Math.sin(theta) * topRadius);
  }
  
  // Top inner ring
  const topInnerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * topInner, 0, Math.sin(theta) * topInner);
  }
  
  // Bottom outer ring
  const botOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * bottomRadius, -height, Math.sin(theta) * bottomRadius);
  }
  
  // Bottom inner ring
  const botInnerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * bottomInner, -height, Math.sin(theta) * bottomInner);
  }
  
  // Top face (ring)
  for (let i = 0; i < segments; i++) {
    indices.push(i, topInnerStart + i, i + 1);
    indices.push(i + 1, topInnerStart + i, topInnerStart + i + 1);
  }
  
  // Bottom face (ring)
  for (let i = 0; i < segments; i++) {
    indices.push(botOuterStart + i, botOuterStart + i + 1, botInnerStart + i);
    indices.push(botInnerStart + i, botOuterStart + i + 1, botInnerStart + i + 1);
  }
  
  // Outer wall (conical)
  for (let i = 0; i < segments; i++) {
    indices.push(i, botOuterStart + i, i + 1);
    indices.push(i + 1, botOuterStart + i, botOuterStart + i + 1);
  }
  
  // Inner wall (conical)
  for (let i = 0; i < segments; i++) {
    indices.push(topInnerStart + i, topInnerStart + i + 1, botInnerStart + i);
    indices.push(botInnerStart + i, topInnerStart + i + 1, botInnerStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
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
