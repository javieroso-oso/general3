import * as THREE from 'three';
import { StandParams as MainStandParams } from '@/types/parametric';

// ============================================
// STAND GENERATORS (LEGACY - kept for backward compatibility)
// Seamless, elegant stand system with smooth cup sockets
// ============================================

interface TripodParams {
  rimSize: number;
  height: number;
  legCount: 3 | 4;
  legSpread: number;
}


interface PendantParams {
  rimSize: number;
  height: number;
  cordLength: number;
}

interface WallArmParams {
  rimSize: number;
  height: number;
  armLength: number;
  armAngle: number;
}

// Socket cup dimensions - elegant cup that envelops the object base
const getSocketDimensions = (socketSize: number) => {
  const socketRadius = socketSize / 2;
  const clearance = 0.3; // Tight fit
  const wallThickness = 4;
  const cupDepth = 10; // Object drops 10mm into cup
  
  return {
    innerRadius: socketRadius + clearance,
    outerRadius: socketRadius + clearance + wallThickness,
    depth: cupDepth,
    lipRadius: socketRadius + clearance + wallThickness + 2, // Slight flare at top
  };
};

// Generate elegant cup socket using lathe geometry for smooth curves
function generateSmoothCupSocket(socketSize: number, topY: number): THREE.BufferGeometry {
  const socket = getSocketDimensions(socketSize);
  
  // Create cup profile for lathe (cross-section from center outward)
  // Profile goes from bottom of cup, up the inner wall, curves over the lip
  const points: THREE.Vector2[] = [];
  
  // Inner bottom (closed bottom of cup)
  points.push(new THREE.Vector2(0, topY - socket.depth));
  points.push(new THREE.Vector2(socket.innerRadius, topY - socket.depth));
  
  // Inner wall going up
  points.push(new THREE.Vector2(socket.innerRadius, topY - 2));
  
  // Smooth curved lip at top (using bezier-like curve)
  const lipCurveSteps = 8;
  for (let i = 0; i <= lipCurveSteps; i++) {
    const t = i / lipCurveSteps;
    // Quadratic curve from inner top to outer top
    const angle = t * Math.PI / 2;
    const curveRadius = socket.outerRadius - socket.innerRadius;
    const x = socket.innerRadius + Math.sin(angle) * curveRadius;
    const y = topY - 2 + Math.cos(angle) * 2;
    points.push(new THREE.Vector2(x, y));
  }
  
  // Outer wall going down with slight taper
  points.push(new THREE.Vector2(socket.outerRadius, topY - socket.depth + 2));
  points.push(new THREE.Vector2(socket.outerRadius * 0.95, topY - socket.depth));
  
  // Close the bottom
  points.push(new THREE.Vector2(0, topY - socket.depth));
  
  const geometry = new THREE.LatheGeometry(points, 48);
  return geometry;
}

// Generate tripod stand with elegant cup socket
export function generateTripodStandGeometry(params: TripodParams): THREE.BufferGeometry {
  const legCount = params.legCount;
  const legAngleStep = (Math.PI * 2) / legCount;
  const socket = getSocketDimensions(params.rimSize);
  
  // Scale leg thickness with rim size for proportion
  const legThickness = 6 + params.rimSize * 0.05;
  const hubRadius = socket.outerRadius * 0.8;
  const footPadRadius = 12 + params.rimSize * 0.08;
  const footPadHeight = 4;
  
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  const socketTop = params.height;
  const hubHeight = 15;
  const hubTopY = socketTop - socket.depth;
  const hubBottomY = hubTopY - hubHeight;
  const bottomSpreadRadius = hubRadius + hubBottomY * Math.tan(legSpreadRad);
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // 1. SMOOTH CUP SOCKET at top
  const cupGeom = generateSmoothCupSocket(params.rimSize, socketTop);
  geometries.push(cupGeom);
  
  // 2. CENTRAL HUB (tapered cylinder blending into socket)
  const hubGeom = new THREE.CylinderGeometry(
    hubRadius,
    hubRadius * 0.6,
    hubHeight,
    24
  );
  hubGeom.translate(0, hubTopY - hubHeight / 2, 0);
  geometries.push(hubGeom);
  
  // 3. LEGS with smooth taper
  for (let i = 0; i < legCount; i++) {
    const angle = i * legAngleStep;
    
    const topX = Math.cos(angle) * hubRadius * 0.6;
    const topY = hubBottomY;
    const topZ = Math.sin(angle) * hubRadius * 0.6;
    
    const bottomX = Math.cos(angle) * bottomSpreadRadius;
    const bottomY = footPadHeight;
    const bottomZ = Math.sin(angle) * bottomSpreadRadius;
    
    const dx = bottomX - topX;
    const dy = bottomY - topY;
    const dz = bottomZ - topZ;
    const legLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Tapered leg
    const legGeom = new THREE.CylinderGeometry(
      legThickness / 2,
      legThickness / 3,
      legLength,
      12
    );
    
    const midX = (topX + bottomX) / 2;
    const midY = (topY + bottomY) / 2;
    const midZ = (topZ + bottomZ) / 2;
    
    const direction = new THREE.Vector3(dx, dy, dz).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    
    const matrix = new THREE.Matrix4();
    matrix.compose(
      new THREE.Vector3(midX, midY, midZ),
      quaternion,
      new THREE.Vector3(1, 1, 1)
    );
    legGeom.applyMatrix4(matrix);
    geometries.push(legGeom);
    
    // 4. FOOT PADS with slight dome
    const footPadGeom = new THREE.CylinderGeometry(
      footPadRadius,
      footPadRadius * 1.1,
      footPadHeight,
      16
    );
    footPadGeom.translate(bottomX, footPadHeight / 2, bottomZ);
    geometries.push(footPadGeom);
  }
  
  return mergeGeometries(geometries);
}

// Generate pendant bracket with elegant cup socket
export function generatePendantCordGeometry(params: PendantParams): THREE.BufferGeometry {
  const socket = getSocketDimensions(params.rimSize);
  const canopyDiameter = 70 + params.rimSize * 0.3;
  const canopyHeight = 20;
  
  const geometries: THREE.BufferGeometry[] = [];
  const socketTop = params.height;
  const totalHeight = socketTop + params.cordLength + canopyHeight;
  
  // 1. CANOPY (ceiling mount) with smooth dome
  const canopyGeom = new THREE.SphereGeometry(
    canopyDiameter / 2,
    24,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  canopyGeom.scale(1, canopyHeight / (canopyDiameter / 2), 1);
  canopyGeom.translate(0, totalHeight - canopyHeight, 0);
  geometries.push(canopyGeom);
  
  // 2. CORD (thin rod)
  const cordGeom = new THREE.CylinderGeometry(3, 3, params.cordLength, 8);
  cordGeom.translate(0, totalHeight - canopyHeight - params.cordLength / 2, 0);
  geometries.push(cordGeom);
  
  // 3. TRANSITION PIECE (cord to socket)
  const transitionHeight = 20;
  const transitionGeom = new THREE.CylinderGeometry(
    socket.outerRadius * 0.9,
    6,
    transitionHeight,
    24
  );
  transitionGeom.translate(0, socketTop + socket.depth + transitionHeight / 2, 0);
  geometries.push(transitionGeom);
  
  // 4. CUP SOCKET (inverted for pendant - object hangs INTO it)
  const cupGeom = generateSmoothCupSocket(params.rimSize, socketTop);
  geometries.push(cupGeom);
  
  return mergeGeometries(geometries);
}

// Generate wall arm with elegant cup socket
export function generateWallArmGeometry(params: WallArmParams): THREE.BufferGeometry {
  const socket = getSocketDimensions(params.rimSize);
  const backplateWidth = 90;
  const backplateHeight = 120;
  const wallThickness = 6;
  const armThickness = 10 + params.rimSize * 0.04;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const geometries: THREE.BufferGeometry[] = [];
  
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight / 2 + params.armLength * Math.sin(armAngleRad);
  
  // 1. BACKPLATE with rounded edges
  const backplateGeom = new THREE.BoxGeometry(
    backplateWidth,
    backplateHeight,
    wallThickness
  );
  backplateGeom.translate(0, backplateHeight / 2, 0);
  geometries.push(backplateGeom);
  
  // 2. ARM (extends from backplate)
  const armGeom = new THREE.CylinderGeometry(
    armThickness / 2,
    armThickness / 2,
    params.armLength,
    16
  );
  armGeom.rotateX(Math.PI / 2 - armAngleRad);
  armGeom.translate(
    0,
    backplateHeight / 2 + params.armLength / 2 * Math.sin(armAngleRad),
    params.armLength / 2 * Math.cos(armAngleRad)
  );
  geometries.push(armGeom);
  
  // 3. TRANSITION from arm to socket
  const transitionHeight = socket.depth + 8;
  const transitionGeom = new THREE.CylinderGeometry(
    socket.outerRadius * 0.9,
    armThickness / 2,
    transitionHeight,
    24
  );
  transitionGeom.translate(0, armEndY + transitionHeight / 2, armEndZ);
  geometries.push(transitionGeom);
  
  // 4. CUP SOCKET at arm end
  const cupGeom = generateSmoothCupSocketAt(params.rimSize, armEndY, armEndZ);
  geometries.push(cupGeom);
  
  return mergeGeometries(geometries);
}

// Generate cup socket at specific position (for wall arm)
function generateSmoothCupSocketAt(rimSize: number, y: number, z: number): THREE.BufferGeometry {
  const socket = getSocketDimensions(rimSize);
  
  const points: THREE.Vector2[] = [];
  
  // Inner bottom
  points.push(new THREE.Vector2(0, -socket.depth));
  points.push(new THREE.Vector2(socket.innerRadius, -socket.depth));
  
  // Inner wall
  points.push(new THREE.Vector2(socket.innerRadius, -2));
  
  // Curved lip
  const lipCurveSteps = 8;
  for (let i = 0; i <= lipCurveSteps; i++) {
    const t = i / lipCurveSteps;
    const angle = t * Math.PI / 2;
    const curveRadius = socket.outerRadius - socket.innerRadius;
    const x = socket.innerRadius + Math.sin(angle) * curveRadius;
    const yPos = -2 + Math.cos(angle) * 2;
    points.push(new THREE.Vector2(x, yPos));
  }
  
  // Outer wall with taper
  points.push(new THREE.Vector2(socket.outerRadius, -socket.depth + 2));
  points.push(new THREE.Vector2(socket.outerRadius * 0.95, -socket.depth));
  points.push(new THREE.Vector2(0, -socket.depth));
  
  const geometry = new THREE.LatheGeometry(points, 48);
  geometry.translate(0, y, z);
  
  return geometry;
}

// Generate stand geometry based on StandParams
export function generateStandGeometry(params: MainStandParams): THREE.BufferGeometry {
  if (!params.enabled || params.type === 'none') {
    return new THREE.BufferGeometry();
  }
  
  switch (params.type) {
    case 'tripod':
      return generateTripodStandGeometry({
        rimSize: params.rimSize,
        height: params.height,
        legCount: params.legCount,
        legSpread: params.legSpread,
      });
    case 'pendant':
      return generatePendantCordGeometry({
        rimSize: params.rimSize,
        height: params.height,
        cordLength: params.cordLength,
      });
    case 'wall_arm':
      return generateWallArmGeometry({
        rimSize: params.rimSize,
        height: params.height,
        armLength: params.armLength,
        armAngle: params.armAngle,
      });
    default:
      return new THREE.BufferGeometry();
  }
}

// Get socket depth for positioning calculations
export function getSocketDepth(rimSize: number): number {
  return getSocketDimensions(rimSize).depth;
}

// Helper: Merge multiple geometries into one
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }
  
  let totalVertices = 0;
  let totalIndices = 0;
  
  for (const geom of geometries) {
    const pos = geom.getAttribute('position');
    if (pos) totalVertices += pos.count;
    const idx = geom.getIndex();
    if (idx) totalIndices += idx.count;
  }
  
  if (totalVertices === 0) {
    return new THREE.BufferGeometry();
  }
  
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