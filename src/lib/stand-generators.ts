import * as THREE from 'three';
import {
  StandParams,
  TripodStandParams,
  PendantCordParams,
  WallArmParams,
  getSocketHolderDimensions,
} from '@/types/lamp';

// ============================================
// AKARI-INSPIRED STAND GENERATORS
// Generate 3D geometry for printable stands
// ============================================

// Generate tripod stand geometry (table/floor lamp)
export function generateTripodStandGeometry(params: TripodStandParams): THREE.BufferGeometry {
  const group = new THREE.Group();
  
  const socketHolder = getSocketHolderDimensions(params.socketType);
  const rimRadius = params.rimDiameter / 2;
  const legAngleStep = (Math.PI * 2) / params.legCount;
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  
  // ============================================
  // 1. RIM RING (where shade rests)
  // ============================================
  const rimRingGeom = new THREE.TorusGeometry(
    rimRadius - params.wallThickness / 2,
    params.wallThickness / 2,
    8,
    48
  );
  const rimRing = new THREE.Mesh(rimRingGeom);
  rimRing.position.y = params.height;
  rimRing.rotation.x = Math.PI / 2;
  group.add(rimRing);
  
  // ============================================
  // 2. CENTRAL SOCKET HOLDER (column)
  // ============================================
  const holderOuterRadius = socketHolder.outerDiameter / 2;
  const holderInnerRadius = socketHolder.innerDiameter / 2;
  const holderHeight = params.socketHolderHeight;
  
  // Outer cylinder
  const holderOuter = new THREE.CylinderGeometry(
    holderOuterRadius,
    holderOuterRadius,
    holderHeight,
    24
  );
  const holderMesh = new THREE.Mesh(holderOuter);
  holderMesh.position.y = params.height - holderHeight / 2;
  group.add(holderMesh);
  
  // Inner hole (socket cavity) - will be subtracted in final mesh
  // For now, we'll create a hollow version using lathe
  
  // ============================================
  // 3. LEGS (spread outward from socket holder base)
  // ============================================
  const legLength = params.height - holderHeight + 20;
  const legGeom = new THREE.CylinderGeometry(
    params.legThickness / 2,
    params.legThickness / 2 * 1.2, // Slightly wider at base
    legLength,
    8
  );
  
  for (let i = 0; i < params.legCount; i++) {
    const angle = i * legAngleStep;
    const leg = new THREE.Mesh(legGeom);
    
    // Position at base of socket holder
    const topX = Math.cos(angle) * holderOuterRadius;
    const topZ = Math.sin(angle) * holderOuterRadius;
    
    // Calculate bottom position based on spread
    const bottomRadius = rimRadius * 1.1; // Legs extend beyond rim
    const bottomX = Math.cos(angle) * bottomRadius;
    const bottomZ = Math.sin(angle) * bottomRadius;
    
    // Position and rotate leg
    leg.position.set(
      (topX + bottomX) / 2,
      legLength / 2 - 10,
      (topZ + bottomZ) / 2
    );
    
    // Calculate rotation to connect top and bottom points
    const dx = bottomX - topX;
    const dy = -(params.height - holderHeight);
    const dz = bottomZ - topZ;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const tiltAngle = Math.atan2(horizontalDist, -dy);
    
    leg.rotation.x = tiltAngle;
    leg.rotation.y = -angle;
    
    group.add(leg);
  }
  
  // ============================================
  // 4. RIM SUPPORTS (connect legs to rim)
  // ============================================
  const supportGeom = new THREE.CylinderGeometry(
    params.wallThickness / 2,
    params.wallThickness / 2,
    rimRadius * 0.8,
    6
  );
  
  for (let i = 0; i < params.legCount; i++) {
    const angle = i * legAngleStep + legAngleStep / 2;
    const support = new THREE.Mesh(supportGeom);
    
    // Horizontal support from socket holder to rim
    support.rotation.z = Math.PI / 2;
    support.rotation.y = angle;
    support.position.set(
      Math.cos(angle) * rimRadius * 0.5,
      params.height - 5,
      Math.sin(angle) * rimRadius * 0.5
    );
    
    group.add(support);
  }
  
  // Merge all geometries
  const mergedGeometry = mergeGroupToGeometry(group);
  return mergedGeometry;
}

// Generate pendant cord stand geometry
export function generatePendantCordGeometry(params: PendantCordParams): THREE.BufferGeometry {
  const group = new THREE.Group();
  
  const socketHolder = getSocketHolderDimensions(params.socketType);
  const rimRadius = params.rimDiameter / 2;
  
  // ============================================
  // 1. CANOPY (ceiling mount)
  // ============================================
  const canopyGeom = new THREE.CylinderGeometry(
    params.canopyDiameter / 2,
    params.canopyDiameter / 2 * 0.9,
    params.canopyHeight,
    32
  );
  const canopy = new THREE.Mesh(canopyGeom);
  canopy.position.y = params.height + params.canopyHeight / 2;
  group.add(canopy);
  
  // ============================================
  // 2. SOCKET HOLDER (hanging below canopy)
  // ============================================
  const holderHeight = socketHolder.height;
  const holderRadius = socketHolder.outerDiameter / 2;
  
  const holderGeom = new THREE.CylinderGeometry(
    holderRadius,
    holderRadius * 1.1,
    holderHeight,
    24
  );
  const holder = new THREE.Mesh(holderGeom);
  holder.position.y = params.height - holderHeight / 2;
  group.add(holder);
  
  // ============================================
  // 3. RIM RING (where shade hangs)
  // ============================================
  const rimRingGeom = new THREE.TorusGeometry(
    rimRadius - params.wallThickness / 2,
    params.wallThickness,
    8,
    48
  );
  const rimRing = new THREE.Mesh(rimRingGeom);
  rimRing.position.y = params.height - holderHeight - 5;
  rimRing.rotation.x = Math.PI / 2;
  group.add(rimRing);
  
  // ============================================
  // 4. SUPPORT STRUTS (socket holder to rim)
  // ============================================
  const strutCount = 3;
  const strutGeom = new THREE.CylinderGeometry(
    params.wallThickness / 2,
    params.wallThickness / 2,
    rimRadius * 0.7,
    6
  );
  
  for (let i = 0; i < strutCount; i++) {
    const angle = (i / strutCount) * Math.PI * 2;
    const strut = new THREE.Mesh(strutGeom);
    
    strut.rotation.z = Math.PI / 2;
    strut.rotation.y = angle;
    strut.position.set(
      Math.cos(angle) * rimRadius * 0.4,
      params.height - holderHeight - 5,
      Math.sin(angle) * rimRadius * 0.4
    );
    
    group.add(strut);
  }
  
  // Merge all geometries
  const mergedGeometry = mergeGroupToGeometry(group);
  return mergedGeometry;
}

// Generate wall arm stand geometry
export function generateWallArmGeometry(params: WallArmParams): THREE.BufferGeometry {
  const group = new THREE.Group();
  
  const socketHolder = getSocketHolderDimensions(params.socketType);
  const rimRadius = params.rimDiameter / 2;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  // ============================================
  // 1. BACKPLATE (wall mount)
  // ============================================
  const backplateGeom = new THREE.BoxGeometry(
    params.backplateWidth,
    params.backplateHeight,
    params.wallThickness * 2
  );
  const backplate = new THREE.Mesh(backplateGeom);
  backplate.position.set(0, params.backplateHeight / 2, 0);
  group.add(backplate);
  
  // ============================================
  // 2. ARM (extends from backplate)
  // ============================================
  const armGeom = new THREE.CylinderGeometry(
    params.wallThickness * 1.5,
    params.wallThickness * 1.5,
    params.armLength,
    12
  );
  const arm = new THREE.Mesh(armGeom);
  
  // Position arm extending outward at angle
  arm.rotation.x = Math.PI / 2 - armAngleRad;
  arm.position.set(
    0,
    params.backplateHeight / 2,
    params.armLength / 2 * Math.cos(armAngleRad)
  );
  group.add(arm);
  
  // ============================================
  // 3. SOCKET HOLDER (at end of arm)
  // ============================================
  const holderHeight = socketHolder.height;
  const holderRadius = socketHolder.outerDiameter / 2;
  
  const holderGeom = new THREE.CylinderGeometry(
    holderRadius,
    holderRadius,
    holderHeight,
    24
  );
  const holder = new THREE.Mesh(holderGeom);
  
  // Position at end of arm
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = params.backplateHeight / 2 + params.armLength * Math.sin(armAngleRad);
  holder.position.set(0, armEndY - holderHeight / 2, armEndZ);
  group.add(holder);
  
  // ============================================
  // 4. RIM RING (where shade rests)
  // ============================================
  const rimRingGeom = new THREE.TorusGeometry(
    rimRadius - params.wallThickness / 2,
    params.wallThickness,
    8,
    48
  );
  const rimRing = new THREE.Mesh(rimRingGeom);
  rimRing.position.set(0, armEndY - holderHeight - 5, armEndZ);
  rimRing.rotation.x = Math.PI / 2;
  group.add(rimRing);
  
  // ============================================
  // 5. RIM SUPPORTS
  // ============================================
  const supportCount = 3;
  const supportGeom = new THREE.CylinderGeometry(
    params.wallThickness / 2,
    params.wallThickness / 2,
    rimRadius * 0.6,
    6
  );
  
  for (let i = 0; i < supportCount; i++) {
    const angle = (i / supportCount) * Math.PI * 2;
    const support = new THREE.Mesh(supportGeom);
    
    support.rotation.z = Math.PI / 2;
    support.rotation.y = angle;
    support.position.set(
      Math.cos(angle) * rimRadius * 0.35,
      armEndY - holderHeight - 5,
      armEndZ + Math.sin(angle) * rimRadius * 0.35
    );
    
    group.add(support);
  }
  
  // Merge all geometries
  const mergedGeometry = mergeGroupToGeometry(group);
  return mergedGeometry;
}

// Generate stand geometry based on type
export function generateStandGeometry(params: StandParams): THREE.BufferGeometry {
  switch (params.type) {
    case 'tripod':
      return generateTripodStandGeometry(params);
    case 'pendant_cord':
      return generatePendantCordGeometry(params);
    case 'wall_arm':
      return generateWallArmGeometry(params);
  }
}

// Helper: Merge THREE.Group into single BufferGeometry
function mergeGroupToGeometry(group: THREE.Group): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geom = child.geometry.clone();
      child.updateMatrix();
      geom.applyMatrix4(child.matrix);
      geometries.push(geom);
    }
  });
  
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }
  
  // Merge using BufferGeometryUtils-like approach
  const merged = mergeBufferGeometries(geometries);
  return merged;
}

// Simple buffer geometry merge (since we can't use BufferGeometryUtils directly)
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVertices = 0;
  let totalIndices = 0;
  
  for (const geom of geometries) {
    const pos = geom.getAttribute('position');
    if (pos) totalVertices += pos.count;
    const idx = geom.getIndex();
    if (idx) totalIndices += idx.count;
  }
  
  const positions = new Float32Array(totalVertices * 3);
  const indices: number[] = [];
  
  let vertexOffset = 0;
  let indexOffset = 0;
  
  for (const geom of geometries) {
    const pos = geom.getAttribute('position');
    if (!pos) continue;
    
    // Copy positions
    for (let i = 0; i < pos.count; i++) {
      positions[(vertexOffset + i) * 3] = pos.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = pos.getZ(i);
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
  if (indices.length > 0) {
    merged.setIndex(indices);
  }
  merged.computeVertexNormals();
  
  return merged;
}
