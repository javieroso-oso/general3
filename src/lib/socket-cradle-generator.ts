import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SocketType, socketDimensions } from '@/types/lamp';

/**
 * Socket Cradle Generator
 * 
 * Creates a simple, printable socket holder with radial arms that rests on
 * the shade rim. Designed to be printed flat without supports.
 * 
 * Design Philosophy:
 * - Uses gravity and geometry, not friction fits or snap-fits
 * - Arms span the rim diameter and rest on top
 * - Central cylinder holds the socket
 * - Prints flat for maximum strength
 */

export interface SocketCradleParams {
  rimDiameter: number;        // mm - outer span of arms (matches shade rim)
  socketType: SocketType;
  armCount: 3 | 4;
  armWidth: number;           // mm - width of each arm
  armThickness: number;       // mm - height/thickness of arms
  cordHoleDiameter: number;   // mm
  holderWallThickness: number; // mm - thickness of socket holder walls
  holderDepth: number;        // mm - how deep the socket sits
}

export const defaultSocketCradleParams: SocketCradleParams = {
  rimDiameter: 120,
  socketType: 'E26',
  armCount: 3,
  armWidth: 8,
  armThickness: 4,
  cordHoleDiameter: 8,
  holderWallThickness: 3,
  holderDepth: 35,
};

/**
 * Get socket cradle params auto-sized to a shade's base radius
 */
export function getSocketCradleParamsForShade(
  baseRadius: number,
  socketType: SocketType = 'E26'
): SocketCradleParams {
  const socket = socketDimensions[socketType];
  
  return {
    rimDiameter: baseRadius * 2,  // Arms span the full diameter
    socketType,
    armCount: 3,
    armWidth: Math.max(6, Math.min(12, baseRadius * 0.15)), // Scale with shade size
    armThickness: 4,
    cordHoleDiameter: 8,
    holderWallThickness: 3,
    holderDepth: socket.height + 5, // Socket height + extra for cord
  };
}

/**
 * Generate the socket cradle geometry
 * 
 * Structure:
 * 1. Central socket holder cylinder (with cord hole at bottom)
 * 2. Radial arms extending to rim diameter
 * 
 * Orientation: Arms at Y=0 (print bed), holder extends downward (-Y)
 */
export function generateSocketCradle(
  params: SocketCradleParams
): THREE.BufferGeometry {
  const {
    rimDiameter,
    socketType,
    armCount,
    armWidth,
    armThickness,
    cordHoleDiameter,
    holderWallThickness,
    holderDepth,
  } = params;

  const socket = socketDimensions[socketType];
  const holderOuterRadius = (socket.outerDiameter / 2) + holderWallThickness;
  const holderInnerRadius = socket.outerDiameter / 2 + 0.5; // Slight clearance
  const armLength = rimDiameter / 2;
  const segments = 32;

  const geometries: THREE.BufferGeometry[] = [];

  // 1. Create central socket holder (hollow cylinder)
  // Outer cylinder
  const outerCylinder = new THREE.CylinderGeometry(
    holderOuterRadius,
    holderOuterRadius,
    holderDepth,
    segments,
    1,
    false
  );
  outerCylinder.translate(0, -holderDepth / 2, 0);
  geometries.push(outerCylinder);

  // Holder bottom (ring with cord hole)
  const bottomRing = createRing(
    cordHoleDiameter / 2,
    holderOuterRadius,
    armThickness,
    segments
  );
  bottomRing.translate(0, -holderDepth + armThickness / 2, 0);
  geometries.push(bottomRing);

  // Inner cylinder (negative space - we'll create the inner wall)
  // Actually for STL export, we need solid geometry, so create inner surface
  const innerWall = new THREE.CylinderGeometry(
    holderInnerRadius,
    holderInnerRadius,
    holderDepth - armThickness,
    segments,
    1,
    true // Open-ended
  );
  innerWall.translate(0, -(holderDepth - armThickness) / 2, 0);
  // Flip normals for inner surface
  flipNormals(innerWall);
  geometries.push(innerWall);

  // Top ring (connects outer to inner at top)
  const topRing = createRing(
    holderInnerRadius,
    holderOuterRadius,
    armThickness,
    segments
  );
  topRing.translate(0, armThickness / 2, 0);
  geometries.push(topRing);

  // 2. Create radial arms
  for (let i = 0; i < armCount; i++) {
    const angle = (i / armCount) * Math.PI * 2;
    
    // Arm is a box from holder edge to rim edge
    const armGeom = new THREE.BoxGeometry(
      armLength - holderOuterRadius + armWidth / 2, // Length from holder to rim
      armThickness,
      armWidth
    );
    
    // Position arm
    const armCenterDist = holderOuterRadius + (armLength - holderOuterRadius) / 2;
    armGeom.translate(armCenterDist, armThickness / 2, 0);
    
    // Rotate around Y axis
    armGeom.rotateY(angle);
    
    geometries.push(armGeom);
    
    // Add rounded end at rim (optional, for aesthetics)
    const endCap = new THREE.CylinderGeometry(
      armWidth / 2,
      armWidth / 2,
      armThickness,
      16,
      1,
      false
    );
    endCap.rotateX(Math.PI / 2);
    endCap.rotateY(Math.PI / 2);
    endCap.translate(
      Math.cos(angle) * armLength,
      armThickness / 2,
      Math.sin(angle) * armLength
    );
    geometries.push(endCap);
  }

  // Merge all geometries
  const merged = mergeGeometries(geometries, false);
  if (!merged) {
    throw new Error('Failed to merge socket cradle geometries');
  }

  // Clean up
  geometries.forEach(g => g.dispose());

  // Rotate for STL export (Y-up to Z-up)
  merged.rotateX(-Math.PI / 2);
  
  // Ensure bottom is at Z=0
  merged.computeBoundingBox();
  if (merged.boundingBox) {
    merged.translate(0, 0, -merged.boundingBox.min.z);
  }

  merged.computeVertexNormals();
  return merged;
}

/**
 * Create a ring (washer) geometry
 */
function createRing(
  innerRadius: number,
  outerRadius: number,
  thickness: number,
  segments: number
): THREE.BufferGeometry {
  // Use a lathe geometry approach with a rectangular profile
  const shape = new THREE.Shape();
  shape.moveTo(innerRadius, -thickness / 2);
  shape.lineTo(outerRadius, -thickness / 2);
  shape.lineTo(outerRadius, thickness / 2);
  shape.lineTo(innerRadius, thickness / 2);
  shape.lineTo(innerRadius, -thickness / 2);

  const geometry = new THREE.LatheGeometry(
    shape.getPoints(1),
    segments,
    0,
    Math.PI * 2
  );

  return geometry;
}

/**
 * Flip normals for inner surfaces
 */
function flipNormals(geometry: THREE.BufferGeometry): void {
  const index = geometry.index;
  if (index) {
    const indices = index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i];
      indices[i] = indices[i + 2];
      indices[i + 2] = tmp;
    }
    index.needsUpdate = true;
  }

  const normals = geometry.attributes.normal;
  if (normals) {
    const array = normals.array as Float32Array;
    for (let i = 0; i < array.length; i++) {
      array[i] = -array[i];
    }
    normals.needsUpdate = true;
  }
}

/**
 * Export socket cradle to STL blob
 */
export async function exportSocketCradleToSTL(
  params: SocketCradleParams
): Promise<Blob> {
  const { STLExporter } = await import('three-stdlib');
  const geometry = generateSocketCradle(params);
  const mesh = new THREE.Mesh(geometry);
  
  const exporter = new STLExporter();
  const stlString = exporter.parse(mesh, { binary: false });
  
  geometry.dispose();
  
  return new Blob([stlString], { type: 'application/octet-stream' });
}

/**
 * Get spider fitter size recommendation based on shade rim diameter
 * 
 * Standard spider fitter sizes (inches):
 * - 4" - Small shades (up to ~100mm)
 * - 6" - Medium shades (100-150mm)
 * - 8" - Large shades (150-200mm)
 * - 10" - Extra large shades (200-250mm)
 */
export function getSpiderFitterRecommendation(rimDiameterMm: number): {
  sizeInches: number;
  sizeMm: number;
  searchTerm: string;
  notes: string;
} {
  // Convert to approximate fitter size (fitter should be slightly smaller than rim)
  const fitterSizeMm = rimDiameterMm * 0.7; // Fitter spans ~70% of opening
  
  // Standard sizes in inches
  const standardSizes = [4, 6, 8, 10, 12];
  const inchToMm = 25.4;
  
  // Find closest standard size
  let bestSize = 6; // Default
  let minDiff = Infinity;
  
  for (const size of standardSizes) {
    const sizeMm = size * inchToMm;
    const diff = Math.abs(sizeMm - fitterSizeMm);
    if (diff < minDiff) {
      minDiff = diff;
      bestSize = size;
    }
  }
  
  const notes = rimDiameterMm > 250 
    ? 'Large shade - may need custom or adjustable fitter'
    : rimDiameterMm < 80 
    ? 'Small shade - consider clip-on socket instead'
    : 'Standard size - widely available';

  return {
    sizeInches: bestSize,
    sizeMm: Math.round(bestSize * inchToMm),
    searchTerm: `${bestSize} inch lamp spider fitter`,
    notes,
  };
}

/**
 * Get harp size recommendation based on shade height
 */
export function getHarpRecommendation(shadeHeightMm: number): {
  sizeInches: number;
  searchTerm: string;
  notes: string;
} {
  // Harp height should roughly match shade height
  const heightInches = shadeHeightMm / 25.4;
  
  // Standard harp sizes: 4", 5", 6", 7", 8", 9", 10", 11", 12"
  const standardSizes = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  
  // Find closest standard size
  let bestSize = 8;
  let minDiff = Infinity;
  
  for (const size of standardSizes) {
    const diff = Math.abs(size - heightInches);
    if (diff < minDiff) {
      minDiff = diff;
      bestSize = size;
    }
  }

  return {
    sizeInches: bestSize,
    searchTerm: `${bestSize} inch lamp harp`,
    notes: 'For table/floor lamps where shade sits on top',
  };
}
