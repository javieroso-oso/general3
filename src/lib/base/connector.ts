/**
 * Connector Generator
 * 
 * Generates the connection interface between body and base:
 * - Integrated: One-piece (no separate geometry needed)
 * - Press-fit: Friction-fit collar
 * - Threaded insert: For threaded hardware
 * - Screw mounts: Screw holes and nut recesses
 * - Bayonet: Twist-lock mechanism
 */

import * as THREE from 'three';
import { ConnectorConfig, SCREW_SPECS, BAYONET_SPECS } from './types';

export interface ConnectorGeometry {
  bodyInterface: THREE.BufferGeometry | null;  // Goes inside bottom of body
  baseInterface: THREE.BufferGeometry | null;  // Goes on top of base
  screwHoles?: THREE.BufferGeometry;           // Screw clearance holes
}

/**
 * Generate connector geometry
 * 
 * @param config Connector configuration
 * @param outerDiameter The outer diameter to match (body inner diameter at base)
 * @returns Connector geometries for body and base
 */
export function generateConnector(
  config: ConnectorConfig,
  outerDiameter: number
): ConnectorGeometry {
  switch (config.type) {
    case 'integrated':
      return { bodyInterface: null, baseInterface: null };
    
    case 'press-fit':
      return generatePressFitConnector(config, outerDiameter);
    
    case 'screw-m3':
    case 'screw-m4':
      return generateScrewConnector(config, outerDiameter);
    
    case 'bayonet':
      return generateBayonetConnector(config, outerDiameter);
    
    default:
      return { bodyInterface: null, baseInterface: null };
  }
}

/**
 * Generate press-fit collar
 * Creates a visible ring that sits between body and base as a connector
 * The collar extends DOWNWARD from y=0 (body bottom) to connect with the stand
 */
function generatePressFitConnector(
  config: ConnectorConfig,
  outerDiameter: number
): ConnectorGeometry {
  const tolerance = config.tolerance || 0.3;
  const insertDepth = config.insertDepth || 5;
  const collarHeight = 8; // mm - visible collar height
  const wallThickness = 3; // mm
  
  const outerRadius = outerDiameter / 2 + 2; // Slightly wider than body for visibility
  const innerRadius = outerDiameter / 2 - wallThickness;
  
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Create a collar that sits below y=0 (between body and stand)
  // Top of collar at y=0, bottom at y=-collarHeight
  
  // Top inner ring (at y=0)
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
  
  // Bottom inner ring (at y=-collarHeight)
  const botInnerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * innerRadius, -collarHeight, Math.sin(theta) * innerRadius);
  }
  
  // Bottom outer ring
  const botOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * outerRadius, -collarHeight, Math.sin(theta) * outerRadius);
  }
  
  // Build faces
  for (let i = 0; i < segments; i++) {
    // Top face (ring)
    indices.push(i, topOuterStart + i, i + 1);
    indices.push(i + 1, topOuterStart + i, topOuterStart + i + 1);
    
    // Bottom face (ring)
    indices.push(botInnerStart + i, botInnerStart + i + 1, botOuterStart + i);
    indices.push(botOuterStart + i, botInnerStart + i + 1, botOuterStart + i + 1);
    
    // Inner wall
    indices.push(i, i + 1, botInnerStart + i);
    indices.push(botInnerStart + i, i + 1, botInnerStart + i + 1);
    
    // Outer wall
    indices.push(topOuterStart + i, botOuterStart + i, topOuterStart + i + 1);
    indices.push(topOuterStart + i + 1, botOuterStart + i, botOuterStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return { 
    bodyInterface: null,
    baseInterface: geometry  // This is the visible collar
  };
}

/**
 * Generate screw mount connector
 * Creates a visible flange/collar with screw boss positions
 */
function generateScrewConnector(
  config: ConnectorConfig,
  outerDiameter: number
): ConnectorGeometry {
  const screwType = config.type === 'screw-m3' ? 'm3' : 'm4';
  const specs = SCREW_SPECS[screwType];
  const screwCount = config.screwCount || 3;
  const collarHeight = 6; // mm
  
  const geometries: THREE.BufferGeometry[] = [];
  const innerRadius = outerDiameter / 2 - 3;
  const outerRadius = outerDiameter / 2 + 4; // Flange extends outward
  const segments = 64;
  
  // Create collar/flange
  const collarVerts: number[] = [];
  const collarIdx: number[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    collarVerts.push(Math.cos(theta) * innerRadius, 0, Math.sin(theta) * innerRadius);
  }
  const topOuterStart = collarVerts.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    collarVerts.push(Math.cos(theta) * outerRadius, 0, Math.sin(theta) * outerRadius);
  }
  const botInnerStart = collarVerts.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    collarVerts.push(Math.cos(theta) * innerRadius, -collarHeight, Math.sin(theta) * innerRadius);
  }
  const botOuterStart = collarVerts.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    collarVerts.push(Math.cos(theta) * outerRadius, -collarHeight, Math.sin(theta) * outerRadius);
  }
  
  for (let i = 0; i < segments; i++) {
    collarIdx.push(i, topOuterStart + i, i + 1);
    collarIdx.push(i + 1, topOuterStart + i, topOuterStart + i + 1);
    collarIdx.push(botInnerStart + i, botInnerStart + i + 1, botOuterStart + i);
    collarIdx.push(botOuterStart + i, botInnerStart + i + 1, botOuterStart + i + 1);
    collarIdx.push(i, i + 1, botInnerStart + i);
    collarIdx.push(botInnerStart + i, i + 1, botInnerStart + i + 1);
    collarIdx.push(topOuterStart + i, botOuterStart + i, topOuterStart + i + 1);
    collarIdx.push(topOuterStart + i + 1, botOuterStart + i, botOuterStart + i + 1);
  }
  
  const collarGeo = new THREE.BufferGeometry();
  collarGeo.setAttribute('position', new THREE.Float32BufferAttribute(collarVerts, 3));
  collarGeo.setIndex(collarIdx);
  collarGeo.computeVertexNormals();
  geometries.push(collarGeo);
  
  // Add screw boss cylinders at flange edge
  const bossRadius = specs.headDiameter / 2 + 2;
  const bossHeight = collarHeight;
  const bossDistance = (outerRadius + innerRadius) / 2;
  
  for (let i = 0; i < screwCount; i++) {
    const angle = (i / screwCount) * Math.PI * 2;
    const x = Math.cos(angle) * bossDistance;
    const z = Math.sin(angle) * bossDistance;
    
    // Screw boss (raised cylinder)
    const bossGeo = new THREE.CylinderGeometry(bossRadius, bossRadius, bossHeight, 16);
    bossGeo.translate(x, -bossHeight / 2, z);
    geometries.push(bossGeo);
  }
  
  return {
    bodyInterface: null,
    baseInterface: mergeGeometries(geometries),
    screwHoles: undefined,
  };
}

/**
 * Generate bayonet twist-lock
 * Creates visible tabs that extend from the collar between body and base
 */
function generateBayonetConnector(
  config: ConnectorConfig,
  outerDiameter: number
): ConnectorGeometry {
  const tabRadius = outerDiameter / 2 + 2; // Slightly wider for visibility
  const tabCount = config.screwCount || 3;
  const collarHeight = 10; // mm
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // First create a base collar (ring)
  const segments = 64;
  const collarVerts: number[] = [];
  const collarIdx: number[] = [];
  const innerRadius = outerDiameter / 2 - 3;
  const outerRadius = tabRadius;
  
  // Create collar at y=-collarHeight/2 to y=0
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    collarVerts.push(Math.cos(theta) * innerRadius, 0, Math.sin(theta) * innerRadius);
  }
  const topOuterStart = collarVerts.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    collarVerts.push(Math.cos(theta) * outerRadius, 0, Math.sin(theta) * outerRadius);
  }
  const botInnerStart = collarVerts.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    collarVerts.push(Math.cos(theta) * innerRadius, -collarHeight, Math.sin(theta) * innerRadius);
  }
  const botOuterStart = collarVerts.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    collarVerts.push(Math.cos(theta) * outerRadius, -collarHeight, Math.sin(theta) * outerRadius);
  }
  
  for (let i = 0; i < segments; i++) {
    collarIdx.push(i, topOuterStart + i, i + 1);
    collarIdx.push(i + 1, topOuterStart + i, topOuterStart + i + 1);
    collarIdx.push(botInnerStart + i, botInnerStart + i + 1, botOuterStart + i);
    collarIdx.push(botOuterStart + i, botInnerStart + i + 1, botOuterStart + i + 1);
    collarIdx.push(i, i + 1, botInnerStart + i);
    collarIdx.push(botInnerStart + i, i + 1, botInnerStart + i + 1);
    collarIdx.push(topOuterStart + i, botOuterStart + i, topOuterStart + i + 1);
    collarIdx.push(topOuterStart + i + 1, botOuterStart + i, botOuterStart + i + 1);
  }
  
  const collarGeo = new THREE.BufferGeometry();
  collarGeo.setAttribute('position', new THREE.Float32BufferAttribute(collarVerts, 3));
  collarGeo.setIndex(collarIdx);
  collarGeo.computeVertexNormals();
  geometries.push(collarGeo);
  
  // Add tabs extending outward
  for (let i = 0; i < tabCount; i++) {
    const angle = (i / tabCount) * Math.PI * 2;
    
    const tabGeo = new THREE.BoxGeometry(
      BAYONET_SPECS.tabWidth,
      BAYONET_SPECS.tabHeight,
      BAYONET_SPECS.tabDepth
    );
    
    // Position tabs at mid-height of collar, extending outward
    tabGeo.translate(
      Math.cos(angle) * (tabRadius + BAYONET_SPECS.tabDepth / 2),
      -collarHeight / 2,
      Math.sin(angle) * (tabRadius + BAYONET_SPECS.tabDepth / 2)
    );
    
    // Rotate to face outward
    const rotMatrix = new THREE.Matrix4().makeRotationY(-angle);
    tabGeo.applyMatrix4(rotMatrix);
    
    geometries.push(tabGeo);
  }
  
  return {
    bodyInterface: null,
    baseInterface: mergeGeometries(geometries),
  };
}

/**
 * Merge geometries helper
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) return new THREE.BufferGeometry();
  if (geometries.length === 1) return geometries[0];
  
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
