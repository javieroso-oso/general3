/**
 * Socket Mount Generator
 * 
 * Generates ONLY the socket mount geometry - the part that holds the light source.
 * This includes:
 * - Centering lip for traditional bulb sockets (E26, E12, E14, GU10)
 * - Recess for LED pucks
 * - Cord channel for wiring
 */

import * as THREE from 'three';
import { SocketMountConfig, SOCKET_THREAD_DIAMETERS, BulbSocketType } from './types';

/**
 * Generate socket mount geometry
 * 
 * @param config Socket mount configuration
 * @param baseRadius The radius of the base disc this mounts to
 * @param baseY The Y position of the base surface (usually 0)
 * @returns Object containing the main geometry and optional cord hole geometry
 */
export function generateSocketMount(
  config: SocketMountConfig,
  baseRadius: number,
  baseY: number = 0
): { 
  geometry: THREE.BufferGeometry; 
  cordHoleGeometry: THREE.BufferGeometry | null;
} {
  switch (config.type) {
    case 'press-fit-ring':
      return generatePressFitRing(config, baseRadius, baseY);
    case 'led-puck':
      return generateLedPuckMount(config, baseRadius, baseY);
    case 'led-strip':
      return generateLedStripChannel(config, baseRadius, baseY);
    default:
      return generatePressFitRing(config, baseRadius, baseY);
  }
}

/**
 * Generate a centering lip for traditional bulb sockets
 * The lip creates a snug fit around the threaded portion of the socket
 */
function generatePressFitRing(
  config: SocketMountConfig,
  baseRadius: number,
  baseY: number
): { geometry: THREE.BufferGeometry; cordHoleGeometry: THREE.BufferGeometry | null } {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const socketType = config.socketType || 'E26';
  const threadDiameter = SOCKET_THREAD_DIAMETERS[socketType];
  const clearance = config.clearance ?? 0.5;
  const lipHeight = config.lipHeight ?? 3;
  const lipWallThickness = 2; // mm
  
  // Lip dimensions
  const lipInnerRadius = threadDiameter / 2 + clearance;
  const lipOuterRadius = lipInnerRadius + lipWallThickness;
  
  // Cord hole
  const cordHoleEnabled = config.cordHoleEnabled ?? false;
  const cordHoleDiameter = config.cordHoleDiameter ?? 8;
  const cordHoleRadius = cordHoleDiameter / 2;
  
  // Build the centering lip as a ring
  // Bottom inner edge
  const bottomInnerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(theta) * lipInnerRadius,
      baseY,
      Math.sin(theta) * lipInnerRadius
    );
  }
  
  // Bottom outer edge
  const bottomOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(theta) * lipOuterRadius,
      baseY,
      Math.sin(theta) * lipOuterRadius
    );
  }
  
  // Top inner edge
  const topInnerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(theta) * lipInnerRadius,
      baseY + lipHeight,
      Math.sin(theta) * lipInnerRadius
    );
  }
  
  // Top outer edge  
  const topOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(theta) * lipOuterRadius,
      baseY + lipHeight,
      Math.sin(theta) * lipOuterRadius
    );
  }
  
  // Build faces
  for (let i = 0; i < segments; i++) {
    // Bottom face (ring)
    indices.push(bottomInnerStart + i, bottomOuterStart + i + 1, bottomOuterStart + i);
    indices.push(bottomInnerStart + i, bottomInnerStart + i + 1, bottomOuterStart + i + 1);
    
    // Inner wall
    indices.push(bottomInnerStart + i, topInnerStart + i, bottomInnerStart + i + 1);
    indices.push(bottomInnerStart + i + 1, topInnerStart + i, topInnerStart + i + 1);
    
    // Outer wall
    indices.push(bottomOuterStart + i, bottomOuterStart + i + 1, topOuterStart + i);
    indices.push(topOuterStart + i, bottomOuterStart + i + 1, topOuterStart + i + 1);
    
    // Top face (ring)
    indices.push(topInnerStart + i, topOuterStart + i, topInnerStart + i + 1);
    indices.push(topInnerStart + i + 1, topOuterStart + i, topOuterStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  // Create cord hole geometry if enabled
  let cordHoleGeometry: THREE.BufferGeometry | null = null;
  if (cordHoleEnabled && cordHoleRadius < lipInnerRadius) {
    // Create a cylinder for the cord hole (for visual indication)
    cordHoleGeometry = new THREE.CylinderGeometry(
      cordHoleRadius, 
      cordHoleRadius, 
      lipHeight + 2, 
      32
    );
    cordHoleGeometry.translate(0, baseY + lipHeight / 2, 0);
  }
  
  return { geometry, cordHoleGeometry };
}

/**
 * Generate a recess for USB LED pucks
 */
function generateLedPuckMount(
  config: SocketMountConfig,
  baseRadius: number,
  baseY: number
): { geometry: THREE.BufferGeometry; cordHoleGeometry: THREE.BufferGeometry | null } {
  const segments = 64;
  
  const puckDiameter = config.puckDiameter ?? 50;
  const puckDepth = config.puckDepth ?? 10;
  const puckRadius = puckDiameter / 2;
  const wallThickness = 2;
  
  // Create a ring that sits around where the puck will go
  // The recess is cut into the base disc (handled in base generation)
  
  const innerRadius = puckRadius + 0.5; // Small clearance
  const outerRadius = innerRadius + wallThickness;
  const rimHeight = 2; // Small lip to keep puck in place
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Bottom inner
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * innerRadius, baseY, Math.sin(theta) * innerRadius);
  }
  
  // Bottom outer
  const bottomOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * outerRadius, baseY, Math.sin(theta) * outerRadius);
  }
  
  // Top inner
  const topInnerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * innerRadius, baseY + rimHeight, Math.sin(theta) * innerRadius);
  }
  
  // Top outer
  const topOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(theta) * outerRadius, baseY + rimHeight, Math.sin(theta) * outerRadius);
  }
  
  // Build faces
  for (let i = 0; i < segments; i++) {
    // Inner wall (inverted normals - facing inward)
    indices.push(i, i + 1, topInnerStart + i);
    indices.push(topInnerStart + i, i + 1, topInnerStart + i + 1);
    
    // Outer wall
    indices.push(bottomOuterStart + i, topOuterStart + i, bottomOuterStart + i + 1);
    indices.push(bottomOuterStart + i + 1, topOuterStart + i, topOuterStart + i + 1);
    
    // Top face
    indices.push(topInnerStart + i, topInnerStart + i + 1, topOuterStart + i);
    indices.push(topOuterStart + i, topInnerStart + i + 1, topOuterStart + i + 1);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return { geometry, cordHoleGeometry: null };
}

/**
 * Generate a spiral channel for LED strip
 */
function generateLedStripChannel(
  config: SocketMountConfig,
  baseRadius: number,
  baseY: number
): { geometry: THREE.BufferGeometry; cordHoleGeometry: THREE.BufferGeometry | null } {
  // LED strip channel is more complex - for now return empty geometry
  // This would create a spiral groove inside the body for LED strip
  const geometry = new THREE.BufferGeometry();
  return { geometry, cordHoleGeometry: null };
}

/**
 * Get the outer radius of the socket mount for layout calculations
 */
export function getSocketMountRadius(config: SocketMountConfig): number {
  if (config.type === 'press-fit-ring') {
    const socketType = config.socketType || 'E26';
    const threadDiameter = SOCKET_THREAD_DIAMETERS[socketType];
    const clearance = config.clearance ?? 0.5;
    const lipWall = 2;
    return threadDiameter / 2 + clearance + lipWall;
  } else if (config.type === 'led-puck') {
    return (config.puckDiameter ?? 50) / 2 + 2.5;
  }
  return 15; // Default
}
