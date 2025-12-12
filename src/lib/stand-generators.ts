import * as THREE from 'three';
import { StandParams as MainStandParams, rimSpecs } from '@/types/parametric';

// ============================================
// STAND GENERATORS
// Generate 3D geometry for printable stands
// with universal rim socket system
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

// Socket dimensions derived from rim specs
const getSocketDimensions = (rimSize: number) => {
  const rimRadius = rimSize / 2;
  const socketWall = 4; // Wall thickness of socket
  const socketDepth = rimSpecs.socketDepth; // How deep the socket is
  const socketLip = 2; // Inner ledge for rim to rest on
  
  return {
    outerRadius: rimRadius + socketWall,
    innerRadius: rimRadius,
    lipRadius: rimRadius - rimSpecs.lipDepth - 1, // Slightly smaller than rim lip for snug fit
    depth: socketDepth,
    lipHeight: socketLip,
  };
};

// Generate rim socket geometry that the object's rim sits INTO
function generateRimSocket(rimSize: number, yPosition: number): THREE.BufferGeometry[] {
  const socket = getSocketDimensions(rimSize);
  const geometries: THREE.BufferGeometry[] = [];
  
  // Outer ring of socket
  const outerRingGeom = new THREE.TorusGeometry(
    (socket.outerRadius + socket.innerRadius) / 2,
    (socket.outerRadius - socket.innerRadius) / 2,
    8,
    48
  );
  const outerMatrix = new THREE.Matrix4().makeTranslation(0, yPosition, 0);
  outerMatrix.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  outerRingGeom.applyMatrix4(outerMatrix);
  geometries.push(outerRingGeom);
  
  // Inner ledge (where rim rests)
  const ledgeGeom = new THREE.CylinderGeometry(
    socket.innerRadius,
    socket.innerRadius,
    socket.lipHeight,
    32,
    1,
    true // Open-ended cylinder
  );
  ledgeGeom.translate(0, yPosition - socket.lipHeight / 2, 0);
  geometries.push(ledgeGeom);
  
  // Bottom lip ring (catches the rim's inward lip)
  const lipRingGeom = new THREE.TorusGeometry(
    socket.lipRadius,
    1.5,
    6,
    32
  );
  const lipMatrix = new THREE.Matrix4().makeTranslation(0, yPosition - socket.depth, 0);
  lipMatrix.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  lipRingGeom.applyMatrix4(lipMatrix);
  geometries.push(lipRingGeom);
  
  return geometries;
}

// Generate tripod stand geometry with proper rim socket
export function generateTripodStandGeometry(params: TripodParams): THREE.BufferGeometry {
  const legCount = params.legCount;
  const legAngleStep = (Math.PI * 2) / legCount;
  
  // Structural dimensions
  const legThickness = 8;
  const hubRadius = 25;
  const hubHeight = 35;
  const footPadRadius = 14;
  const footPadHeight = 5;
  
  // Calculate leg spread
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  
  // Hub position (socket at top)
  const socketTop = params.height;
  const hubTopY = socketTop - rimSpecs.socketDepth;
  const hubBottomY = hubTopY - hubHeight;
  
  // Leg bottom spread
  const legVerticalDrop = hubBottomY;
  const bottomSpreadRadius = hubRadius + legVerticalDrop * Math.tan(legSpreadRad);
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // 1. RIM SOCKET (where object sits INTO)
  const socketGeoms = generateRimSocket(params.rimSize, socketTop);
  geometries.push(...socketGeoms);
  
  // 2. CENTRAL HUB (structural support below socket)
  const hubGeom = new THREE.CylinderGeometry(
    hubRadius,
    hubRadius * 0.85,
    hubHeight,
    24
  );
  hubGeom.translate(0, hubTopY - hubHeight / 2, 0);
  geometries.push(hubGeom);
  
  // 3. SOCKET-TO-HUB SUPPORTS (connect socket rim to hub)
  const socket = getSocketDimensions(params.rimSize);
  const supportCount = legCount;
  for (let i = 0; i < supportCount; i++) {
    const angle = i * legAngleStep + legAngleStep / 2;
    const supportLength = socket.outerRadius - hubRadius;
    
    if (supportLength > 5) {
      const supportGeom = new THREE.CylinderGeometry(
        4,
        4,
        supportLength,
        6
      );
      
      supportGeom.rotateZ(Math.PI / 2);
      supportGeom.rotateY(angle);
      supportGeom.translate(
        Math.cos(angle) * (hubRadius + supportLength / 2),
        hubTopY,
        Math.sin(angle) * (hubRadius + supportLength / 2)
      );
      geometries.push(supportGeom);
    }
  }
  
  // 4. LEGS (spread outward from hub base to floor)
  for (let i = 0; i < legCount; i++) {
    const angle = i * legAngleStep;
    
    // Top of leg connects to hub base
    const topX = Math.cos(angle) * hubRadius * 0.85;
    const topY = hubBottomY;
    const topZ = Math.sin(angle) * hubRadius * 0.85;
    
    // Bottom of leg on the floor with spread
    const bottomX = Math.cos(angle) * bottomSpreadRadius;
    const bottomY = footPadHeight;
    const bottomZ = Math.sin(angle) * bottomSpreadRadius;
    
    // Calculate leg direction and length
    const dx = bottomX - topX;
    const dy = bottomY - topY;
    const dz = bottomZ - topZ;
    const legLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Create tapered leg
    const legGeom = new THREE.CylinderGeometry(
      legThickness / 2,
      legThickness / 2 * 1.4,
      legLength,
      8
    );
    
    // Calculate midpoint for positioning
    const midX = (topX + bottomX) / 2;
    const midY = (topY + bottomY) / 2;
    const midZ = (topZ + bottomZ) / 2;
    
    // Calculate rotation to align cylinder with leg direction
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
    
    // 5. FOOT PADS (flat for stability)
    const footPadGeom = new THREE.CylinderGeometry(
      footPadRadius,
      footPadRadius * 1.1,
      footPadHeight,
      12
    );
    footPadGeom.translate(bottomX, footPadHeight / 2, bottomZ);
    geometries.push(footPadGeom);
  }
  
  return mergeGeometries(geometries);
}

// Generate pendant bracket geometry with rim socket
export function generatePendantCordGeometry(params: PendantParams): THREE.BufferGeometry {
  const canopyDiameter = 80;
  const canopyHeight = 25;
  const socketHolderHeight = 40;
  const socketRadius = 20;
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // Socket position (bottom of bracket where object hangs)
  const socketTop = params.height - socketHolderHeight - 10;
  
  // 1. CANOPY (ceiling mount)
  const canopyGeom = new THREE.CylinderGeometry(
    canopyDiameter / 2,
    canopyDiameter / 2 * 0.9,
    canopyHeight,
    32
  );
  canopyGeom.translate(0, params.height + canopyHeight / 2, 0);
  geometries.push(canopyGeom);
  
  // 2. CORD/ROD (connects canopy to socket holder)
  const cordLength = params.height - socketTop + socketHolderHeight;
  const cordGeom = new THREE.CylinderGeometry(
    4,
    4,
    cordLength,
    8
  );
  cordGeom.translate(0, params.height - cordLength / 2, 0);
  geometries.push(cordGeom);
  
  // 3. SOCKET HOLDER (holds the rim socket)
  const holderGeom = new THREE.CylinderGeometry(
    socketRadius,
    socketRadius * 1.1,
    socketHolderHeight,
    24
  );
  holderGeom.translate(0, socketTop + socketHolderHeight / 2, 0);
  geometries.push(holderGeom);
  
  // 4. RIM SOCKET (where shade hangs INTO)
  const socketGeoms = generateRimSocket(params.rimSize, socketTop);
  geometries.push(...socketGeoms);
  
  // 5. SUPPORT STRUTS (socket holder to rim socket)
  const socket = getSocketDimensions(params.rimSize);
  const strutCount = 4;
  for (let i = 0; i < strutCount; i++) {
    const angle = (i / strutCount) * Math.PI * 2;
    const strutLength = socket.outerRadius - socketRadius;
    
    if (strutLength > 5) {
      const strutGeom = new THREE.CylinderGeometry(
        3,
        3,
        strutLength,
        6
      );
      
      strutGeom.rotateZ(Math.PI / 2);
      strutGeom.rotateY(angle);
      strutGeom.translate(
        Math.cos(angle) * (socketRadius + strutLength / 2),
        socketTop,
        Math.sin(angle) * (socketRadius + strutLength / 2)
      );
      geometries.push(strutGeom);
    }
  }
  
  return mergeGeometries(geometries);
}

// Generate wall arm geometry with rim socket
export function generateWallArmGeometry(params: WallArmParams): THREE.BufferGeometry {
  const backplateWidth = 100;
  const backplateHeight = 140;
  const wallThickness = 8;
  const armThickness = 12;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // Calculate arm end position
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight / 2 + params.armLength * Math.sin(armAngleRad);
  
  // Socket position at end of arm
  const socketTop = armEndY;
  
  // 1. BACKPLATE (wall mount)
  const backplateGeom = new THREE.BoxGeometry(
    backplateWidth,
    backplateHeight,
    wallThickness
  );
  backplateGeom.translate(0, backplateHeight / 2, 0);
  geometries.push(backplateGeom);
  
  // Mounting holes visual
  const holeSpacing = 60;
  for (const yOffset of [-holeSpacing / 2, holeSpacing / 2]) {
    const holeRingGeom = new THREE.TorusGeometry(6, 2, 6, 16);
    const holeMatrix = new THREE.Matrix4().makeTranslation(0, backplateHeight / 2 + yOffset, -wallThickness / 2);
    holeRingGeom.applyMatrix4(holeMatrix);
    geometries.push(holeRingGeom);
  }
  
  // 2. ARM (extends from backplate)
  const armGeom = new THREE.CylinderGeometry(
    armThickness / 2,
    armThickness / 2,
    params.armLength,
    12
  );
  
  armGeom.rotateX(Math.PI / 2 - armAngleRad);
  armGeom.translate(
    0,
    backplateHeight / 2 + params.armLength / 2 * Math.sin(armAngleRad),
    params.armLength / 2 * Math.cos(armAngleRad)
  );
  geometries.push(armGeom);
  
  // 3. SOCKET MOUNT (at end of arm)
  const mountGeom = new THREE.CylinderGeometry(
    20,
    20,
    30,
    24
  );
  mountGeom.translate(0, armEndY - 15, armEndZ);
  geometries.push(mountGeom);
  
  // 4. RIM SOCKET (where shade sits INTO)
  // Translate socket geometries to arm end position
  const socket = getSocketDimensions(params.rimSize);
  
  // Outer socket ring
  const outerRingGeom = new THREE.TorusGeometry(
    (socket.outerRadius + socket.innerRadius) / 2,
    (socket.outerRadius - socket.innerRadius) / 2,
    8,
    48
  );
  const outerMatrix = new THREE.Matrix4().makeTranslation(0, socketTop - 30, armEndZ);
  outerMatrix.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  outerRingGeom.applyMatrix4(outerMatrix);
  geometries.push(outerRingGeom);
  
  // Inner ledge
  const ledgeGeom = new THREE.CylinderGeometry(
    socket.innerRadius,
    socket.innerRadius,
    socket.lipHeight,
    32,
    1,
    true
  );
  ledgeGeom.translate(0, socketTop - 30 - socket.lipHeight / 2, armEndZ);
  geometries.push(ledgeGeom);
  
  // Bottom lip ring
  const lipRingGeom = new THREE.TorusGeometry(
    socket.lipRadius,
    1.5,
    6,
    32
  );
  const lipMatrix = new THREE.Matrix4().makeTranslation(0, socketTop - 30 - socket.depth, armEndZ);
  lipMatrix.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  lipRingGeom.applyMatrix4(lipMatrix);
  geometries.push(lipRingGeom);
  
  // 5. SUPPORT STRUTS
  const strutCount = 3;
  for (let i = 0; i < strutCount; i++) {
    const angle = (i / strutCount) * Math.PI * 2;
    const strutLength = socket.outerRadius - 15;
    
    if (strutLength > 5) {
      const strutGeom = new THREE.CylinderGeometry(
        3,
        3,
        strutLength,
        6
      );
      
      strutGeom.rotateZ(Math.PI / 2);
      strutGeom.rotateY(angle);
      strutGeom.translate(
        Math.cos(angle) * (15 + strutLength / 2),
        socketTop - 30,
        armEndZ + Math.sin(angle) * (15 + strutLength / 2)
      );
      geometries.push(strutGeom);
    }
  }
  
  return mergeGeometries(geometries);
}

// Generate stand geometry based on StandParams from parametric.ts
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
    
    // Copy positions
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
    
    // Copy indices with offset
    const idx = geom.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    }
    
    vertexOffset += pos.count;
  }
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (indices.length > 0) {
    merged.setIndex(indices);
  }
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  
  return merged;
}