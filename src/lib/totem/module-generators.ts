/**
 * Totem Module Geometry Generators
 * 
 * Functions to generate 3D geometry for each module type in the totem system
 */

import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import { mergeGeometries as threeJsMergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  TotemModuleConfig,
  ShadeModuleConfig,
  SpacerModuleConfig,
  BaseModuleConfig,
  CapModuleConfig,
  PendantModuleConfig,
  ExtensionModuleConfig,
  SPINDLE_SPECS,
  SpindleSize,
} from '@/types/totem';
import { generateInterfaceRing, createInterfaceRingConfig } from './interface-ring';
import { subtractSpindleHole, createSpindleHoleGeometry } from './spindle-geometry';

// Scale factor: convert mm to scene units
const SCALE = 0.01;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Merge multiple geometries into one using Three.js BufferGeometryUtils
 * This properly handles all attributes including normals
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }
  
  if (geometries.length === 1) {
    const geo = geometries[0].clone();
    if (!geo.attributes.normal) {
      geo.computeVertexNormals();
    }
    return geo;
  }
  
  // Ensure all geometries have normals computed before merging
  const preparedGeometries = geometries.map(geo => {
    if (!geo.attributes.normal) {
      geo.computeVertexNormals();
    }
    return geo;
  });
  
  // Use Three.js built-in mergeGeometries for robust attribute handling
  const merged = threeJsMergeGeometries(preparedGeometries, false);
  if (!merged) {
    console.error('Failed to merge geometries');
    return new THREE.BufferGeometry();
  }
  
  return merged;
}

// Deterministic noise
const seededRandom = (x: number, y: number, z: number) => {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719;
  return (Math.sin(dot) * 43758.5453) % 1;
};

const noise3D = (x: number, y: number, z: number, scale: number) => {
  const sx = x * scale;
  const sy = y * scale;
  const sz = z * scale;
  
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const iz = Math.floor(sz);
  
  const fx = sx - ix;
  const fy = sy - iy;
  const fz = sz - iz;
  
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  
  const n000 = seededRandom(ix, iy, iz);
  const n100 = seededRandom(ix + 1, iy, iz);
  const n010 = seededRandom(ix, iy + 1, iz);
  const n110 = seededRandom(ix + 1, iy + 1, iz);
  const n001 = seededRandom(ix, iy, iz + 1);
  const n101 = seededRandom(ix + 1, iy, iz + 1);
  const n011 = seededRandom(ix, iy + 1, iz + 1);
  const n111 = seededRandom(ix + 1, iy + 1, iz + 1);
  
  const nx00 = n000 * (1 - ux) + n100 * ux;
  const nx10 = n010 * (1 - ux) + n110 * ux;
  const nx01 = n001 * (1 - ux) + n101 * ux;
  const nx11 = n011 * (1 - ux) + n111 * ux;
  
  const nxy0 = nx00 * (1 - uy) + nx10 * uy;
  const nxy1 = nx01 * (1 - uy) + nx11 * uy;
  
  return (nxy0 * (1 - uz) + nxy1 * uz) * 2 - 1;
};

// ============================================================================
// SHADE MODULE GENERATOR
// ============================================================================

/**
 * Generate geometry for a shade module
 * Creates organic body with spindle hole and interface rings
 */
export function generateShadeModule(
  config: ShadeModuleConfig,
  scale: boolean = true
): THREE.BufferGeometry {
  const params = config.shapeParams;
  const spindleSpec = SPINDLE_SPECS[config.spindleSize];
  
  const height = params.height || 100;
  const baseRadius = params.baseRadius || 30;
  const topRadius = params.topRadius || 60;
  const wallThickness = params.wallThickness || 1.6;
  
  const segments = 64;
  const heightSegments = 48;
  
  // Generate organic body vertices
  const outerVerts: number[] = [];
  
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    
    // Base profile interpolation
    let radius = baseRadius + (topRadius - baseRadius) * Math.pow(t, 0.6);
    
    // Apply organic deformations from params
    const bulgePosition = params.bulgePosition || 0.5;
    const bulgeAmount = params.bulgeAmount || 0;
    const bulgeDist = Math.abs(t - bulgePosition);
    radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;
    
    // Pinch
    const pinchAmount = params.pinchAmount || 0;
    const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
    const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
    radius *= (1 - pinchTop - pinchBottom);
    
    // Lip flare
    const lipFlare = params.lipFlare || 0;
    const lipHeight = params.lipHeight || 0;
    if (lipHeight > 0 && lipFlare !== 0) {
      const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
      radius += lipT * lipT * lipFlare * baseRadius;
    }
    
    // Ensure minimum radius for spindle
    radius = Math.max(radius, spindleSpec.holeDiameter / 2 + wallThickness + 2);
    
    const twistAngle = params.twistAngle || 0;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      let r = radius;
      
      // Wobble
      const wobbleFrequency = params.wobbleFrequency || 0;
      const wobbleAmplitude = params.wobbleAmplitude || 0;
      if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
        r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * wobbleAmplitude * baseRadius;
      }
      
      // Ripples
      const rippleCount = params.rippleCount || 0;
      const rippleDepth = params.rippleDepth || 0;
      if (rippleCount > 0 && rippleDepth > 0) {
        r += Math.sin(theta * rippleCount) * rippleDepth * baseRadius;
      }
      
      // Asymmetry
      const asymmetry = params.asymmetry || 0;
      if (asymmetry > 0) {
        const primaryWave = Math.sin(theta) * Math.cos(t * Math.PI) * asymmetry * baseRadius;
        const secondaryWave = Math.sin(theta * 2 + t * Math.PI * 3) * asymmetry * 0.5 * baseRadius;
        const lean = Math.cos(theta) * t * asymmetry * 0.4 * baseRadius;
        r += primaryWave + secondaryWave + lean;
      }
      
      // Organic noise
      const organicNoise = params.organicNoise || 0;
      const noiseScale = params.noiseScale || 1;
      if (organicNoise > 0) {
        const nx = Math.cos(theta) * r;
        const nz = Math.sin(theta) * r;
        r += noise3D(nx * 10, y * 10, nz * 10, noiseScale) * organicNoise * baseRadius;
      }
      
      // Ensure minimum
      r = Math.max(r, spindleSpec.holeDiameter / 2 + wallThickness);
      
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      outerVerts.push(x, y, z);
    }
  }
  
  // Build body geometry
  const vertices: number[] = [...outerVerts];
  const indices: number[] = [];
  
  // Surface faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();
  
  // Generate interface rings
  const bottomRingConfig = createInterfaceRingConfig(config.spindleSize, baseRadius, config.bottomInterface.ring.height);
  const topRingConfig = createInterfaceRingConfig(config.spindleSize, topRadius, config.topInterface.ring.height);
  
  const bottomRing = generateInterfaceRing(bottomRingConfig);
  // Position bottom ring below body (y < 0)
  bottomRing.translate(0, -bottomRingConfig.height, 0);
  
  const topRing = generateInterfaceRing(topRingConfig);
  // Position top ring above body
  topRing.translate(0, height, 0);
  
  // Merge all geometries
  let combined = mergeGeometries([bodyGeo, bottomRing, topRing]);
  
  // Subtract spindle hole through entire height plus rings
  const totalHeight = height + bottomRingConfig.height + topRingConfig.height;
  combined = subtractSpindleHole(
    combined,
    config.spindleSize,
    totalHeight,
    'through'
  );
  
  // Translate so bottom of bottom ring is at y=0
  combined.translate(0, bottomRingConfig.height, 0);
  
  // Scale if needed
  if (scale) {
    combined.scale(SCALE, SCALE, SCALE);
  }
  
  return combined;
}

// ============================================================================
// SPACER MODULE GENERATOR
// ============================================================================

/**
 * Generate geometry for a spacer module
 * Simple ring with optional decorative features
 */
export function generateSpacerModule(
  config: SpacerModuleConfig,
  scale: boolean = true
): THREE.BufferGeometry {
  const { height, outerDiameter, style, ribCount, spindleSize } = config;
  const spindleSpec = SPINDLE_SPECS[spindleSize];
  
  const innerRadius = spindleSpec.holeDiameter / 2;
  const outerRadius = outerDiameter / 2;
  const segments = 64;
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const heightSegments = style === 'twisted' ? 24 : 2;
  
  // Generate outer surface
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    
    // Twist angle for twisted style
    const twistOffset = style === 'twisted' ? t * Math.PI * 0.5 : 0;
    
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistOffset;
      let r = outerRadius;
      
      // Apply style modifications
      if (style === 'ribbed' && ribCount) {
        r += Math.sin(theta * ribCount) * 2;
      } else if (style === 'fluted' && ribCount) {
        r -= Math.abs(Math.sin(theta * ribCount)) * 3;
      }
      
      vertices.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
    }
  }
  
  // Generate inner surface
  const innerStart = vertices.length / 3;
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    const twistOffset = style === 'twisted' ? t * Math.PI * 0.5 : 0;
    
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistOffset;
      vertices.push(Math.cos(theta) * innerRadius, y, Math.sin(theta) * innerRadius);
    }
  }
  
  const stride = segments + 1;
  
  // Outer surface faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  
  // Inner surface faces (reversed winding)
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = innerStart + i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  // Bottom cap (ring)
  for (let j = 0; j < segments; j++) {
    const outerA = j;
    const outerB = j + 1;
    const innerA = innerStart + j;
    const innerB = innerStart + j + 1;
    indices.push(outerA, innerA, outerB);
    indices.push(outerB, innerA, innerB);
  }
  
  // Top cap (ring)
  const topOuterStart = heightSegments * stride;
  const topInnerStart = innerStart + heightSegments * stride;
  for (let j = 0; j < segments; j++) {
    const outerA = topOuterStart + j;
    const outerB = topOuterStart + j + 1;
    const innerA = topInnerStart + j;
    const innerB = topInnerStart + j + 1;
    indices.push(outerA, outerB, innerA);
    indices.push(outerB, innerB, innerA);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  if (scale) {
    geometry.scale(SCALE, SCALE, SCALE);
  }
  
  return geometry;
}

// ============================================================================
// BASE MODULE GENERATOR
// ============================================================================

/**
 * Generate geometry for a base module
 * Weighted base with blind hole (spindle socket)
 */
export function generateBaseModule(
  config: BaseModuleConfig,
  scale: boolean = true
): THREE.BufferGeometry {
  const {
    diameter,
    height,
    weight,
    rubberFeet,
    cordHole,
    spindleSize,
  } = config;
  
  const spindleSpec = SPINDLE_SPECS[spindleSize];
  const radius = diameter / 2;
  const segments = 64;
  
  // Create main disc body
  const discGeo = new THREE.CylinderGeometry(radius, radius, height, segments);
  discGeo.translate(0, height / 2, 0);
  
  const evaluator = new Evaluator();
  let result = new Brush(discGeo);
  result.updateMatrixWorld();
  
  // Subtract spindle socket (blind hole from top)
  const socketDepth = Math.min(height - 3, 20); // Leave 3mm at bottom
  const socketGeo = new THREE.CylinderGeometry(
    spindleSpec.holeDiameter / 2,
    spindleSpec.holeDiameter / 2,
    socketDepth + 1,
    32
  );
  socketGeo.translate(0, height - socketDepth / 2, 0);
  const socketBrush = new Brush(socketGeo);
  socketBrush.updateMatrixWorld();
  result = evaluator.evaluate(result, socketBrush, SUBTRACTION);
  
  // Subtract weight cavity if enabled
  if (weight.cavityEnabled) {
    const cavityGeo = new THREE.CylinderGeometry(
      weight.cavityDiameter / 2,
      weight.cavityDiameter / 2,
      weight.cavityDepth + 1,
      32
    );
    // Cavity from bottom
    cavityGeo.translate(0, weight.cavityDepth / 2 - 0.5, 0);
    const cavityBrush = new Brush(cavityGeo);
    cavityBrush.updateMatrixWorld();
    result = evaluator.evaluate(result, cavityBrush, SUBTRACTION);
  }
  
  // Subtract rubber feet recesses if enabled
  if (rubberFeet.enabled) {
    const feetGeo: THREE.BufferGeometry[] = [];
    const footRadius = rubberFeet.diameter / 2;
    const footDepth = 2; // 2mm recess
    const footPlacement = radius - footRadius - 5; // 5mm from edge
    
    for (let i = 0; i < rubberFeet.count; i++) {
      const angle = (i / rubberFeet.count) * Math.PI * 2;
      const footGeo = new THREE.CylinderGeometry(footRadius, footRadius, footDepth + 1, 16);
      footGeo.translate(
        Math.cos(angle) * footPlacement,
        footDepth / 2 - 0.5,
        Math.sin(angle) * footPlacement
      );
      const footBrush = new Brush(footGeo);
      footBrush.updateMatrixWorld();
      result = evaluator.evaluate(result, footBrush, SUBTRACTION);
    }
  }
  
  // Subtract cord hole if enabled
  if (cordHole.enabled) {
    const cordGeo = new THREE.CylinderGeometry(
      cordHole.diameter / 2,
      cordHole.diameter / 2,
      height + 2,
      16
    );
    // Offset from center toward edge
    const cordOffset = radius * 0.5;
    cordGeo.translate(cordOffset, height / 2, 0);
    const cordBrush = new Brush(cordGeo);
    cordBrush.updateMatrixWorld();
    result = evaluator.evaluate(result, cordBrush, SUBTRACTION);
  }
  
  const geometry = result.geometry.clone();
  geometry.computeVertexNormals();
  
  if (scale) {
    geometry.scale(SCALE, SCALE, SCALE);
  }
  
  return geometry;
}

// ============================================================================
// CAP MODULE GENERATOR
// ============================================================================

/**
 * Generate geometry for a cap module
 * Top piece with socket mount
 */
export function generateCapModule(
  config: CapModuleConfig,
  scale: boolean = true
): THREE.BufferGeometry {
  const { socketType, domeHeight, ventHoles, spindleSize } = config;
  const ringConfig = config.bottomInterface.ring;
  
  const spindleSpec = SPINDLE_SPECS[spindleSize];
  const outerRadius = ringConfig.outerDiameter / 2;
  const ringHeight = ringConfig.height;
  const segments = 64;
  
  // Socket dimensions
  const socketDiameters: Record<string, number> = {
    E26: 26, E12: 12, E14: 14, GU10: 35
  };
  const socketRadius = (socketDiameters[socketType] || 26) / 2 + 0.5; // 0.5mm clearance
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // Create interface ring at bottom
  const ringGeo = generateInterfaceRing(ringConfig, segments);
  geometries.push(ringGeo);
  
  // Create dome if height > 0
  if (domeHeight > 0) {
    const domeSegments = 16;
    const domeVerts: number[] = [];
    const domeIndices: number[] = [];
    
    // Create dome from ring top to peak
    for (let i = 0; i <= domeSegments; i++) {
      const t = i / domeSegments;
      const y = ringHeight + Math.sin(t * Math.PI / 2) * domeHeight;
      const r = outerRadius * Math.cos(t * Math.PI / 2);
      
      // Don't go smaller than socket radius
      const effectiveR = Math.max(r, socketRadius + 2);
      
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        domeVerts.push(Math.cos(theta) * effectiveR, y, Math.sin(theta) * effectiveR);
      }
    }
    
    const stride = segments + 1;
    for (let i = 0; i < domeSegments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        domeIndices.push(a, b, c);
        domeIndices.push(b, d, c);
      }
    }
    
    const domeGeo = new THREE.BufferGeometry();
    domeGeo.setAttribute('position', new THREE.Float32BufferAttribute(domeVerts, 3));
    domeGeo.setIndex(domeIndices);
    domeGeo.computeVertexNormals();
    geometries.push(domeGeo);
  }
  
  let combined = mergeGeometries(geometries);
  
  // Subtract spindle hole
  const totalHeight = ringHeight + domeHeight;
  combined = subtractSpindleHole(combined, spindleSize, totalHeight, 'through');
  
  if (scale) {
    combined.scale(SCALE, SCALE, SCALE);
  }
  
  return combined;
}

// ============================================================================
// PENDANT MODULE GENERATOR
// ============================================================================

/**
 * Generate geometry for a pendant module
 * Ceiling mount with cord grip
 */
export function generatePendantModule(
  config: PendantModuleConfig,
  scale: boolean = true
): THREE.BufferGeometry {
  const { canopyDiameter, canopyHeight, spindleSize } = config;
  const ringConfig = config.bottomInterface.ring;
  
  const spindleSpec = SPINDLE_SPECS[spindleSize];
  const canopyRadius = canopyDiameter / 2;
  const segments = 64;
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // Create bottom interface ring
  const ringGeo = generateInterfaceRing(ringConfig, segments);
  geometries.push(ringGeo);
  
  // Create canopy dome (inverted, going up from ring)
  if (canopyHeight > 0) {
    const domeSegments = 16;
    const domeVerts: number[] = [];
    const domeIndices: number[] = [];
    
    const ringTop = ringConfig.height;
    
    for (let i = 0; i <= domeSegments; i++) {
      const t = i / domeSegments;
      // Dome curves up and out
      const y = ringTop + t * canopyHeight;
      const r = ringConfig.outerDiameter / 2 + (canopyRadius - ringConfig.outerDiameter / 2) * Math.sin(t * Math.PI / 2);
      
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        domeVerts.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
      }
    }
    
    const stride = segments + 1;
    for (let i = 0; i < domeSegments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        domeIndices.push(a, b, c);
        domeIndices.push(b, d, c);
      }
    }
    
    // Cap the top
    const topCenter = domeVerts.length / 3;
    domeVerts.push(0, ringTop + canopyHeight, 0);
    const lastRingStart = domeSegments * stride;
    for (let j = 0; j < segments; j++) {
      domeIndices.push(lastRingStart + j, lastRingStart + j + 1, topCenter);
    }
    
    const domeGeo = new THREE.BufferGeometry();
    domeGeo.setAttribute('position', new THREE.Float32BufferAttribute(domeVerts, 3));
    domeGeo.setIndex(domeIndices);
    domeGeo.computeVertexNormals();
    geometries.push(domeGeo);
  }
  
  let combined = mergeGeometries(geometries);
  
  // Subtract spindle hole through the whole thing
  const totalHeight = ringConfig.height + canopyHeight;
  combined = subtractSpindleHole(combined, spindleSize, totalHeight, 'through');
  
  if (scale) {
    combined.scale(SCALE, SCALE, SCALE);
  }
  
  return combined;
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generate geometry for any totem module type
 */
export function generateModuleGeometry(
  config: TotemModuleConfig,
  scale: boolean = true
): THREE.BufferGeometry {
  switch (config.type) {
    case 'shade':
      return generateShadeModule(config as ShadeModuleConfig, scale);
    case 'spacer':
      return generateSpacerModule(config as SpacerModuleConfig, scale);
    case 'base':
      return generateBaseModule(config as BaseModuleConfig, scale);
    case 'cap':
      return generateCapModule(config as CapModuleConfig, scale);
    case 'pendant':
      return generatePendantModule(config as PendantModuleConfig, scale);
    case 'extension':
      // Extension uses same generator as shade
      return generateShadeModule(config as unknown as ShadeModuleConfig, scale);
    default:
      console.warn('Unknown module type:', (config as any).type);
      return new THREE.BufferGeometry();
  }
}
