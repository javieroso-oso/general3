import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { ParametricParams, ObjectType } from '@/types/parametric';

// Scale factor: mm to scene units
const SCALE = 0.01;

export interface MoldParams {
  wallThickness: number;        // mm
  baseThickness: number;        // mm
  pourHoleDiameter: number;     // mm
  registrationKeySize: number;  // mm
  registrationKeyCount: number; // count
  splitAngle: number;           // degrees
  draftAngle: number;           // degrees (0-5)
  gap: number;                  // mm - preview gap between halves
}

export interface MoldGeometry {
  halfA: THREE.BufferGeometry;
  halfB: THREE.BufferGeometry;
}

/**
 * Calculate the body profile radius at a given height (0-1) and angle
 * Simplified version that matches the main body generation
 */
function getBodyRadius(
  params: ParametricParams,
  t: number,
  theta: number
): number {
  const { baseRadius, topRadius, bulgePosition, bulgeAmount, pinchAmount } = params;
  
  // Basic interpolation
  let radius = baseRadius + (topRadius - baseRadius) * t;
  
  // Bulge
  const bulgeEnv = Math.exp(-Math.pow((t - bulgePosition) / 0.3, 2));
  radius *= 1 + bulgeAmount * bulgeEnv;
  
  // Pinch at top
  const pinchEnv = Math.pow(t, 2);
  radius *= 1 - pinchAmount * pinchEnv;
  
  // Lip flare at very top
  if (t > 0.95 && params.lipFlare > 0) {
    const lipT = (t - 0.95) / 0.05;
    radius *= 1 + params.lipFlare * lipT;
  }
  
  // Asymmetry
  if (params.asymmetry > 0) {
    radius *= 1 + params.asymmetry * Math.cos(theta);
  }
  
  return radius;
}

/**
 * Generate the cavity geometry from the body shape
 * This is the negative space that clay will fill
 */
function generateCavityGeometry(
  params: ParametricParams,
  draftAngle: number = 0
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const segments = 48;
  const rings = 64;
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Generate outer surface (will be cavity wall)
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * height;
    
    // Apply draft angle - radius increases slightly toward bottom for easier release
    const draftOffset = (1 - t) * Math.tan(draftAngle * Math.PI / 180) * height;
    
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      let radius = getBodyRadius(params, t, theta) * SCALE;
      radius += draftOffset; // Draft angle adjustment
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      vertices.push(x, y, z);
    }
  }
  
  // Generate indices for the surface
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      const c = a + 1;
      const d = b + 1;
      
      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Generate a registration key (conical peg)
 */
function generateRegistrationKey(
  size: number,
  height: number,
  isSocket: boolean
): THREE.BufferGeometry {
  // Create a tapered cylinder (frustum)
  const topRadius = size * 0.7 * SCALE;
  const bottomRadius = size * SCALE;
  const keyHeight = height * SCALE;
  
  const geometry = new THREE.CylinderGeometry(
    topRadius,
    bottomRadius,
    keyHeight,
    16
  );
  
  // If socket, we'd use this as a boolean subtraction (handled in mold half generation)
  return geometry;
}

/**
 * Generate pour hole geometry
 */
function generatePourHole(diameter: number, depth: number): THREE.BufferGeometry {
  const radius = (diameter / 2) * SCALE;
  const holeDepth = depth * SCALE;
  
  // Tapered pour hole for easier pouring
  const topRadius = radius * 1.3;
  const bottomRadius = radius;
  
  const geometry = new THREE.CylinderGeometry(
    topRadius,
    bottomRadius,
    holeDepth,
    24
  );
  
  return geometry;
}

/**
 * Generate a single mold half
 */
function generateMoldHalf(
  params: ParametricParams,
  moldParams: MoldParams,
  isHalfA: boolean
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const wallThickness = moldParams.wallThickness * SCALE;
  const baseThickness = moldParams.baseThickness * SCALE;
  const segments = 48;
  const rings = 64;
  
  // Split plane rotation
  const splitRotation = moldParams.splitAngle * Math.PI / 180;
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Determine which half (0 to PI or PI to 2PI)
  const startAngle = isHalfA ? 0 : Math.PI;
  const endAngle = isHalfA ? Math.PI : Math.PI * 2;
  
  // Calculate max body radius for outer mold bounds
  let maxBodyRadius = 0;
  for (let t = 0; t <= 1; t += 0.1) {
    for (let theta = 0; theta < Math.PI * 2; theta += 0.1) {
      const r = getBodyRadius(params, t, theta);
      maxBodyRadius = Math.max(maxBodyRadius, r);
    }
  }
  const outerRadius = (maxBodyRadius + moldParams.wallThickness) * SCALE;
  
  // Generate inner surface (cavity - matches body with draft)
  const innerVertexStart = vertices.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * height;
    
    // Draft angle
    const draftOffset = (1 - t) * Math.tan(moldParams.draftAngle * Math.PI / 180) * height;
    
    for (let j = 0; j <= segments / 2; j++) {
      const thetaRaw = startAngle + (j / (segments / 2)) * Math.PI;
      const theta = thetaRaw + splitRotation;
      
      let radius = getBodyRadius(params, t, theta - splitRotation) * SCALE;
      radius += draftOffset * 0.5; // Small shrinkage compensation
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      vertices.push(x, y, z);
    }
  }
  
  // Generate outer surface (mold exterior - simplified box-like)
  const outerVertexStart = vertices.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * height;
    
    for (let j = 0; j <= segments / 2; j++) {
      const thetaRaw = startAngle + (j / (segments / 2)) * Math.PI;
      const theta = thetaRaw + splitRotation;
      
      // Outer follows a simpler shape (cylinder + some offset)
      const x = Math.cos(theta) * outerRadius;
      const z = Math.sin(theta) * outerRadius;
      
      vertices.push(x, y, z);
    }
  }
  
  // Generate indices for inner surface
  const halfSegments = segments / 2;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < halfSegments; j++) {
      const a = innerVertexStart + i * (halfSegments + 1) + j;
      const b = a + halfSegments + 1;
      const c = a + 1;
      const d = b + 1;
      
      // Inner surface faces inward (reversed winding for cavity)
      indices.push(a, b, c);
      indices.push(c, b, d);
    }
  }
  
  // Generate indices for outer surface
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < halfSegments; j++) {
      const a = outerVertexStart + i * (halfSegments + 1) + j;
      const b = a + halfSegments + 1;
      const c = a + 1;
      const d = b + 1;
      
      // Outer surface faces outward
      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }
  
  // Generate flat split face (connects inner to outer at split plane)
  // Left edge of half
  const leftEdgeInner: number[] = [];
  const leftEdgeOuter: number[] = [];
  for (let i = 0; i <= rings; i++) {
    leftEdgeInner.push(innerVertexStart + i * (halfSegments + 1));
    leftEdgeOuter.push(outerVertexStart + i * (halfSegments + 1));
  }
  
  for (let i = 0; i < rings; i++) {
    const a = leftEdgeInner[i];
    const b = leftEdgeInner[i + 1];
    const c = leftEdgeOuter[i];
    const d = leftEdgeOuter[i + 1];
    
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  // Right edge of half
  const rightEdgeInner: number[] = [];
  const rightEdgeOuter: number[] = [];
  for (let i = 0; i <= rings; i++) {
    rightEdgeInner.push(innerVertexStart + i * (halfSegments + 1) + halfSegments);
    rightEdgeOuter.push(outerVertexStart + i * (halfSegments + 1) + halfSegments);
  }
  
  for (let i = 0; i < rings; i++) {
    const a = rightEdgeInner[i];
    const b = rightEdgeInner[i + 1];
    const c = rightEdgeOuter[i];
    const d = rightEdgeOuter[i + 1];
    
    // Reversed winding for opposite face
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  
  // Generate bottom face
  const bottomVertexStart = vertices.length / 3;
  // Add bottom center vertex
  vertices.push(0, -baseThickness, 0);
  const bottomCenter = bottomVertexStart;
  
  // Add bottom rim vertices (outer)
  for (let j = 0; j <= halfSegments; j++) {
    const thetaRaw = startAngle + (j / halfSegments) * Math.PI;
    const theta = thetaRaw + splitRotation;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, -baseThickness, z);
  }
  
  // Add bottom triangles
  for (let j = 0; j < halfSegments; j++) {
    const a = bottomCenter;
    const b = bottomVertexStart + 1 + j;
    const c = bottomVertexStart + 1 + j + 1;
    indices.push(a, c, b);
  }
  
  // Generate top face (with pour hole area)
  const topVertexStart = vertices.length / 3;
  vertices.push(0, height, 0);
  const topCenter = topVertexStart;
  
  for (let j = 0; j <= halfSegments; j++) {
    const thetaRaw = startAngle + (j / halfSegments) * Math.PI;
    const theta = thetaRaw + splitRotation;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, height, z);
  }
  
  for (let j = 0; j < halfSegments; j++) {
    const a = topCenter;
    const b = topVertexStart + 1 + j;
    const c = topVertexStart + 1 + j + 1;
    indices.push(a, b, c);
  }
  
  // Connect outer surface to bottom
  for (let j = 0; j < halfSegments; j++) {
    const topOuter = outerVertexStart + j;
    const bottomOuter = bottomVertexStart + 1 + j;
    const topOuterNext = outerVertexStart + j + 1;
    const bottomOuterNext = bottomVertexStart + 1 + j + 1;
    
    indices.push(topOuter, bottomOuter, topOuterNext);
    indices.push(topOuterNext, bottomOuter, bottomOuterNext);
  }
  
  // Connect outer surface to top
  const topRingOuter = outerVertexStart + rings * (halfSegments + 1);
  for (let j = 0; j < halfSegments; j++) {
    const bottomOuter = topRingOuter + j;
    const topOuter = topVertexStart + 1 + j;
    const bottomOuterNext = topRingOuter + j + 1;
    const topOuterNext = topVertexStart + 1 + j + 1;
    
    indices.push(bottomOuter, topOuter, bottomOuterNext);
    indices.push(bottomOuterNext, topOuter, topOuterNext);
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Generate both mold halves
 */
export function generateMoldGeometry(
  params: ParametricParams,
  _objectType: ObjectType
): MoldGeometry {
  const moldParams: MoldParams = {
    wallThickness: params.moldWallThickness,
    baseThickness: params.moldBaseThickness,
    pourHoleDiameter: params.moldPourHoleDiameter,
    registrationKeySize: params.moldRegistrationKeySize,
    registrationKeyCount: params.moldRegistrationKeyCount,
    splitAngle: params.moldSplitAngle,
    draftAngle: params.moldDraftAngle,
    gap: params.moldGap,
  };
  
  const halfA = generateMoldHalf(params, moldParams, true);
  const halfB = generateMoldHalf(params, moldParams, false);
  
  return { halfA, halfB };
}

/**
 * Export a mold half to STL
 */
export function exportMoldHalfToSTL(geometry: THREE.BufferGeometry): Blob {
  const mesh = new THREE.Mesh(geometry);
  const exporter = new STLExporter();
  const stlString = exporter.parse(mesh, { binary: false });
  return new Blob([stlString], { type: 'application/sla' });
}

/**
 * Download mold STL files
 */
export function downloadMoldSTL(
  params: ParametricParams,
  objectType: ObjectType,
  half: 'A' | 'B' | 'both',
  baseName: string
): void {
  const { halfA, halfB } = generateMoldGeometry(params, objectType);
  
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  if (half === 'A' || half === 'both') {
    const blobA = exportMoldHalfToSTL(halfA);
    downloadBlob(blobA, `${baseName}_mold_A.stl`);
  }
  
  if (half === 'B' || half === 'both') {
    const blobB = exportMoldHalfToSTL(halfB);
    downloadBlob(blobB, `${baseName}_mold_B.stl`);
  }
  
  halfA.dispose();
  halfB.dispose();
}
