import * as THREE from 'three';
import { ParametricStandParams, socketCradleSpecs } from '@/types/stand';

// ============================================
// UNIVERSAL STANDARD RIM COLLAR SYSTEM
// Stand generators with socket cradle at top
// ============================================

const SCALE = 0.01; // mm to scene units

// Socket cradle wall thickness (thicker for visibility)
const CRADLE_WALL = 4; // mm

// Get socket cradle dimensions
function getSocketCradleDims(socketSize: number, depth: number) {
  const innerRadius = (socketSize / 2) + socketCradleSpecs.clearance;
  const outerRadius = innerRadius + CRADLE_WALL;
  return { innerRadius, outerRadius, depth };
}

// Generate socket cradle ring (where object's collar sits)
// Creates a visible ring with inner lip for the collar to seat into
function generateSocketCradle(
  socketSize: number,
  cradleDepth: number,
  centerY: number
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const cradle = getSocketCradleDims(socketSize, cradleDepth);
  
  // Main cradle ring (thicker walls for visibility)
  const shape = new THREE.Shape();
  shape.absarc(0, 0, cradle.outerRadius * SCALE, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, cradle.innerRadius * SCALE, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  
  const extrudeSettings = {
    depth: cradle.depth * SCALE,
    bevelEnabled: false,
  };
  
  const mainRing = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  mainRing.rotateX(-Math.PI / 2);
  mainRing.translate(0, centerY, 0);
  geometries.push(mainRing);
  
  // Inner lip (small ridge at bottom of cradle for collar to rest on)
  const lipHeight = 1.5 * SCALE;
  const lipWidth = 2 * SCALE;
  const lipShape = new THREE.Shape();
  lipShape.absarc(0, 0, cradle.innerRadius * SCALE, 0, Math.PI * 2, false);
  const lipHole = new THREE.Path();
  lipHole.absarc(0, 0, (cradle.innerRadius - 2) * SCALE, 0, Math.PI * 2, true);
  lipShape.holes.push(lipHole);
  
  const lip = new THREE.ExtrudeGeometry(lipShape, { depth: lipHeight, bevelEnabled: false });
  lip.rotateX(-Math.PI / 2);
  lip.translate(0, centerY, 0);
  geometries.push(lip);
  
  // Top rim highlight (thin ring at top of cradle)
  const rimGeom = new THREE.TorusGeometry(
    (cradle.outerRadius - CRADLE_WALL / 2) * SCALE,
    0.8 * SCALE,
    8,
    32
  );
  rimGeom.rotateX(Math.PI / 2);
  rimGeom.translate(0, centerY + cradle.depth * SCALE, 0);
  geometries.push(rimGeom);
  
  return mergeGeometries(geometries);
}

// Generate a single leg with rounded end
function generateLeg(
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3,
  thickness: number,
  taper: number,
  profile: 'round' | 'square' | 'angular'
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
  const length = direction.length();
  
  if (length < 0.01) return new THREE.BufferGeometry();
  
  direction.normalize();
  
  // Create path
  const pathPoints: THREE.Vector3[] = [];
  const segments = 12;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pathPoints.push(new THREE.Vector3().lerpVectors(startPoint, endPoint, t));
  }
  
  const path = new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.5);
  
  const radialSegments = profile === 'square' ? 4 : profile === 'angular' ? 6 : 12;
  const baseRadius = (thickness / 2) * SCALE;
  
  // Create tube
  const tubeGeom = new THREE.TubeGeometry(path, segments, baseRadius, radialSegments, false);
  
  // Apply taper
  if (taper > 0.01) {
    const positions = tubeGeom.getAttribute('position');
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      // Calculate t based on Y position
      const t = Math.max(0, Math.min(1, (vertex.y - endPoint.y) / (startPoint.y - endPoint.y)));
      
      // Find closest point on path
      const pathPoint = path.getPointAt(1 - t);
      const offset = vertex.clone().sub(pathPoint);
      
      // Taper: thicker at top, thinner at bottom
      const taperScale = 1 - ((1 - t) * taper * 0.7);
      offset.multiplyScalar(Math.max(0.3, taperScale));
      
      const newPos = pathPoint.clone().add(offset);
      positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
    }
    
    positions.needsUpdate = true;
  }
  
  tubeGeom.computeVertexNormals();
  geometries.push(tubeGeom);
  
  // Rounded end sphere
  const endRadius = baseRadius * (1 - taper * 0.7);
  const sphereGeom = new THREE.SphereGeometry(Math.max(endRadius, baseRadius * 0.3), 12, 8);
  sphereGeom.translate(endPoint.x, endPoint.y, endPoint.z);
  geometries.push(sphereGeom);
  
  return mergeGeometries(geometries);
}

// ============================================
// TRIPOD STAND - WOOJ-inspired thin legs
// ============================================
export function generateTripodStand(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const standHeight = params.height * SCALE;
  const cradleY = standHeight;
  const cradleDepth = params.socketCradleDepth;
  const socketRadius = (params.socketSize / 2) * SCALE;
  
  // 1. Socket cradle at top
  geometries.push(generateSocketCradle(params.socketSize, cradleDepth, cradleY - cradleDepth * SCALE));
  
  // 2. Thin disc under cradle (visual connection point)
  const discGeom = new THREE.CylinderGeometry(
    socketRadius + socketCradleSpecs.wallThickness * SCALE,
    socketRadius + socketCradleSpecs.wallThickness * SCALE * 1.2,
    3 * SCALE,
    32
  );
  discGeom.translate(0, cradleY - cradleDepth * SCALE - 1.5 * SCALE, 0);
  geometries.push(discGeom);
  
  // 3. Legs - attach from edge of disc
  const legCount = params.legCount;
  const legAngleStep = (Math.PI * 2) / legCount;
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  
  const legStartRadius = socketRadius + socketCradleSpecs.wallThickness * SCALE * 0.8;
  const legStartY = cradleY - cradleDepth * SCALE - 3 * SCALE;
  
  // Calculate ground spread
  const groundSpreadRadius = legStartRadius + legStartY * Math.tan(legSpreadRad);
  
  for (let i = 0; i < legCount; i++) {
    const angle = i * legAngleStep;
    
    const startX = Math.cos(angle) * legStartRadius;
    const startZ = Math.sin(angle) * legStartRadius;
    const startPoint = new THREE.Vector3(startX, legStartY, startZ);
    
    const endX = Math.cos(angle) * groundSpreadRadius;
    const endZ = Math.sin(angle) * groundSpreadRadius;
    const endPoint = new THREE.Vector3(endX, 0, endZ);
    
    const legGeom = generateLeg(
      startPoint,
      endPoint,
      params.legThickness,
      params.legTaper,
      params.legProfile
    );
    
    if (legGeom.getAttribute('position')?.count > 0) {
      geometries.push(legGeom);
    }
  }
  
  return mergeGeometries(geometries);
}

// ============================================
// RIBBED PEDESTAL - Brut lamp inspired
// ============================================
export function generateRibbedPedestal(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const standHeight = params.height * SCALE;
  const cradleY = standHeight;
  const cradleDepth = params.socketCradleDepth;
  
  // 1. Socket cradle at top
  geometries.push(generateSocketCradle(params.socketSize, cradleDepth, cradleY - cradleDepth * SCALE));
  
  // 2. Ribbed cylinder body
  const pedestalRadius = (params.pedestalDiameter / 2) * SCALE;
  const pedestalHeight = standHeight - cradleDepth * SCALE;
  const ribCount = params.ribCount;
  const ribDepth = params.ribDepth * SCALE;
  const baseFlare = params.baseFlare;
  
  // Create ribbed profile using lathe geometry
  const points: THREE.Vector2[] = [];
  const ribSegments = 32;
  
  for (let i = 0; i <= ribSegments; i++) {
    const t = i / ribSegments;
    const y = t * pedestalHeight;
    
    // Base radius with flare at bottom
    let radius = pedestalRadius;
    if (baseFlare > 0) {
      const flareT = 1 - t;
      radius += flareT * flareT * baseFlare * pedestalRadius * 0.3;
    }
    
    points.push(new THREE.Vector2(radius, y));
  }
  
  const latheGeom = new THREE.LatheGeometry(points, ribCount * 2);
  
  // Apply rib pattern by modifying vertices
  const positions = latheGeom.getAttribute('position');
  
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    
    const angle = Math.atan2(z, x);
    const ribPhase = angle * ribCount;
    const ribFactor = (Math.sin(ribPhase) + 1) / 2; // 0-1
    
    const currentRadius = Math.sqrt(x * x + z * z);
    const newRadius = currentRadius - ribDepth * ribFactor;
    
    const newX = Math.cos(angle) * newRadius;
    const newZ = Math.sin(angle) * newRadius;
    
    positions.setXYZ(i, newX, y, newZ);
  }
  
  positions.needsUpdate = true;
  latheGeom.computeVertexNormals();
  geometries.push(latheGeom);
  
  // 3. Solid base disc
  const baseRadius = pedestalRadius * (1 + baseFlare * 0.3);
  const baseGeom = new THREE.CylinderGeometry(baseRadius, baseRadius * 1.05, 4 * SCALE, 32);
  baseGeom.translate(0, 2 * SCALE, 0);
  geometries.push(baseGeom);
  
  return mergeGeometries(geometries);
}

// ============================================
// PENDANT - Ceiling hung with cord
// ============================================
export function generatePendant(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const cradleDepth = params.socketCradleDepth;
  const canopyRadius = (params.canopyDiameter / 2) * SCALE;
  const cordRadius = 3 * SCALE;
  const cordLength = params.cordLength * SCALE;
  
  // Position: canopy at top, cradle at bottom
  const canopyY = cordLength + 15 * SCALE;
  const cradleY = 0;
  
  // 1. Canopy dome at ceiling
  const canopyGeom = new THREE.SphereGeometry(
    canopyRadius,
    24, 12,
    0, Math.PI * 2,
    0, Math.PI / 2
  );
  canopyGeom.scale(1, 0.4, 1);
  canopyGeom.translate(0, canopyY, 0);
  geometries.push(canopyGeom);
  
  // 2. Cord
  const cordGeom = new THREE.CylinderGeometry(cordRadius, cordRadius, cordLength, 8);
  cordGeom.translate(0, canopyY - cordLength / 2, 0);
  geometries.push(cordGeom);
  
  // 3. Socket cradle at bottom (hanging down)
  geometries.push(generateSocketCradle(params.socketSize, cradleDepth, cradleY));
  
  // 4. Connection disc between cord and cradle
  const socketRadius = (params.socketSize / 2 + socketCradleSpecs.wallThickness) * SCALE;
  const discGeom = new THREE.CylinderGeometry(socketRadius, socketRadius, 5 * SCALE, 32);
  discGeom.translate(0, cradleY + cradleDepth * SCALE + 2.5 * SCALE, 0);
  geometries.push(discGeom);
  
  return mergeGeometries(geometries);
}

// ============================================
// WALL PLATE - Wall mounted with arm
// ============================================
export function generateWallPlate(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plateWidth = params.plateWidth * SCALE;
  const plateHeight = params.plateHeight * SCALE;
  const plateThickness = 8 * SCALE;
  const armLength = params.armLength * SCALE;
  const armAngle = (params.armAngle * Math.PI) / 180;
  const armRadius = 6 * SCALE;
  const cradleDepth = params.socketCradleDepth;
  
  // 1. Wall backplate (rounded rectangle)
  const backplateGeom = new THREE.BoxGeometry(plateWidth, plateHeight, plateThickness);
  backplateGeom.translate(0, plateHeight / 2, -plateThickness / 2);
  geometries.push(backplateGeom);
  
  // 2. Arm extending from wall
  const armStartY = plateHeight / 2;
  const armEndY = armStartY + Math.sin(armAngle) * armLength;
  const armEndZ = Math.cos(armAngle) * armLength;
  
  const armGeom = new THREE.CylinderGeometry(armRadius, armRadius * 0.9, armLength, 16);
  armGeom.rotateX(Math.PI / 2 - armAngle);
  armGeom.translate(0, armStartY + (armEndY - armStartY) / 2, armEndZ / 2);
  geometries.push(armGeom);
  
  // 3. Socket cradle at end of arm
  const cradleGeom = generateSocketCradle(params.socketSize, cradleDepth, armEndY);
  cradleGeom.translate(0, 0, armEndZ);
  geometries.push(cradleGeom);
  
  return mergeGeometries(geometries);
}

// ============================================
// FLAT BACK - Object sits flat against wall
// ============================================
export function generateFlatBack(params: ParametricStandParams): THREE.BufferGeometry {
  // For flat back, we just generate a mounting disc
  // The object itself should have a flat back
  const discRadius = (params.socketSize / 2 + 10) * SCALE;
  const discThickness = 5 * SCALE;
  
  const discGeom = new THREE.CylinderGeometry(discRadius, discRadius, discThickness, 32);
  discGeom.rotateX(Math.PI / 2);
  discGeom.translate(0, discRadius, -discThickness / 2);
  
  return discGeom;
}

// ============================================
// MAIN GENERATOR
// ============================================
export function generateParametricStandGeometry(params: ParametricStandParams): THREE.BufferGeometry {
  if (!params.enabled) {
    return new THREE.BufferGeometry();
  }
  
  switch (params.mountType) {
    case 'tripod':
      return generateTripodStand(params);
    case 'ribbed_pedestal':
      return generateRibbedPedestal(params);
    case 'pendant':
      return generatePendant(params);
    case 'wall_plate':
      return generateWallPlate(params);
    case 'flat_back':
      return generateFlatBack(params);
    default:
      return new THREE.BufferGeometry();
  }
}

// Get socket cradle depth for positioning calculations
export function getSocketCradleDepth(params: ParametricStandParams): number {
  return params.socketCradleDepth;
}

// ============================================
// HELPER: Merge geometries
// ============================================
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) return new THREE.BufferGeometry();
  
  let totalVertices = 0;
  let totalIndices = 0;
  
  for (const geom of geometries) {
    const pos = geom.getAttribute('position');
    if (pos) totalVertices += pos.count;
    const idx = geom.getIndex();
    if (idx) totalIndices += idx.count;
  }
  
  if (totalVertices === 0) return new THREE.BufferGeometry();
  
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices: number[] = [];
  
  let vertexOffset = 0;
  
  for (const geom of geometries) {
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    if (!pos) continue;
    
    for (let i = 0; i < pos.count; i++) {
      positions[(vertexOffset + i) * 3] = pos.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = pos.getZ(i);
      
      if (norm) {
        normals[(vertexOffset + i) * 3] = norm.getX(i);
        normals[(vertexOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vertexOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }
    
    const idx = geom.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(vertexOffset + i);
      }
    }
    
    vertexOffset += pos.count;
  }
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  
  return merged;
}
