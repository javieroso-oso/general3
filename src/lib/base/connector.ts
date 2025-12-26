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
 * Creates a ring that friction-fits into the body bottom
 */
function generatePressFitConnector(
  config: ConnectorConfig,
  outerDiameter: number
): ConnectorGeometry {
  const tolerance = config.tolerance || 0.3;
  const insertDepth = config.insertDepth || 5;
  const wallThickness = 2; // mm
  
  const outerRadius = outerDiameter / 2 - tolerance;
  const innerRadius = outerRadius - wallThickness;
  
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Create a ring that goes up into the body
  // Bottom (at y=0)
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * innerRadius, 0, Math.sin(theta) * innerRadius);
  }
  
  const bottomOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * outerRadius, 0, Math.sin(theta) * outerRadius);
  }
  
  // Top (at y=insertDepth)
  const topInnerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * innerRadius, insertDepth, Math.sin(theta) * innerRadius);
  }
  
  const topOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * outerRadius, insertDepth, Math.sin(theta) * outerRadius);
  }
  
  // Build faces
  for (let i = 0; i < segments; i++) {
    // Bottom face
    indices.push(i, bottomOuterStart + i + 1, bottomOuterStart + i);
    indices.push(i, i + 1, bottomOuterStart + i + 1);
    
    // Inner wall
    indices.push(i, topInnerStart + i, i + 1);
    indices.push(i + 1, topInnerStart + i, topInnerStart + i + 1);
    
    // Outer wall
    indices.push(bottomOuterStart + i, bottomOuterStart + i + 1, topOuterStart + i);
    indices.push(topOuterStart + i, bottomOuterStart + i + 1, topOuterStart + i + 1);
    
    // Top face
    indices.push(topInnerStart + i, topOuterStart + i, topInnerStart + i + 1);
    indices.push(topInnerStart + i + 1, topOuterStart + i, topOuterStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return { 
    bodyInterface: null, // Press-fit collar is part of base
    baseInterface: geometry 
  };
}

/**
 * Generate screw mount holes
 */
function generateScrewConnector(
  config: ConnectorConfig,
  outerDiameter: number
): ConnectorGeometry {
  const screwType = config.type === 'screw-m3' ? 'm3' : 'm4';
  const specs = SCREW_SPECS[screwType];
  const screwCount = config.screwCount || 3;
  
  const holeRadius = outerDiameter / 2 * 0.7; // Holes at 70% of radius
  const geometries: THREE.BufferGeometry[] = [];
  
  // Create visual indicators for screw holes
  for (let i = 0; i < screwCount; i++) {
    const angle = (i / screwCount) * Math.PI * 2;
    const x = Math.cos(angle) * holeRadius;
    const z = Math.sin(angle) * holeRadius;
    
    // Screw hole cylinder
    const holeGeo = new THREE.CylinderGeometry(
      specs.clearanceHole / 2,
      specs.clearanceHole / 2,
      10, // Through hole
      16
    );
    holeGeo.translate(x, -5, z);
    geometries.push(holeGeo);
  }
  
  const screwHoles = mergeGeometries(geometries);
  
  return {
    bodyInterface: null,
    baseInterface: null,
    screwHoles,
  };
}

/**
 * Generate bayonet twist-lock
 */
function generateBayonetConnector(
  config: ConnectorConfig,
  outerDiameter: number
): ConnectorGeometry {
  // Bayonet tabs on body, slots on base
  const tabRadius = outerDiameter / 2 - 2;
  const tabCount = 3;
  
  const tabGeometries: THREE.BufferGeometry[] = [];
  
  for (let i = 0; i < tabCount; i++) {
    const angle = (i / tabCount) * Math.PI * 2;
    
    // Create a tab (box)
    const tabGeo = new THREE.BoxGeometry(
      BAYONET_SPECS.tabWidth,
      BAYONET_SPECS.tabHeight,
      BAYONET_SPECS.tabDepth
    );
    
    // Position at radius
    tabGeo.translate(
      Math.cos(angle) * tabRadius,
      -BAYONET_SPECS.tabHeight / 2,
      Math.sin(angle) * tabRadius
    );
    
    // Rotate to face outward
    const rotMatrix = new THREE.Matrix4().makeRotationY(-angle);
    tabGeo.applyMatrix4(rotMatrix);
    
    tabGeometries.push(tabGeo);
  }
  
  return {
    bodyInterface: mergeGeometries(tabGeometries),
    baseInterface: null, // Slots would be CSG subtraction
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
