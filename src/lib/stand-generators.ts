import * as THREE from 'three';
import { StandParams as MainStandParams, rimSpecs } from '@/types/parametric';

// ============================================
// STAND GENERATORS
// Generate 3D geometry for printable stands
// with universal rim socket cradle system
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

// Socket cradle dimensions - where the object's collar sits INTO
const getSocketDimensions = (rimSize: number) => {
  const collarRadius = rimSize / 2;
  const clearance = 0.5; // Small gap for fit
  const socketWall = 5;  // Wall thickness around socket
  const socketDepth = rimSpecs.height + 2; // Collar height + 2mm for clearance
  
  return {
    innerRadius: collarRadius + clearance,  // Collar fits inside this
    outerRadius: collarRadius + clearance + socketWall,
    depth: socketDepth,
    ledgeHeight: 2, // Flat surface collar rests on
  };
};

// Generate a simple socket cradle - a ring with a flat ledge
function generateSocketCradle(rimSize: number, topY: number): THREE.BufferGeometry[] {
  const socket = getSocketDimensions(rimSize);
  const geometries: THREE.BufferGeometry[] = [];
  
  // Outer wall of socket (cylinder)
  const outerWallGeom = new THREE.CylinderGeometry(
    socket.outerRadius,
    socket.outerRadius,
    socket.depth,
    48,
    1,
    true // Open-ended for the ring wall
  );
  outerWallGeom.translate(0, topY - socket.depth / 2, 0);
  geometries.push(outerWallGeom);
  
  // Top ring (flat surface at socket top)
  const topRingGeom = new THREE.RingGeometry(
    socket.innerRadius,
    socket.outerRadius,
    48
  );
  topRingGeom.rotateX(-Math.PI / 2);
  topRingGeom.translate(0, topY, 0);
  geometries.push(topRingGeom);
  
  // Bottom ledge (flat surface where collar rests)
  const ledgeGeom = new THREE.RingGeometry(
    socket.innerRadius - 3, // Ledge extends inward to support collar
    socket.innerRadius,
    48
  );
  ledgeGeom.rotateX(-Math.PI / 2);
  ledgeGeom.translate(0, topY - socket.depth + socket.ledgeHeight, 0);
  geometries.push(ledgeGeom);
  
  // Inner ledge support ring
  const ledgeSupportGeom = new THREE.CylinderGeometry(
    socket.innerRadius,
    socket.innerRadius - 3,
    socket.ledgeHeight,
    48,
    1,
    false
  );
  ledgeSupportGeom.translate(0, topY - socket.depth + socket.ledgeHeight / 2, 0);
  geometries.push(ledgeSupportGeom);
  
  return geometries;
}

// Generate tripod stand geometry with socket cradle
export function generateTripodStandGeometry(params: TripodParams): THREE.BufferGeometry {
  const legCount = params.legCount;
  const legAngleStep = (Math.PI * 2) / legCount;
  
  const socket = getSocketDimensions(params.rimSize);
  
  // Structural dimensions
  const legThickness = 8;
  const hubRadius = socket.outerRadius; // Hub matches socket outer radius
  const hubHeight = 25;
  const footPadRadius = 14;
  const footPadHeight = 5;
  
  // Calculate leg spread
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  
  // Socket at the very top
  const socketTop = params.height;
  const hubTopY = socketTop - socket.depth; // Hub starts right below socket
  const hubBottomY = hubTopY - hubHeight;
  
  // Leg bottom spread
  const legVerticalDrop = hubBottomY;
  const bottomSpreadRadius = hubRadius + legVerticalDrop * Math.tan(legSpreadRad);
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // 1. SOCKET CRADLE at top
  const socketGeoms = generateSocketCradle(params.rimSize, socketTop);
  geometries.push(...socketGeoms);
  
  // 2. CENTRAL HUB (solid cylinder connecting socket to legs)
  const hubGeom = new THREE.CylinderGeometry(
    hubRadius,
    hubRadius * 0.7,
    hubHeight,
    24
  );
  hubGeom.translate(0, hubTopY - hubHeight / 2, 0);
  geometries.push(hubGeom);
  
  // 3. LEGS (spread outward from hub base to floor)
  for (let i = 0; i < legCount; i++) {
    const angle = i * legAngleStep;
    
    // Top of leg connects to hub base
    const topX = Math.cos(angle) * hubRadius * 0.7;
    const topY = hubBottomY;
    const topZ = Math.sin(angle) * hubRadius * 0.7;
    
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
      legThickness / 3, // Tapered to a point
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
    
    // 4. FOOT PADS (flat for stability)
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

// Generate pendant bracket geometry with socket cradle
export function generatePendantCordGeometry(params: PendantParams): THREE.BufferGeometry {
  const canopyDiameter = 80;
  const canopyHeight = 25;
  
  const socket = getSocketDimensions(params.rimSize);
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // Socket at the bottom where lamp shade hangs
  const socketTop = params.height;
  
  // 1. CANOPY (ceiling mount)
  const totalHeight = socketTop + params.cordLength + canopyHeight;
  const canopyGeom = new THREE.CylinderGeometry(
    canopyDiameter / 2,
    canopyDiameter / 2 * 0.9,
    canopyHeight,
    32
  );
  canopyGeom.translate(0, totalHeight - canopyHeight / 2, 0);
  geometries.push(canopyGeom);
  
  // 2. CORD/ROD (connects canopy to socket)
  const cordLength = params.cordLength;
  const cordGeom = new THREE.CylinderGeometry(
    4,
    4,
    cordLength,
    8
  );
  cordGeom.translate(0, totalHeight - canopyHeight - cordLength / 2, 0);
  geometries.push(cordGeom);
  
  // 3. SOCKET HOLDER (connects cord to socket cradle)
  const holderHeight = 30;
  const holderGeom = new THREE.CylinderGeometry(
    socket.outerRadius,
    socket.outerRadius,
    holderHeight,
    24
  );
  holderGeom.translate(0, socketTop + holderHeight / 2, 0);
  geometries.push(holderGeom);
  
  // 4. SOCKET CRADLE (where shade hangs INTO)
  const socketGeoms = generateSocketCradle(params.rimSize, socketTop);
  geometries.push(...socketGeoms);
  
  return mergeGeometries(geometries);
}

// Generate wall arm geometry with socket cradle
export function generateWallArmGeometry(params: WallArmParams): THREE.BufferGeometry {
  const backplateWidth = 100;
  const backplateHeight = 140;
  const wallThickness = 8;
  const armThickness = 12;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const socket = getSocketDimensions(params.rimSize);
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // Calculate arm end position
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight / 2 + params.armLength * Math.sin(armAngleRad);
  
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
  
  // 3. SOCKET MOUNT (at end of arm, connects to socket cradle)
  const mountHeight = socket.depth + 10;
  const mountGeom = new THREE.CylinderGeometry(
    socket.outerRadius,
    socket.outerRadius * 0.8,
    mountHeight,
    24
  );
  mountGeom.translate(0, armEndY + mountHeight / 2, armEndZ);
  geometries.push(mountGeom);
  
  // 4. SOCKET CRADLE (where shade sits INTO) - positioned at arm end
  const socketGeoms = generateSocketCradleAt(params.rimSize, armEndY, armEndZ);
  geometries.push(...socketGeoms);
  
  return mergeGeometries(geometries);
}

// Generate socket cradle at a specific position (for wall arm)
function generateSocketCradleAt(rimSize: number, y: number, z: number): THREE.BufferGeometry[] {
  const socket = getSocketDimensions(rimSize);
  const geometries: THREE.BufferGeometry[] = [];
  
  // Outer wall of socket
  const outerWallGeom = new THREE.CylinderGeometry(
    socket.outerRadius,
    socket.outerRadius,
    socket.depth,
    48,
    1,
    true
  );
  outerWallGeom.translate(0, y - socket.depth / 2, z);
  geometries.push(outerWallGeom);
  
  // Top ring
  const topRingGeom = new THREE.RingGeometry(
    socket.innerRadius,
    socket.outerRadius,
    48
  );
  topRingGeom.rotateX(-Math.PI / 2);
  topRingGeom.translate(0, y, z);
  geometries.push(topRingGeom);
  
  // Bottom ledge
  const ledgeGeom = new THREE.RingGeometry(
    socket.innerRadius - 3,
    socket.innerRadius,
    48
  );
  ledgeGeom.rotateX(-Math.PI / 2);
  ledgeGeom.translate(0, y - socket.depth + socket.ledgeHeight, z);
  geometries.push(ledgeGeom);
  
  // Inner ledge support
  const ledgeSupportGeom = new THREE.CylinderGeometry(
    socket.innerRadius,
    socket.innerRadius - 3,
    socket.ledgeHeight,
    48,
    1,
    false
  );
  ledgeSupportGeom.translate(0, y - socket.depth + socket.ledgeHeight / 2, z);
  geometries.push(ledgeSupportGeom);
  
  return geometries;
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
    } else {
      // Generate indices for non-indexed geometry
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