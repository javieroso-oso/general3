import * as THREE from 'three';
import { 
  ConstrainedStandParams, 
  ShadeGeometry,
  calculateStandDimensions,
  columnThicknessValues,
  footSpreadAngles,
  WIRE_CHANNEL_DIAMETER,
  ParametricStandParams,
  socketCradleSpecs,
} from '@/types/stand';

// ============================================
// CONSTRAINED STAND GENERATORS
// All stands prioritize stability and manufacturability
// ============================================

const SCALE = 0.01; // mm to scene units

// ============================================
// SOCKET CONNECTOR (shared across all stands)
// ============================================
function generateSocketConnector(
  connectorDiameter: number,
  centerY: number
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const innerRadius = (connectorDiameter / 2) * SCALE;
  const wallThickness = 3 * SCALE;
  const outerRadius = innerRadius + wallThickness;
  const depth = 6 * SCALE;
  
  // Ring connector
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  
  const ring = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  ring.rotateX(-Math.PI / 2);
  ring.translate(0, centerY, 0);
  geometries.push(ring);
  
  return mergeGeometries(geometries);
}

// ============================================
// WIRE CHANNEL (hidden internal)
// ============================================
function generateWireChannel(
  startY: number,
  endY: number,
  centerX: number = 0,
  centerZ: number = 0
): THREE.BufferGeometry {
  const radius = (WIRE_CHANNEL_DIAMETER / 2) * SCALE;
  const height = Math.abs(endY - startY);
  
  const channel = new THREE.CylinderGeometry(radius, radius, height, 16);
  channel.translate(centerX, (startY + endY) / 2, centerZ);
  
  return channel;
}

// ============================================
// 1. COLUMN STAND (Akari-style)
// Minimal vertical column - disappears visually
// ============================================
function generateColumnStand(
  params: ConstrainedStandParams,
  shade: ShadeGeometry
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const dims = calculateStandDimensions(shade, params);
  
  const standHeight = params.overallHeight * SCALE;
  const baseDiameter = dims.baseDiameter * SCALE;
  const baseThickness = dims.baseThickness * SCALE;
  const columnDiameter = dims.columnDiameter * SCALE;
  const connectorDiameter = dims.connectorDiameter;
  
  // 1. Solid circular base (stable, flat bottom for printing)
  const baseGeom = new THREE.CylinderGeometry(
    baseDiameter / 2,
    baseDiameter / 2,
    baseThickness,
    32
  );
  baseGeom.translate(0, baseThickness / 2, 0);
  geometries.push(baseGeom);
  
  // 2. Straight column (no taper, no curves - just functional)
  const columnHeight = standHeight - baseThickness;
  const columnGeom = new THREE.CylinderGeometry(
    columnDiameter / 2,
    columnDiameter / 2,
    columnHeight,
    24
  );
  columnGeom.translate(0, baseThickness + columnHeight / 2, 0);
  geometries.push(columnGeom);
  
  // 3. Socket connector at top
  geometries.push(generateSocketConnector(connectorDiameter, standHeight));
  
  // 4. Wire channel (internal, not visible in final print)
  if (params.showWire) {
    geometries.push(generateWireChannel(0, standHeight));
  }
  
  return mergeGeometries(geometries);
}

// ============================================
// 2. DISC BASE + ROD (Wooj-style)
// Graphic base disc with thin vertical rod
// ============================================
function generateDiscBaseStand(
  params: ConstrainedStandParams,
  shade: ShadeGeometry
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const dims = calculateStandDimensions(shade, params);
  
  const standHeight = params.overallHeight * SCALE;
  const baseDiameter = dims.baseDiameter * SCALE;
  const baseThickness = dims.baseThickness * SCALE;
  const rodDiameter = params.rodThickness * SCALE;
  const connectorDiameter = dims.connectorDiameter;
  
  // 1. Heavy disc base (weighted for stability)
  const discGeom = new THREE.CylinderGeometry(
    baseDiameter / 2,
    baseDiameter / 2,
    baseThickness,
    48
  );
  discGeom.translate(0, baseThickness / 2, 0);
  geometries.push(discGeom);
  
  // 2. Thin centered rod
  const rodHeight = standHeight - baseThickness;
  const rodGeom = new THREE.CylinderGeometry(
    rodDiameter / 2,
    rodDiameter / 2,
    rodHeight,
    16
  );
  rodGeom.translate(0, baseThickness + rodHeight / 2, 0);
  geometries.push(rodGeom);
  
  // 3. Small transition disc at top (rod to connector)
  const transitionDiameter = rodDiameter * 2;
  const transitionGeom = new THREE.CylinderGeometry(
    transitionDiameter / 2,
    rodDiameter / 2,
    8 * SCALE,
    16
  );
  transitionGeom.translate(0, standHeight - 4 * SCALE, 0);
  geometries.push(transitionGeom);
  
  // 4. Socket connector at top
  geometries.push(generateSocketConnector(connectorDiameter, standHeight));
  
  return mergeGeometries(geometries);
}

// ============================================
// 3. TRIPOD STAND
// Three identical legs, central hub
// Fixed angles 15-25°, all legs identical
// ============================================
function generateTripodStand(
  params: ConstrainedStandParams,
  shade: ShadeGeometry
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const dims = calculateStandDimensions(shade, params);
  
  const standHeight = params.overallHeight * SCALE;
  const legAngle = dims.legAngle;
  const legThickness = params.legThickness * SCALE;
  const connectorDiameter = dims.connectorDiameter;
  
  // Central hub at top
  const hubRadius = connectorDiameter / 2 * SCALE + 5 * SCALE;
  const hubHeight = 12 * SCALE;
  const hubGeom = new THREE.CylinderGeometry(hubRadius, hubRadius * 0.8, hubHeight, 24);
  hubGeom.translate(0, standHeight - hubHeight / 2, 0);
  geometries.push(hubGeom);
  
  // Socket connector at top
  geometries.push(generateSocketConnector(connectorDiameter, standHeight));
  
  // 3 identical legs
  const legCount = 3;
  const legAngleRad = (legAngle * Math.PI) / 180;
  
  for (let i = 0; i < legCount; i++) {
    const rotationAngle = (i / legCount) * Math.PI * 2;
    
    // Leg start at hub edge
    const startRadius = hubRadius * 0.9;
    const startY = standHeight - hubHeight;
    const startX = Math.cos(rotationAngle) * startRadius;
    const startZ = Math.sin(rotationAngle) * startRadius;
    
    // Leg end at ground (spread outward)
    const footSpread = startRadius + startY * Math.tan(legAngleRad);
    const endX = Math.cos(rotationAngle) * footSpread;
    const endZ = Math.sin(rotationAngle) * footSpread;
    
    // Create leg as tube
    const path = new THREE.LineCurve3(
      new THREE.Vector3(startX, startY, startZ),
      new THREE.Vector3(endX, 0, endZ)
    );
    
    const legGeom = new THREE.TubeGeometry(path, 8, legThickness / 2, 12, false);
    geometries.push(legGeom);
    
    // Foot pad (small sphere at base)
    const footGeom = new THREE.SphereGeometry(legThickness * 0.8, 12, 8);
    footGeom.translate(endX, legThickness * 0.3, endZ);
    geometries.push(footGeom);
  }
  
  // Central wire channel
  if (params.showWire) {
    geometries.push(generateWireChannel(0, standHeight));
  }
  
  return mergeGeometries(geometries);
}

// ============================================
// 4. PENDANT (Ceiling mounted)
// No stand - just canopy and cable
// ============================================
function generatePendantStand(
  params: ConstrainedStandParams,
  shade: ShadeGeometry
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const dims = calculateStandDimensions(shade, params);
  
  const cableLength = params.cableLength * SCALE;
  const cableRadius = dims.cableRadius * SCALE;
  const canopyMultiplier = { small: 0.6, medium: 0.8, large: 1.0 }[params.canopySize];
  const canopyDiameter = shade.maxDiameter * 0.4 * canopyMultiplier * SCALE;
  const connectorDiameter = dims.connectorDiameter;
  
  // Position: canopy at top, shade connector at bottom
  const canopyY = cableLength + 20 * SCALE;
  const connectorY = 0;
  
  // 1. Ceiling canopy (dome)
  const canopyGeom = new THREE.SphereGeometry(
    canopyDiameter / 2,
    24, 12,
    0, Math.PI * 2,
    0, Math.PI / 2
  );
  canopyGeom.scale(1, 0.35, 1);
  canopyGeom.translate(0, canopyY, 0);
  geometries.push(canopyGeom);
  
  // 2. Cable (centered, always)
  const cableGeom = new THREE.CylinderGeometry(
    cableRadius,
    cableRadius,
    cableLength,
    12
  );
  cableGeom.translate(0, canopyY - cableLength / 2, 0);
  geometries.push(cableGeom);
  
  // 3. Strain relief at cable end
  const reliefGeom = new THREE.CylinderGeometry(
    cableRadius * 2,
    cableRadius * 1.5,
    10 * SCALE,
    12
  );
  reliefGeom.translate(0, connectorY + 10 * SCALE, 0);
  geometries.push(reliefGeom);
  
  // 4. Socket connector at bottom
  geometries.push(generateSocketConnector(connectorDiameter, connectorY));
  
  return mergeGeometries(geometries);
}

// ============================================
// MAIN GENERATOR (NEW API)
// ============================================
export function generateConstrainedStandGeometry(
  params: ConstrainedStandParams,
  shade: ShadeGeometry
): THREE.BufferGeometry {
  if (!params.enabled) {
    return new THREE.BufferGeometry();
  }
  
  switch (params.archetype) {
    case 'column':
      return generateColumnStand(params, shade);
    case 'disc_base':
      return generateDiscBaseStand(params, shade);
    case 'tripod':
      return generateTripodStand(params, shade);
    case 'pendant':
      return generatePendantStand(params, shade);
    default:
      return new THREE.BufferGeometry();
  }
}

// ============================================
// LEGACY API (for backward compatibility)
// ============================================
export function generateParametricStandGeometry(params: ParametricStandParams): THREE.BufferGeometry {
  if (!params.enabled) {
    return new THREE.BufferGeometry();
  }
  
  // Convert legacy params to new format
  const archetypeMap: Record<string, 'column' | 'disc_base' | 'tripod' | 'pendant'> = {
    'tripod': 'tripod',
    'ribbed_pedestal': 'column',
    'pendant': 'pendant',
    'wall_plate': 'disc_base',
    'flat_back': 'disc_base',
    'column': 'column',
    'disc_base': 'disc_base',
  };
  
  const newParams: ConstrainedStandParams = {
    enabled: params.enabled,
    archetype: archetypeMap[params.mountType] || 'disc_base',
    overallHeight: params.height,
    baseSize: 'medium',
    columnThickness: 'standard',
    rodThickness: 10,
    footSpread: 'medium',
    legThickness: params.legThickness,
    cableLength: params.cordLength,
    canopySize: 'medium',
    socketType: params.socketType,
    bulbShape: params.bulbShape,
    bulbWattage: params.bulbWattage,
    showHardwarePreview: params.showHardwarePreview,
    showHeatZone: params.showHeatZone,
    showWire: false,
  };
  
  const shade: ShadeGeometry = {
    maxDiameter: params.socketSize * 2.5,
    height: params.height,
    rimSize: params.socketSize,
  };
  
  return generateConstrainedStandGeometry(newParams, shade);
}

export function getSocketCradleDepth(params: ParametricStandParams): number {
  return params.socketCradleDepth || 5;
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
