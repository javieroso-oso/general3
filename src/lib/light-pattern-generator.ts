import * as THREE from 'three';
import { ParametricParams } from '@/types/parametric';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

// Represents a single perforation hole in cylindrical coordinates
export interface PerforationHole {
  theta: number;    // Angular position (0 to 2π)
  t: number;        // Height fraction (0 to 1)
  size: number;     // Hole diameter in mm
}

// Simple pseudo-random generator with seed for reproducibility
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Poisson disc sampling for organic distribution
function poissonDiscSample(
  width: number,
  height: number,
  minDist: number,
  random: () => number,
  attempts: number = 30
): Array<{ x: number; y: number }> {
  const cellSize = minDist / Math.sqrt(2);
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid: Array<{ x: number; y: number } | null> = new Array(gridWidth * gridHeight).fill(null);
  const points: Array<{ x: number; y: number }> = [];
  const active: Array<{ x: number; y: number }> = [];

  const addPoint = (x: number, y: number) => {
    const point = { x, y };
    points.push(point);
    active.push(point);
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
      grid[gx + gy * gridWidth] = point;
    }
  };

  // Start with a random point
  addPoint(random() * width, random() * height);

  while (active.length > 0) {
    const idx = Math.floor(random() * active.length);
    const point = active[idx];
    let found = false;

    for (let i = 0; i < attempts; i++) {
      const angle = random() * Math.PI * 2;
      const dist = minDist + random() * minDist;
      const nx = point.x + Math.cos(angle) * dist;
      const ny = point.y + Math.sin(angle) * dist;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const gx = Math.floor(nx / cellSize);
      const gy = Math.floor(ny / cellSize);
      let valid = true;

      // Check neighboring cells
      for (let dx = -2; dx <= 2 && valid; dx++) {
        for (let dy = -2; dy <= 2 && valid; dy++) {
          const checkX = gx + dx;
          const checkY = gy + dy;
          if (checkX >= 0 && checkX < gridWidth && checkY >= 0 && checkY < gridHeight) {
            const neighbor = grid[checkX + checkY * gridWidth];
            if (neighbor) {
              const distSq = (neighbor.x - nx) ** 2 + (neighbor.y - ny) ** 2;
              if (distSq < minDist * minDist) valid = false;
            }
          }
        }
      }

      if (valid) {
        addPoint(nx, ny);
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(idx, 1);
    }
  }

  return points;
}

// Generate dots pattern (hex grid with optional randomness)
export function generateDotPattern(
  params: ParametricParams,
  seed: number = 42
): PerforationHole[] {
  const holes: PerforationHole[] = [];
  const random = seededRandom(seed);
  
  const {
    lightPatternDensity,
    lightPatternSize,
    lightPatternZoneStart,
    lightPatternZoneEnd,
    lightPatternRandomness,
    lightPatternScaleWithHeight,
    lightPatternRimMargin,
    height,
    baseRadius,
    topRadius,
  } = params;
  
  // Calculate spacing based on density (higher density = smaller spacing)
  const avgRadius = (baseRadius + topRadius) / 2;
  const circumference = 2 * Math.PI * avgRadius;
  const zoneHeight = (lightPatternZoneEnd - lightPatternZoneStart) * height;
  
  // Number of rows and columns based on density
  const spacing = lightPatternSize * (3 - lightPatternDensity * 2); // 3x at 0.1 density, 1x at 1.0
  const rows = Math.max(3, Math.floor(zoneHeight / spacing));
  const cols = Math.max(6, Math.floor(circumference / spacing));
  
  const effectiveZoneEnd = lightPatternZoneEnd - lightPatternRimMargin;
  
  for (let row = 0; row < rows; row++) {
    const t = lightPatternZoneStart + (row / (rows - 1 || 1)) * (effectiveZoneEnd - lightPatternZoneStart);
    
    // Hex grid offset for alternating rows
    const offset = (row % 2) * 0.5;
    
    for (let col = 0; col < cols; col++) {
      let theta = ((col + offset) / cols) * Math.PI * 2;
      let tPos = t;
      
      // Apply randomness
      if (lightPatternRandomness > 0) {
        theta += (random() - 0.5) * lightPatternRandomness * (Math.PI * 2 / cols);
        tPos += (random() - 0.5) * lightPatternRandomness * (1 / rows);
        tPos = Math.max(lightPatternZoneStart, Math.min(effectiveZoneEnd, tPos));
      }
      
      // Calculate size (potentially scaled with height)
      let size = lightPatternSize;
      if (lightPatternScaleWithHeight) {
        const heightFactor = 1 + (tPos - lightPatternZoneStart) / (effectiveZoneEnd - lightPatternZoneStart);
        size *= heightFactor;
      }
      
      holes.push({ theta, t: tPos, size });
    }
  }
  
  return holes;
}

// Generate horizontal line slots
export function generateLinePattern(
  params: ParametricParams,
  seed: number = 42
): PerforationHole[] {
  const holes: PerforationHole[] = [];
  const random = seededRandom(seed);
  
  const {
    lightPatternDensity,
    lightPatternSize,
    lightPatternZoneStart,
    lightPatternZoneEnd,
    lightPatternRandomness,
    lightPatternRimMargin,
  } = params;
  
  const effectiveZoneEnd = lightPatternZoneEnd - lightPatternRimMargin;
  
  // Number of slot rows
  const rowCount = Math.max(3, Math.floor(8 * lightPatternDensity));
  
  // Slots per row (creates horizontal lines)
  const slotsPerRow = Math.max(4, Math.floor(12 * lightPatternDensity));
  
  for (let row = 0; row < rowCount; row++) {
    const baseT = lightPatternZoneStart + ((row + 0.5) / rowCount) * (effectiveZoneEnd - lightPatternZoneStart);
    
    // Create multiple holes in a row to simulate a slot
    const slotLength = (Math.PI * 2) / slotsPerRow * 0.6; // 60% of arc per slot
    
    for (let slot = 0; slot < slotsPerRow; slot++) {
      const baseTheta = (slot / slotsPerRow) * Math.PI * 2;
      
      // Multiple holes per slot for a line effect
      const holesPerSlot = 3;
      for (let h = 0; h < holesPerSlot; h++) {
        let theta = baseTheta + (h / holesPerSlot) * slotLength;
        let t = baseT;
        
        if (lightPatternRandomness > 0) {
          t += (random() - 0.5) * lightPatternRandomness * 0.05;
          t = Math.max(lightPatternZoneStart, Math.min(effectiveZoneEnd, t));
        }
        
        holes.push({ theta, t, size: lightPatternSize });
      }
    }
  }
  
  return holes;
}

// Generate organic noise-based pattern using Poisson disc sampling
export function generateOrganicPattern(
  params: ParametricParams,
  seed: number = 42
): PerforationHole[] {
  const holes: PerforationHole[] = [];
  const random = seededRandom(seed);
  
  const {
    lightPatternDensity,
    lightPatternSize,
    lightPatternZoneStart,
    lightPatternZoneEnd,
    lightPatternRandomness,
    lightPatternScaleWithHeight,
    lightPatternRimMargin,
    height,
    baseRadius,
    topRadius,
  } = params;
  
  const effectiveZoneEnd = lightPatternZoneEnd - lightPatternRimMargin;
  const avgRadius = (baseRadius + topRadius) / 2;
  const circumference = 2 * Math.PI * avgRadius;
  const zoneHeight = (effectiveZoneEnd - lightPatternZoneStart) * height;
  
  // Minimum distance based on hole size and density
  const minDist = lightPatternSize * (2.5 - lightPatternDensity * 1.5);
  
  // Sample in 2D space (unwrapped cylinder)
  const points = poissonDiscSample(circumference, zoneHeight, minDist, random);
  
  for (const point of points) {
    let theta = (point.x / circumference) * Math.PI * 2;
    let t = lightPatternZoneStart + (point.y / zoneHeight) * (effectiveZoneEnd - lightPatternZoneStart);
    
    // Add extra randomness to size
    let size = lightPatternSize * (0.8 + random() * 0.4);
    if (lightPatternRandomness > 0) {
      size *= 0.7 + lightPatternRandomness * random() * 0.6;
    }
    
    if (lightPatternScaleWithHeight) {
      const heightFactor = 1 + (t - lightPatternZoneStart) / (effectiveZoneEnd - lightPatternZoneStart) * 0.5;
      size *= heightFactor;
    }
    
    holes.push({ theta, t, size });
  }
  
  return holes;
}

// Generate honeycomb/hexagonal pattern
export function generateGeometricPattern(
  params: ParametricParams,
  seed: number = 42
): PerforationHole[] {
  const holes: PerforationHole[] = [];
  const random = seededRandom(seed);
  
  const {
    lightPatternDensity,
    lightPatternSize,
    lightPatternZoneStart,
    lightPatternZoneEnd,
    lightPatternRandomness,
    lightPatternScaleWithHeight,
    lightPatternRimMargin,
    height,
    baseRadius,
    topRadius,
  } = params;
  
  const effectiveZoneEnd = lightPatternZoneEnd - lightPatternRimMargin;
  const avgRadius = (baseRadius + topRadius) / 2;
  const circumference = 2 * Math.PI * avgRadius;
  const zoneHeight = (effectiveZoneEnd - lightPatternZoneStart) * height;
  
  // Honeycomb spacing
  const hexHeight = lightPatternSize * (3 - lightPatternDensity * 2) * 1.5;
  const hexWidth = hexHeight * Math.sqrt(3) / 2;
  
  const rows = Math.max(3, Math.floor(zoneHeight / hexHeight));
  const cols = Math.max(6, Math.floor(circumference / hexWidth));
  
  for (let row = 0; row < rows; row++) {
    const t = lightPatternZoneStart + ((row + 0.5) / rows) * (effectiveZoneEnd - lightPatternZoneStart);
    const offset = (row % 2) * 0.5;
    
    for (let col = 0; col < cols; col++) {
      let theta = ((col + offset) / cols) * Math.PI * 2;
      let tPos = t;
      
      if (lightPatternRandomness > 0) {
        theta += (random() - 0.5) * lightPatternRandomness * 0.1;
        tPos += (random() - 0.5) * lightPatternRandomness * 0.02;
        tPos = Math.max(lightPatternZoneStart, Math.min(effectiveZoneEnd, tPos));
      }
      
      let size = lightPatternSize;
      if (lightPatternScaleWithHeight) {
        size *= 1 + (tPos - lightPatternZoneStart) / (effectiveZoneEnd - lightPatternZoneStart) * 0.5;
      }
      
      holes.push({ theta, t: tPos, size });
    }
  }
  
  return holes;
}

// Generate spiral pattern following the body's twist
export function generateSpiralPattern(
  params: ParametricParams,
  seed: number = 42
): PerforationHole[] {
  const holes: PerforationHole[] = [];
  const random = seededRandom(seed);
  
  const {
    lightPatternDensity,
    lightPatternSize,
    lightPatternZoneStart,
    lightPatternZoneEnd,
    lightPatternRandomness,
    lightPatternScaleWithHeight,
    lightPatternRimMargin,
    twistAngle,
  } = params;
  
  const effectiveZoneEnd = lightPatternZoneEnd - lightPatternRimMargin;
  
  // Number of spiral arms
  const armCount = Math.max(3, Math.floor(6 * lightPatternDensity));
  // Holes per arm
  const holesPerArm = Math.max(8, Math.floor(20 * lightPatternDensity));
  
  // Spiral twist (use body twist or default)
  const spiralTwist = (twistAngle || 45) * Math.PI / 180;
  
  for (let arm = 0; arm < armCount; arm++) {
    const armOffset = (arm / armCount) * Math.PI * 2;
    
    for (let i = 0; i < holesPerArm; i++) {
      let t = lightPatternZoneStart + (i / (holesPerArm - 1 || 1)) * (effectiveZoneEnd - lightPatternZoneStart);
      let theta = armOffset + t * spiralTwist * 2;
      
      if (lightPatternRandomness > 0) {
        theta += (random() - 0.5) * lightPatternRandomness * 0.3;
        t += (random() - 0.5) * lightPatternRandomness * 0.03;
        t = Math.max(lightPatternZoneStart, Math.min(effectiveZoneEnd, t));
      }
      
      let size = lightPatternSize;
      if (lightPatternScaleWithHeight) {
        size *= 1 + (t - lightPatternZoneStart) / (effectiveZoneEnd - lightPatternZoneStart) * 0.5;
      }
      
      holes.push({ theta, t, size });
    }
  }
  
  return holes;
}

// Main generator function that dispatches to pattern-specific generators
export function generateLightPattern(
  params: ParametricParams,
  seed: number = 42
): PerforationHole[] {
  if (!params.lightPatternEnabled) return [];
  
  // Validate wall thickness (minimum 1.6mm for perforations)
  if (params.wallThickness < 1.6) return [];
  
  switch (params.lightPatternType) {
    case 'dots':
      return generateDotPattern(params, seed);
    case 'lines':
      return generateLinePattern(params, seed);
    case 'organic':
      return generateOrganicPattern(params, seed);
    case 'geometric':
      return generateGeometricPattern(params, seed);
    case 'spiral':
      return generateSpiralPattern(params, seed);
    default:
      return generateDotPattern(params, seed);
  }
}

// Calculate 3D position of a hole given cylindrical coordinates and body shape
function getHolePosition(
  hole: PerforationHole,
  params: ParametricParams,
  getRadiusAtHeight: (t: number, theta: number) => number
): { position: THREE.Vector3; normal: THREE.Vector3 } {
  const { height, twistAngle } = params;
  
  // Apply twist to theta
  const twistRad = (twistAngle * Math.PI / 180) * hole.t;
  const theta = hole.theta + twistRad;
  
  const y = hole.t * height;
  const radius = getRadiusAtHeight(hole.t, theta);
  
  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;
  
  const position = new THREE.Vector3(x, y, z);
  const normal = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();
  
  return { position, normal };
}

// Apply CSG perforations to a geometry for STL export
export function applyLightPerforations(
  geometry: THREE.BufferGeometry,
  params: ParametricParams,
  getRadiusAtHeight: (t: number, theta: number) => number
): THREE.BufferGeometry {
  if (!params.lightPatternEnabled) return geometry;
  
  const holes = generateLightPattern(params);
  if (holes.length === 0) return geometry;
  
  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  
  // Create brush from input geometry
  let resultBrush = new Brush(geometry);
  resultBrush.updateMatrixWorld();
  
  // Create cylinder brushes for each hole and subtract
  for (const hole of holes) {
    const { position, normal } = getHolePosition(hole, params, getRadiusAtHeight);
    
    // Create cylinder geometry for the hole
    // Cylinder is longer than wall thickness to ensure clean cut
    const cylinderLength = params.wallThickness * 3;
    const cylinderGeometry = new THREE.CylinderGeometry(
      hole.size / 2,
      hole.size / 2,
      cylinderLength,
      16
    );
    
    // Orient cylinder along the normal (radial direction)
    cylinderGeometry.rotateZ(Math.PI / 2);
    
    const cylinderBrush = new Brush(cylinderGeometry);
    
    // Position the cylinder
    // Move it outward so it cuts through the wall
    const cutPosition = position.clone();
    cylinderBrush.position.copy(cutPosition);
    
    // Rotate to align with normal
    const up = new THREE.Vector3(1, 0, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
    cylinderBrush.quaternion.copy(quaternion);
    
    cylinderBrush.updateMatrixWorld();
    
    // Perform subtraction
    try {
      resultBrush = evaluator.evaluate(resultBrush, cylinderBrush, SUBTRACTION);
    } catch (e) {
      console.warn('CSG subtraction failed for hole at', position, e);
    }
  }
  
  // Extract geometry from result brush
  const resultGeometry = resultBrush.geometry.clone();
  resultGeometry.computeVertexNormals();
  
  return resultGeometry;
}
