/**
 * Spindle Geometry Generation
 * 
 * Creates the central spindle hole that goes through all modules
 */

import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { SPINDLE_SPECS, SpindleSize } from '@/types/totem';

/**
 * Create a cylinder geometry for the spindle hole
 * This is used to subtract from module geometries
 */
export function createSpindleHoleGeometry(
  spindleSize: SpindleSize,
  height: number,
  extraClearance: number = 0
): THREE.CylinderGeometry {
  const spec = SPINDLE_SPECS[spindleSize];
  const radius = (spec.holeDiameter + extraClearance) / 2;
  
  // Create cylinder along Y axis
  // Add small extra height to ensure clean boolean operations
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height + 2, // Extra height for clean cuts
    32          // Segments for smooth hole
  );
  
  return geometry;
}

/**
 * Subtract spindle hole from a module geometry using CSG
 * 
 * @param moduleGeometry - The module geometry to modify
 * @param spindleSize - Size of spindle hole
 * @param moduleHeight - Height of the module
 * @param holeType - 'through' for full hole, 'blind' for socket (partial depth)
 * @param blindDepth - Depth of blind hole (only used if holeType is 'blind')
 * @returns New geometry with spindle hole
 */
export function subtractSpindleHole(
  moduleGeometry: THREE.BufferGeometry,
  spindleSize: SpindleSize,
  moduleHeight: number,
  holeType: 'through' | 'blind' = 'through',
  blindDepth: number = 20
): THREE.BufferGeometry {
  const evaluator = new Evaluator();
  
  // Create the module brush
  const moduleBrush = new Brush(moduleGeometry);
  moduleBrush.updateMatrixWorld();
  
  // Create spindle hole geometry
  const holeHeight = holeType === 'through' ? moduleHeight : blindDepth;
  const holeGeometry = createSpindleHoleGeometry(spindleSize, holeHeight);
  
  // Position the hole
  if (holeType === 'through') {
    // Center the hole vertically in the module
    holeGeometry.translate(0, moduleHeight / 2, 0);
  } else {
    // Blind hole from top, going down blindDepth
    holeGeometry.translate(0, moduleHeight - blindDepth / 2, 0);
  }
  
  const holeBrush = new Brush(holeGeometry);
  holeBrush.updateMatrixWorld();
  
  // Perform subtraction
  const result = evaluator.evaluate(moduleBrush, holeBrush, SUBTRACTION);
  
  // Extract geometry from result
  const resultGeometry = result.geometry.clone();
  resultGeometry.computeVertexNormals();
  
  return resultGeometry;
}

/**
 * Create a visual representation of the spindle (ghost spindle)
 * Used for preview in the stack viewer
 * 
 * NOTE: This geometry is centered at origin - caller must position it
 */
export function createSpindlePreviewGeometry(
  spindleSize: SpindleSize,
  length: number
): THREE.BufferGeometry {
  const spec = SPINDLE_SPECS[spindleSize];
  const radius = spec.diameter / 2;
  
  // Create the spindle as a cylinder centered at origin
  // The caller (SpindleMesh) will position it appropriately
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    length,
    16
  );
  
  // Do NOT translate here - let the component handle positioning
  // This prevents double-translation issues
  
  return geometry;
}

/**
 * Calculate the Y position for a module in a stack
 * Modules stack from bottom up
 */
export function calculateModuleYPosition(
  moduleIndex: number,
  moduleHeights: number[]
): number {
  let y = 0;
  for (let i = moduleHeights.length - 1; i > moduleIndex; i--) {
    y += moduleHeights[i];
  }
  return y;
}
