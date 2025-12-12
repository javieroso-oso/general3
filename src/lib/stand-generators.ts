import * as THREE from 'three';
import { StandParams as MainStandParams } from '@/types/parametric';

// ============================================
// STAND GENERATORS
// Generate 3D geometry for printable stands
// ============================================

interface TripodParams {
  rimDiameter: number;
  height: number;
  legCount: 3 | 4;
  legSpread: number;
}

interface PendantParams {
  rimDiameter: number;
  height: number;
  cordLength: number;
}

interface WallArmParams {
  rimDiameter: number;
  height: number;
  armLength: number;
  armAngle: number;
}

// Generate tripod stand geometry (table/floor lamp)
export function generateTripodStandGeometry(params: TripodParams): THREE.BufferGeometry {
  const rimRadius = params.rimDiameter / 2;
  const legCount = params.legCount;
  const legAngleStep = (Math.PI * 2) / legCount;
  
  // Structural dimensions
  const wallThickness = 4;
  const legThickness = 8;
  const hubRadius = 20;
  const hubHeight = 40;
  const footPadRadius = 12;
  const footPadHeight = 4;
  
  // Calculate leg spread - convert degrees to radians
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  
  // Hub sits at top, legs spread down from hub base to floor
  const hubTopY = params.height;
  const hubBottomY = params.height - hubHeight;
  
  // Calculate where legs touch the ground based on legSpread angle
  // Bottom radius = hubRadius + (distance from hub to ground) * tan(spread angle)
  const legVerticalDrop = hubBottomY; // from hubBottom to y=0
  const bottomSpreadRadius = hubRadius + legVerticalDrop * Math.tan(legSpreadRad);
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // 1. RIM RING (where object rests) - at the very top
  const rimRingGeom = new THREE.TorusGeometry(
    rimRadius - wallThickness / 2,
    wallThickness / 2,
    8,
    48
  );
  const rimMatrix = new THREE.Matrix4().makeTranslation(0, hubTopY, 0);
  rimMatrix.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  rimRingGeom.applyMatrix4(rimMatrix);
  geometries.push(rimRingGeom);
  
  // 2. CENTRAL HUB (socket holder at top)
  const hubGeom = new THREE.CylinderGeometry(
    hubRadius,
    hubRadius * 0.9,
    hubHeight,
    24
  );
  hubGeom.translate(0, hubTopY - hubHeight / 2, 0);
  geometries.push(hubGeom);
  
  // 3. VERTICAL SUPPORT STRUTS (rim ring to hub)
  const strutCount = legCount;
  for (let i = 0; i < strutCount; i++) {
    const angle = i * legAngleStep + legAngleStep / 2;
    const strutRadius = (rimRadius + hubRadius) / 2 * 0.7;
    
    const strutGeom = new THREE.CylinderGeometry(
      wallThickness / 2,
      wallThickness / 2,
      hubHeight * 0.3,
      6
    );
    strutGeom.translate(
      Math.cos(angle) * strutRadius,
      hubTopY - hubHeight * 0.15,
      Math.sin(angle) * strutRadius
    );
    geometries.push(strutGeom);
  }
  
  // 4. HORIZONTAL RIM SUPPORTS (hub to rim ring)
  for (let i = 0; i < strutCount; i++) {
    const angle = i * legAngleStep + legAngleStep / 2;
    const supportLength = rimRadius - hubRadius;
    
    const supportGeom = new THREE.CylinderGeometry(
      wallThickness / 2,
      wallThickness / 2,
      supportLength,
      6
    );
    
    // Rotate to horizontal
    supportGeom.rotateZ(Math.PI / 2);
    supportGeom.rotateY(angle);
    supportGeom.translate(
      Math.cos(angle) * (hubRadius + supportLength / 2),
      hubTopY - 2,
      Math.sin(angle) * (hubRadius + supportLength / 2)
    );
    geometries.push(supportGeom);
  }
  
  // 5. LEGS (spread outward from hub base to floor)
  for (let i = 0; i < legCount; i++) {
    const angle = i * legAngleStep;
    
    // Top of leg connects to hub base
    const topX = Math.cos(angle) * hubRadius * 0.9;
    const topY = hubBottomY;
    const topZ = Math.sin(angle) * hubRadius * 0.9;
    
    // Bottom of leg on the floor with spread
    const bottomX = Math.cos(angle) * bottomSpreadRadius;
    const bottomY = 0;
    const bottomZ = Math.sin(angle) * bottomSpreadRadius;
    
    // Calculate leg direction and length
    const dx = bottomX - topX;
    const dy = bottomY - topY;
    const dz = bottomZ - topZ;
    const legLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Create tapered leg (thicker at bottom for stability)
    const legGeom = new THREE.CylinderGeometry(
      legThickness / 2,      // top radius (at hub)
      legThickness / 2 * 1.3, // bottom radius (at floor)
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
    
    // 6. FOOT PADS (flat cylinders at leg bottoms for stability)
    const footPadGeom = new THREE.CylinderGeometry(
      footPadRadius,
      footPadRadius,
      footPadHeight,
      12
    );
    footPadGeom.translate(bottomX, footPadHeight / 2, bottomZ);
    geometries.push(footPadGeom);
  }
  
  return mergeGeometries(geometries);
}

// Generate pendant cord stand geometry
export function generatePendantCordGeometry(params: PendantParams): THREE.BufferGeometry {
  const rimRadius = params.rimDiameter / 2;
  const wallThickness = 4;
  const canopyDiameter = 80;
  const canopyHeight = 25;
  const socketHolderHeight = 50;
  const socketRadius = 18;
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // 1. CANOPY (ceiling mount)
  const canopyGeom = new THREE.CylinderGeometry(
    canopyDiameter / 2,
    canopyDiameter / 2 * 0.9,
    canopyHeight,
    32
  );
  canopyGeom.translate(0, params.height + canopyHeight / 2, 0);
  geometries.push(canopyGeom);
  
  // 2. SOCKET HOLDER (hanging below canopy)
  const holderGeom = new THREE.CylinderGeometry(
    socketRadius,
    socketRadius * 1.1,
    socketHolderHeight,
    24
  );
  holderGeom.translate(0, params.height - socketHolderHeight / 2, 0);
  geometries.push(holderGeom);
  
  // 3. RIM RING (where shade hangs)
  const rimRingGeom = new THREE.TorusGeometry(
    rimRadius - wallThickness / 2,
    wallThickness,
    8,
    48
  );
  const rimMatrix = new THREE.Matrix4().makeTranslation(0, params.height - socketHolderHeight - 5, 0);
  rimMatrix.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  rimRingGeom.applyMatrix4(rimMatrix);
  geometries.push(rimRingGeom);
  
  // 4. SUPPORT STRUTS (socket holder to rim)
  const strutCount = 3;
  for (let i = 0; i < strutCount; i++) {
    const angle = (i / strutCount) * Math.PI * 2;
    const strutLength = rimRadius * 0.6;
    
    const strutGeom = new THREE.CylinderGeometry(
      wallThickness / 2,
      wallThickness / 2,
      strutLength,
      6
    );
    
    strutGeom.rotateZ(Math.PI / 2);
    strutGeom.rotateY(angle);
    strutGeom.translate(
      Math.cos(angle) * rimRadius * 0.35,
      params.height - socketHolderHeight - 5,
      Math.sin(angle) * rimRadius * 0.35
    );
    geometries.push(strutGeom);
  }
  
  return mergeGeometries(geometries);
}

// Generate wall arm stand geometry
export function generateWallArmGeometry(params: WallArmParams): THREE.BufferGeometry {
  const rimRadius = params.rimDiameter / 2;
  const wallThickness = 4;
  const backplateWidth = 100;
  const backplateHeight = 140;
  const socketHolderHeight = 50;
  const socketRadius = 18;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // 1. BACKPLATE (wall mount)
  const backplateGeom = new THREE.BoxGeometry(
    backplateWidth,
    backplateHeight,
    wallThickness * 2
  );
  backplateGeom.translate(0, backplateHeight / 2, 0);
  geometries.push(backplateGeom);
  
  // 2. ARM (extends from backplate)
  const armGeom = new THREE.CylinderGeometry(
    wallThickness * 1.5,
    wallThickness * 1.5,
    params.armLength,
    12
  );
  
  // Position arm extending outward at angle
  armGeom.rotateX(Math.PI / 2 - armAngleRad);
  armGeom.translate(
    0,
    backplateHeight / 2,
    params.armLength / 2 * Math.cos(armAngleRad)
  );
  geometries.push(armGeom);
  
  // 3. SOCKET HOLDER (at end of arm)
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight / 2 + params.armLength * Math.sin(armAngleRad);
  
  const holderGeom = new THREE.CylinderGeometry(
    socketRadius,
    socketRadius,
    socketHolderHeight,
    24
  );
  holderGeom.translate(0, armEndY - socketHolderHeight / 2, armEndZ);
  geometries.push(holderGeom);
  
  // 4. RIM RING (where shade rests)
  const rimRingGeom = new THREE.TorusGeometry(
    rimRadius - wallThickness / 2,
    wallThickness,
    8,
    48
  );
  const rimMatrix = new THREE.Matrix4().makeTranslation(0, armEndY - socketHolderHeight - 5, armEndZ);
  rimMatrix.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  rimRingGeom.applyMatrix4(rimMatrix);
  geometries.push(rimRingGeom);
  
  // 5. RIM SUPPORTS
  const supportCount = 3;
  for (let i = 0; i < supportCount; i++) {
    const angle = (i / supportCount) * Math.PI * 2;
    const supportLength = rimRadius * 0.5;
    
    const supportGeom = new THREE.CylinderGeometry(
      wallThickness / 2,
      wallThickness / 2,
      supportLength,
      6
    );
    
    supportGeom.rotateZ(Math.PI / 2);
    supportGeom.rotateY(angle);
    supportGeom.translate(
      Math.cos(angle) * rimRadius * 0.3,
      armEndY - socketHolderHeight - 5,
      armEndZ + Math.sin(angle) * rimRadius * 0.3
    );
    geometries.push(supportGeom);
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
        rimDiameter: params.rimDiameter,
        height: params.height,
        legCount: params.legCount,
        legSpread: params.legSpread,
      });
    case 'pendant':
      return generatePendantCordGeometry({
        rimDiameter: params.rimDiameter,
        height: params.height,
        cordLength: params.cordLength,
      });
    case 'wall_arm':
      return generateWallArmGeometry({
        rimDiameter: params.rimDiameter,
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
