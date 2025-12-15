import * as THREE from 'three';
import { ParametricStandParams, plugSpecs } from '@/types/stand';

// ============================================
// SIMPLE STAND GENERATOR
// Clean legs with rounded ends, properly attached
// ============================================

const getPlugDimensions = (plugSize: number, plugHeight: number) => {
  const plugRadius = plugSize / 2;
  const clearance = plugSpecs.clearance;
  
  return {
    radius: plugRadius - clearance,
    height: plugHeight,
  };
};

// Generate internal plug (hidden inside object)
function generatePlug(params: ParametricStandParams, topY: number): THREE.BufferGeometry {
  const plug = getPlugDimensions(params.plugSize, params.plugHeight);
  
  const plugGeom = new THREE.CylinderGeometry(
    plug.radius,
    plug.radius * 0.98,
    plug.height,
    32
  );
  plugGeom.translate(0, topY - plug.height / 2, 0);
  
  return plugGeom;
}

// Generate a single leg with rounded ends
function generateLeg(
  params: ParametricStandParams,
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3
): THREE.BufferGeometry {
  const { legThickness, legTaper, legProfile } = params;
  const geometries: THREE.BufferGeometry[] = [];
  
  const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
  const length = direction.length();
  
  if (length < 1) return new THREE.BufferGeometry();
  
  direction.normalize();
  
  // Create path points for leg
  const pathPoints: THREE.Vector3[] = [];
  const segments = 16;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
    pathPoints.push(point);
  }
  
  const path = new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.5);
  
  const radialSegments = legProfile === 'square' ? 4 : legProfile === 'angular' ? 6 : 12;
  const baseRadius = legThickness / 2;
  
  // Create tube geometry for the leg
  const tubeGeom = new THREE.TubeGeometry(path, segments, baseRadius, radialSegments, false);
  
  // Apply taper if needed
  if (legTaper > 0.01) {
    const positions = tubeGeom.getAttribute('position');
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      const t = Math.max(0, Math.min(1, 1 - (vertex.y - endPoint.y) / (startPoint.y - endPoint.y)));
      const pathPoint = path.getPointAt(Math.min(1, Math.max(0, t)));
      const offset = vertex.clone().sub(pathPoint);
      
      // Taper from top (full thickness) to bottom (reduced)
      const taperScale = 1 - (t * legTaper * 0.7);
      offset.multiplyScalar(Math.max(0.3, taperScale));
      
      const newPos = pathPoint.clone().add(offset);
      positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
    }
    
    positions.needsUpdate = true;
  }
  
  tubeGeom.computeVertexNormals();
  geometries.push(tubeGeom);
  
  // Add rounded end (sphere at bottom of leg)
  const endRadius = baseRadius * (1 - legTaper * 0.7);
  const sphereGeom = new THREE.SphereGeometry(Math.max(endRadius, baseRadius * 0.3), 12, 8);
  sphereGeom.translate(endPoint.x, endPoint.y, endPoint.z);
  geometries.push(sphereGeom);
  
  return mergeGeometries(geometries);
}

// Generate simple tripod stand
export function generateTripodStand(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plugTop = params.height;
  const plugBottom = plugTop - params.plugHeight;
  const plugRadius = params.plugSize / 2 - plugSpecs.clearance;
  
  // 1. Internal plug at top (hidden inside object)
  geometries.push(generatePlug(params, plugTop));
  
  // 2. Legs - attach directly to bottom edge of plug
  const legCount = params.legCount;
  const legAngleStep = (Math.PI * 2) / legCount;
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  
  // Calculate where legs end at ground level
  const bottomSpreadRadius = plugRadius + plugBottom * Math.tan(legSpreadRad);
  
  for (let i = 0; i < legCount; i++) {
    const angle = i * legAngleStep;
    
    // Start at bottom edge of plug
    const startX = Math.cos(angle) * plugRadius * 0.9;
    const startZ = Math.sin(angle) * plugRadius * 0.9;
    const startPoint = new THREE.Vector3(startX, plugBottom, startZ);
    
    // End at ground, spread outward
    const endX = Math.cos(angle) * bottomSpreadRadius;
    const endZ = Math.sin(angle) * bottomSpreadRadius;
    const endPoint = new THREE.Vector3(endX, 0, endZ);
    
    const legGeom = generateLeg(params, startPoint, endPoint);
    if (legGeom.getAttribute('position')?.count > 0) {
      geometries.push(legGeom);
    }
  }
  
  return mergeGeometries(geometries);
}

// Generate pendant bracket
export function generatePendantBracket(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plugTop = params.height;
  const canopyDiameter = 60;
  const canopyHeight = 15;
  const cordRadius = 3;
  
  const totalHeight = plugTop + params.cordLength + canopyHeight;
  
  // 1. Canopy dome at ceiling
  const canopyGeom = new THREE.SphereGeometry(
    canopyDiameter / 2,
    24, 12,
    0, Math.PI * 2,
    0, Math.PI / 2
  );
  canopyGeom.scale(1, canopyHeight / (canopyDiameter / 2), 1);
  canopyGeom.translate(0, totalHeight - canopyHeight, 0);
  geometries.push(canopyGeom);
  
  // 2. Cord
  const cordGeom = new THREE.CylinderGeometry(cordRadius, cordRadius, params.cordLength, 8);
  cordGeom.translate(0, totalHeight - canopyHeight - params.cordLength / 2, 0);
  geometries.push(cordGeom);
  
  // 3. Internal plug
  geometries.push(generatePlug(params, plugTop));
  
  return mergeGeometries(geometries);
}

// Generate wall arm
export function generateWallArm(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const backplateWidth = 80;
  const backplateHeight = 100;
  const wallThickness = 5;
  const armRadius = 6;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight / 2 + params.armLength * Math.sin(armAngleRad);
  
  // 1. Backplate
  const backplateGeom = new THREE.BoxGeometry(backplateWidth, backplateHeight, wallThickness);
  backplateGeom.translate(0, backplateHeight / 2, 0);
  geometries.push(backplateGeom);
  
  // 2. Arm
  const armGeom = new THREE.CylinderGeometry(armRadius, armRadius, params.armLength, 16);
  armGeom.rotateX(Math.PI / 2 - armAngleRad);
  armGeom.translate(
    0,
    backplateHeight / 2 + params.armLength / 2 * Math.sin(armAngleRad),
    params.armLength / 2 * Math.cos(armAngleRad)
  );
  geometries.push(armGeom);
  
  // 3. Plug at end of arm
  const plugRadius = params.plugSize / 2 - plugSpecs.clearance;
  const plugGeom = new THREE.CylinderGeometry(plugRadius, plugRadius * 0.98, params.plugHeight, 32);
  plugGeom.translate(0, armEndY + params.plugHeight / 2, armEndZ);
  geometries.push(plugGeom);
  
  return mergeGeometries(geometries);
}

// Get plug height for positioning calculations
export function getParametricPlugHeight(params: ParametricStandParams): number {
  return params.plugHeight;
}

// Main generator function
export function generateParametricStandGeometry(params: ParametricStandParams): THREE.BufferGeometry {
  if (!params.enabled) {
    return new THREE.BufferGeometry();
  }
  
  switch (params.mountType) {
    case 'tripod':
      return generateTripodStand(params);
    case 'pendant':
      return generatePendantBracket(params);
    case 'wall_arm':
      return generateWallArm(params);
    default:
      return new THREE.BufferGeometry();
  }
}

// Helper: Merge geometries
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
