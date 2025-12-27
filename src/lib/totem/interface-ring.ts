/**
 * Interface Ring Geometry Generation
 * 
 * Creates the universal interface rings that sit at the top and bottom
 * of each module, providing the spindle hole and stacking interface
 */

import * as THREE from 'three';
import { InterfaceRingConfig, SPINDLE_SPECS, SpindleSize } from '@/types/totem';

/**
 * Generate an interface ring geometry
 * 
 * The ring is a flat donut shape with:
 * - Inner hole for spindle
 * - Outer diameter that varies by module
 * - Optional chamfer for easy stacking
 * 
 * Ring sits at y=0, extends upward to y=height
 */
export function generateInterfaceRing(
  config: InterfaceRingConfig,
  segments: number = 64
): THREE.BufferGeometry {
  const { innerDiameter, outerDiameter, height, chamfer } = config;
  
  const innerRadius = innerDiameter / 2;
  const outerRadius = outerDiameter / 2;
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // If chamfer is enabled, create beveled edges
  const hasChamfer = chamfer > 0;
  const chamferSize = Math.min(chamfer, height * 0.3, (outerRadius - innerRadius) * 0.3);
  
  if (hasChamfer) {
    // Create ring with chamfered top and bottom edges
    // Layers: bottom chamfer, main body, top chamfer
    
    // Layer 0: Bottom outer edge (chamfered inward)
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      
      // Outer edge chamfered
      vertices.push(cos * (outerRadius - chamferSize), 0, sin * (outerRadius - chamferSize));
    }
    
    // Layer 1: Bottom inner edge
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      vertices.push(cos * innerRadius, 0, sin * innerRadius);
    }
    
    // Layer 2: Main body bottom (after chamfer)
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      vertices.push(cos * outerRadius, chamferSize, sin * outerRadius);
    }
    
    // Layer 3: Main body bottom inner
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      vertices.push(cos * innerRadius, chamferSize, sin * innerRadius);
    }
    
    // Layer 4: Main body top outer
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      vertices.push(cos * outerRadius, height - chamferSize, sin * outerRadius);
    }
    
    // Layer 5: Main body top inner
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      vertices.push(cos * innerRadius, height - chamferSize, sin * innerRadius);
    }
    
    // Layer 6: Top outer edge (chamfered inward)
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      vertices.push(cos * (outerRadius - chamferSize), height, sin * (outerRadius - chamferSize));
    }
    
    // Layer 7: Top inner edge
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      vertices.push(cos * innerRadius, height, sin * innerRadius);
    }
    
    const stride = segments + 1;
    
    // Connect layers with faces
    // Bottom face (layers 0-1)
    for (let i = 0; i < segments; i++) {
      indices.push(i, i + stride, i + 1);
      indices.push(i + 1, i + stride, i + stride + 1);
    }
    
    // Bottom chamfer outer wall (layers 0-2)
    for (let i = 0; i < segments; i++) {
      indices.push(i, i + 1, i + stride * 2);
      indices.push(i + 1, i + stride * 2 + 1, i + stride * 2);
    }
    
    // Inner wall bottom (layers 1-3)
    for (let i = 0; i < segments; i++) {
      const a = stride + i;
      const b = stride + i + 1;
      const c = stride * 3 + i;
      const d = stride * 3 + i + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
    
    // Outer wall (layers 2-4)
    for (let i = 0; i < segments; i++) {
      const a = stride * 2 + i;
      const b = stride * 2 + i + 1;
      const c = stride * 4 + i;
      const d = stride * 4 + i + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
    
    // Inner wall (layers 3-5)
    for (let i = 0; i < segments; i++) {
      const a = stride * 3 + i;
      const b = stride * 3 + i + 1;
      const c = stride * 5 + i;
      const d = stride * 5 + i + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
    
    // Top chamfer outer wall (layers 4-6)
    for (let i = 0; i < segments; i++) {
      const a = stride * 4 + i;
      const b = stride * 4 + i + 1;
      const c = stride * 6 + i;
      const d = stride * 6 + i + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
    
    // Inner wall top (layers 5-7)
    for (let i = 0; i < segments; i++) {
      const a = stride * 5 + i;
      const b = stride * 5 + i + 1;
      const c = stride * 7 + i;
      const d = stride * 7 + i + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
    
    // Top face (layers 6-7)
    for (let i = 0; i < segments; i++) {
      const a = stride * 6 + i;
      const b = stride * 6 + i + 1;
      const c = stride * 7 + i;
      const d = stride * 7 + i + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
    
  } else {
    // Simple flat ring without chamfer
    
    // Bottom outer ring
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * outerRadius, 0, Math.sin(theta) * outerRadius);
    }
    
    // Bottom inner ring
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * innerRadius, 0, Math.sin(theta) * innerRadius);
    }
    
    // Top outer ring
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * outerRadius, height, Math.sin(theta) * outerRadius);
    }
    
    // Top inner ring
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * innerRadius, height, Math.sin(theta) * innerRadius);
    }
    
    const stride = segments + 1;
    
    // Bottom face
    for (let i = 0; i < segments; i++) {
      indices.push(i, i + stride, i + 1);
      indices.push(i + 1, i + stride, i + stride + 1);
    }
    
    // Outer wall
    for (let i = 0; i < segments; i++) {
      indices.push(i, i + 1, i + stride * 2);
      indices.push(i + 1, i + stride * 2 + 1, i + stride * 2);
    }
    
    // Inner wall (reversed winding)
    for (let i = 0; i < segments; i++) {
      const a = stride + i;
      const b = stride + i + 1;
      const c = stride * 3 + i;
      const d = stride * 3 + i + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
    
    // Top face
    for (let i = 0; i < segments; i++) {
      const a = stride * 2 + i;
      const b = stride * 2 + i + 1;
      const c = stride * 3 + i;
      const d = stride * 3 + i + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create interface ring config from spindle size and body radius
 */
export function createInterfaceRingConfig(
  spindleSize: SpindleSize,
  bodyRadius: number,
  ringHeight: number = 5
): InterfaceRingConfig {
  const spec = SPINDLE_SPECS[spindleSize];
  
  return {
    innerDiameter: spec.holeDiameter,
    outerDiameter: Math.max(bodyRadius * 2 + 10, 25), // 10mm larger than body, min 25mm
    height: ringHeight,
    chamfer: 0.5,
  };
}
