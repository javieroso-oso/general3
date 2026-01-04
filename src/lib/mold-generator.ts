import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
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
 */
function getBodyRadius(
  params: ParametricParams,
  t: number,
  theta: number
): number {
  const { baseRadius, topRadius, bulgePosition, bulgeAmount, pinchAmount } = params;
  
  let radius = baseRadius + (topRadius - baseRadius) * t;
  
  const bulgeEnv = Math.exp(-Math.pow((t - bulgePosition) / 0.3, 2));
  radius *= 1 + bulgeAmount * bulgeEnv;
  
  const pinchEnv = Math.pow(t, 2);
  radius *= 1 - pinchAmount * pinchEnv;
  
  if (t > 0.95 && params.lipFlare > 0) {
    const lipT = (t - 0.95) / 0.05;
    radius *= 1 + params.lipFlare * lipT;
  }
  
  if (params.asymmetry > 0) {
    radius *= 1 + params.asymmetry * Math.cos(theta);
  }
  
  return radius;
}

/**
 * Calculate positions for registration keys along the split seam
 */
function calculateKeyPositions(
  height: number,
  keyCount: number,
  baseThickness: number
): number[] {
  const positions: number[] = [];
  const usableHeight = height;
  const spacing = usableHeight / (keyCount + 1);
  
  for (let i = 1; i <= keyCount; i++) {
    positions.push(spacing * i);
  }
  
  return positions;
}

/**
 * Generate a registration key geometry positioned at a specific location
 */
function createRegistrationKeyBrush(
  size: number,
  keyHeight: number,
  position: THREE.Vector3,
  isSocket: boolean
): Brush {
  // Tapered cylinder for better alignment
  const topRadius = size * 0.7 * SCALE;
  const bottomRadius = size * SCALE;
  const height = keyHeight * SCALE;
  
  // Add tolerance for socket
  const tolerance = isSocket ? 0.002 : 0; // 0.2mm tolerance for socket
  
  const geometry = new THREE.CylinderGeometry(
    topRadius + tolerance,
    bottomRadius + tolerance,
    height,
    16
  );
  
  // Rotate to point outward from split face (along X axis)
  geometry.rotateZ(Math.PI / 2);
  
  const brush = new Brush(geometry);
  brush.position.copy(position);
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Generate pour hole brush at the top of the mold
 */
function createPourHoleBrush(
  diameter: number,
  depth: number,
  topY: number
): Brush {
  const radius = (diameter / 2) * SCALE;
  const holeDepth = depth * SCALE;
  
  // Tapered pour hole - wider at top
  const topRadius = radius * 1.3;
  const bottomRadius = radius;
  
  const geometry = new THREE.CylinderGeometry(
    bottomRadius,  // top of cylinder (bottom of hole)
    topRadius,     // bottom of cylinder (top of hole opening)
    holeDepth,
    24
  );
  
  const brush = new Brush(geometry);
  brush.position.set(0, topY - holeDepth / 2 + 0.001, 0);
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Generate base mold half geometry (without keys and pour hole)
 */
function generateBaseMoldHalf(
  params: ParametricParams,
  moldParams: MoldParams,
  isHalfA: boolean
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const wallThickness = moldParams.wallThickness * SCALE;
  const baseThickness = moldParams.baseThickness * SCALE;
  const segments = 48;
  const rings = 64;
  
  const splitRotation = moldParams.splitAngle * Math.PI / 180;
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
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
  
  // Generate inner surface (cavity)
  const innerVertexStart = vertices.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * height;
    
    const draftOffset = (1 - t) * Math.tan(moldParams.draftAngle * Math.PI / 180) * height;
    
    for (let j = 0; j <= segments / 2; j++) {
      const thetaRaw = startAngle + (j / (segments / 2)) * Math.PI;
      const theta = thetaRaw + splitRotation;
      
      let radius = getBodyRadius(params, t, theta - splitRotation) * SCALE;
      radius += draftOffset * 0.5;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      vertices.push(x, y, z);
    }
  }
  
  // Generate outer surface
  const outerVertexStart = vertices.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * height;
    
    for (let j = 0; j <= segments / 2; j++) {
      const thetaRaw = startAngle + (j / (segments / 2)) * Math.PI;
      const theta = thetaRaw + splitRotation;
      
      const x = Math.cos(theta) * outerRadius;
      const z = Math.sin(theta) * outerRadius;
      
      vertices.push(x, y, z);
    }
  }
  
  const halfSegments = segments / 2;
  
  // Inner surface indices
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < halfSegments; j++) {
      const a = innerVertexStart + i * (halfSegments + 1) + j;
      const b = a + halfSegments + 1;
      const c = a + 1;
      const d = b + 1;
      
      indices.push(a, b, c);
      indices.push(c, b, d);
    }
  }
  
  // Outer surface indices
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < halfSegments; j++) {
      const a = outerVertexStart + i * (halfSegments + 1) + j;
      const b = a + halfSegments + 1;
      const c = a + 1;
      const d = b + 1;
      
      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }
  
  // Split face - left edge
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
  
  // Split face - right edge
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
    
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  
  // Bottom face
  const bottomVertexStart = vertices.length / 3;
  vertices.push(0, -baseThickness, 0);
  const bottomCenter = bottomVertexStart;
  
  for (let j = 0; j <= halfSegments; j++) {
    const thetaRaw = startAngle + (j / halfSegments) * Math.PI;
    const theta = thetaRaw + splitRotation;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, -baseThickness, z);
  }
  
  for (let j = 0; j < halfSegments; j++) {
    const a = bottomCenter;
    const b = bottomVertexStart + 1 + j;
    const c = bottomVertexStart + 1 + j + 1;
    indices.push(a, c, b);
  }
  
  // Top face
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
  
  // Connect outer to bottom
  for (let j = 0; j < halfSegments; j++) {
    const topOuter = outerVertexStart + j;
    const bottomOuter = bottomVertexStart + 1 + j;
    const topOuterNext = outerVertexStart + j + 1;
    const bottomOuterNext = bottomVertexStart + 1 + j + 1;
    
    indices.push(topOuter, bottomOuter, topOuterNext);
    indices.push(topOuterNext, bottomOuter, bottomOuterNext);
  }
  
  // Connect outer to top
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
 * Generate a single mold half with registration keys and pour hole
 */
function generateMoldHalf(
  params: ParametricParams,
  moldParams: MoldParams,
  isHalfA: boolean
): THREE.BufferGeometry {
  const evaluator = new Evaluator();
  const height = params.height * SCALE;
  const baseThickness = moldParams.baseThickness * SCALE;
  
  // Calculate max body radius for key positioning
  let maxBodyRadius = 0;
  for (let t = 0; t <= 1; t += 0.1) {
    for (let theta = 0; theta < Math.PI * 2; theta += 0.1) {
      const r = getBodyRadius(params, t, theta);
      maxBodyRadius = Math.max(maxBodyRadius, r);
    }
  }
  const outerRadius = (maxBodyRadius + moldParams.wallThickness) * SCALE;
  const innerRadius = maxBodyRadius * SCALE;
  const keyDepth = moldParams.registrationKeySize * 1.5; // Key depth in mm
  
  // Generate base mold geometry
  const baseGeometry = generateBaseMoldHalf(params, moldParams, isHalfA);
  let resultBrush = new Brush(baseGeometry);
  resultBrush.updateMatrixWorld();
  
  // Calculate key positions along the height
  const keyPositions = calculateKeyPositions(
    params.height,
    moldParams.registrationKeyCount,
    moldParams.baseThickness
  );
  
  // Position keys on the split face (where the two halves meet)
  // Keys go on the flat face at the split plane
  const splitRotation = moldParams.splitAngle * Math.PI / 180;
  
  // For each key position, add or subtract key geometry
  for (const yPos of keyPositions) {
    const y = yPos * SCALE;
    
    // Keys are positioned at the midpoint between inner and outer radius on split face
    const keyRadius = (innerRadius + outerRadius) / 2;
    
    // Two keys per height - one on each split edge (left and right of the half)
    const keyPositionsXZ = [
      // Left edge of split
      { x: Math.cos(splitRotation) * keyRadius, z: Math.sin(splitRotation) * keyRadius },
      // Right edge of split  
      { x: Math.cos(splitRotation + Math.PI) * keyRadius, z: Math.sin(splitRotation + Math.PI) * keyRadius },
    ];
    
    for (const pos of keyPositionsXZ) {
      const keyPos = new THREE.Vector3(pos.x, y, pos.z);
      
      // Half A gets pegs (protrusions), Half B gets sockets (indentations)
      const isSocket = !isHalfA;
      const keyBrush = createRegistrationKeyBrush(
        moldParams.registrationKeySize,
        keyDepth,
        keyPos,
        isSocket
      );
      
      if (isHalfA) {
        // Add pegs to half A
        resultBrush = evaluator.evaluate(resultBrush, keyBrush, ADDITION);
      } else {
        // Subtract sockets from half B
        resultBrush = evaluator.evaluate(resultBrush, keyBrush, SUBTRACTION);
      }
    }
  }
  
  // Add pour hole at the top
  const pourHoleDepth = moldParams.baseThickness + 5; // Goes through top into cavity
  const pourHoleBrush = createPourHoleBrush(
    moldParams.pourHoleDiameter,
    pourHoleDepth,
    height
  );
  
  resultBrush = evaluator.evaluate(resultBrush, pourHoleBrush, SUBTRACTION);
  
  // Get the final geometry
  const finalGeometry = resultBrush.geometry;
  finalGeometry.computeVertexNormals();
  
  return finalGeometry;
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
