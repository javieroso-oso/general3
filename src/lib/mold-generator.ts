import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { getBodyRadius, getMaxBodyRadius } from '@/lib/body-profile-generator';

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
  offset: number;               // mm - shrinkage/clearance offset
  // Enhancement parameters
  ventHolesEnabled: boolean;
  ventHoleCount: number;
  ventHoleDiameter: number;
  ventHolePosition: number;     // 0-1 along height
  spareEnabled: boolean;
  spareHeight: number;
  spareDiameter: number;        // 0 = auto
  strapNotchesEnabled: boolean;
  strapNotchCount: number;
  strapNotchWidth: number;
  strapNotchDepth: number;
}

export interface MoldGeometry {
  halfA: THREE.BufferGeometry;
  halfB: THREE.BufferGeometry;
}

/**
 * Ensure geometry has UV attribute (required for CSG operations)
 */
function ensureUVAttribute(geometry: THREE.BufferGeometry): void {
  if (!geometry.attributes.uv) {
    const positionCount = geometry.attributes.position.count;
    const uvs = new Float32Array(positionCount * 2);
    // Simple planar UV mapping
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positionCount; i++) {
      uvs[i * 2] = positions[i * 3] * 0.1;     // U based on X
      uvs[i * 2 + 1] = positions[i * 3 + 1] * 0.1; // V based on Y
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
}

/**
 * Calculate positions for registration keys along the split seam
 */
function calculateKeyPositions(
  height: number,
  keyCount: number,
  _baseThickness: number
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
  const tolerance = isSocket ? 0.003 : 0; // 0.3mm tolerance for socket
  
  const geometry = new THREE.CylinderGeometry(
    topRadius + tolerance,
    bottomRadius + tolerance,
    height,
    16
  );
  
  // Rotate to point outward from split face (along X axis)
  geometry.rotateZ(Math.PI / 2);
  
  // Ensure UV attribute exists
  ensureUVAttribute(geometry);
  
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
  
  // Ensure UV attribute exists
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.set(0, topY - holeDepth / 2 + 0.001, 0);
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Create vent hole brush for air escape during casting
 * Positioned at high points of the cavity to allow trapped air to escape
 */
function createVentHoleBrush(
  diameter: number,
  depth: number,
  position: THREE.Vector3,
  angle: number
): Brush {
  const radius = (diameter / 2) * SCALE;
  const holeDepth = depth * SCALE;
  
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius * 0.8, // Slight taper for better mold release
    holeDepth,
    12
  );
  
  // Angle the vent slightly upward (away from cavity)
  geometry.rotateZ(angle);
  
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.copy(position);
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Create spare/reservoir collar brush
 * A raised collar around the pour hole that acts as a slip reservoir
 */
function createSpareCollarBrush(
  innerDiameter: number,
  outerDiameter: number,
  height: number,
  topY: number
): Brush {
  const innerRadius = (innerDiameter / 2) * SCALE;
  const outerRadius = (outerDiameter / 2) * SCALE;
  const collarHeight = height * SCALE;
  
  // Create ring shape using lathe geometry
  const points = [
    new THREE.Vector2(innerRadius, 0),
    new THREE.Vector2(outerRadius, 0),
    new THREE.Vector2(outerRadius * 0.95, collarHeight * 0.3),
    new THREE.Vector2(outerRadius * 0.85, collarHeight),
    new THREE.Vector2(innerRadius * 1.1, collarHeight),
    new THREE.Vector2(innerRadius, 0),
  ];
  
  const geometry = new THREE.LatheGeometry(points, 32);
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.set(0, topY, 0);
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Create strap notch brush for rubber bands/straps
 * Grooves cut around the mold perimeter
 */
function createStrapNotchBrush(
  width: number,
  depth: number,
  moldRadius: number,
  y: number,
  angle: number
): Brush {
  const notchWidth = width * SCALE;
  const notchDepth = depth * SCALE;
  const radius = moldRadius * SCALE;
  
  // Create a box that will be subtracted
  const geometry = new THREE.BoxGeometry(
    notchDepth * 2,
    notchWidth,
    notchDepth * 2
  );
  
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.set(
    Math.cos(angle) * radius,
    y * SCALE,
    Math.sin(angle) * radius
  );
  brush.rotation.y = angle;
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Generate base mold half geometry (without keys and pour hole)
 * Uses the actual body profile from the parametric generator
 */
function generateBaseMoldHalf(
  params: ParametricParams,
  moldParams: MoldParams,
  isHalfA: boolean,
  objectType: ObjectType
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const wallThickness = moldParams.wallThickness * SCALE;
  const baseThickness = moldParams.baseThickness * SCALE;
  const offset = moldParams.offset * SCALE;
  const segments = 48;
  const rings = 64;
  
  const splitRotation = moldParams.splitAngle * Math.PI / 180;
  
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  const startAngle = isHalfA ? 0 : Math.PI;
  const endAngle = isHalfA ? Math.PI : Math.PI * 2;
  
  // Calculate max body radius for outer mold bounds
  const maxBodyRadius = getMaxBodyRadius(params, { scale: SCALE, objectType });
  const outerRadius = maxBodyRadius + wallThickness;
  
  // Generate inner surface (cavity) using actual body profile + offset + draft
  const innerVertexStart = vertices.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * height;
    
    // Draft angle offset - increases towards bottom for easier demolding
    const draftOffset = (1 - t) * Math.tan(moldParams.draftAngle * Math.PI / 180) * height;
    
    for (let j = 0; j <= segments / 2; j++) {
      const u = j / (segments / 2);
      const thetaRaw = startAngle + u * Math.PI;
      const theta = thetaRaw + splitRotation;
      
      // Get actual body radius at this point using the shared generator
      let radius = getBodyRadius(params, t, theta - splitRotation, { 
        scale: SCALE, 
        objectType,
        includeTwist: true 
      });
      
      // Add offset (shrinkage clearance) and draft
      radius += offset + draftOffset * 0.5;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      vertices.push(x, y, z);
      uvs.push(u, t);
    }
  }
  
  // Generate outer surface (simple cylinder/box)
  const outerVertexStart = vertices.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * height;
    
    for (let j = 0; j <= segments / 2; j++) {
      const u = j / (segments / 2);
      const thetaRaw = startAngle + u * Math.PI;
      const theta = thetaRaw + splitRotation;
      
      const x = Math.cos(theta) * outerRadius;
      const z = Math.sin(theta) * outerRadius;
      
      vertices.push(x, y, z);
      uvs.push(u + 1, t); // Offset U for outer surface
    }
  }
  
  const halfSegments = segments / 2;
  
  // Inner surface indices (facing inward toward cavity)
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
  
  // Outer surface indices (facing outward)
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
  
  // Split face - left edge (connects inner to outer)
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
  
  // Bottom face (base)
  const bottomVertexStart = vertices.length / 3;
  vertices.push(0, -baseThickness, 0);
  uvs.push(0.5, -0.1);
  const bottomCenter = bottomVertexStart;
  
  for (let j = 0; j <= halfSegments; j++) {
    const u = j / halfSegments;
    const thetaRaw = startAngle + u * Math.PI;
    const theta = thetaRaw + splitRotation;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, -baseThickness, z);
    uvs.push(u, -0.1);
  }
  
  for (let j = 0; j < halfSegments; j++) {
    const a = bottomCenter;
    const b = bottomVertexStart + 1 + j;
    const c = bottomVertexStart + 1 + j + 1;
    indices.push(a, c, b);
  }
  
  // Top face (rim)
  const topVertexStart = vertices.length / 3;
  vertices.push(0, height, 0);
  uvs.push(0.5, 1.1);
  const topCenter = topVertexStart;
  
  for (let j = 0; j <= halfSegments; j++) {
    const u = j / halfSegments;
    const thetaRaw = startAngle + u * Math.PI;
    const theta = thetaRaw + splitRotation;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, height, z);
    uvs.push(u, 1.1);
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
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
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
  isHalfA: boolean,
  objectType: ObjectType
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const offset = moldParams.offset * SCALE;
  
  // Get max radius using shared generator
  const maxBodyRadius = getMaxBodyRadius(params, { scale: SCALE, objectType });
  const outerRadius = maxBodyRadius + moldParams.wallThickness * SCALE;
  const innerRadius = maxBodyRadius + offset;
  const keyDepth = moldParams.registrationKeySize * 1.5; // Key depth in mm
  
  // Generate base mold geometry
  const baseGeometry = generateBaseMoldHalf(params, moldParams, isHalfA, objectType);
  
  // Try CSG operations, fall back to base geometry if they fail
  try {
    const evaluator = new Evaluator();
    let resultBrush = new Brush(baseGeometry);
    resultBrush.updateMatrixWorld();
    
    // Calculate key positions along the height
    const keyPositions = calculateKeyPositions(
      params.height,
      moldParams.registrationKeyCount,
      moldParams.baseThickness
    );
    
    // Position keys on the split face (where the two halves meet)
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
    
    // Add vent holes if enabled
    if (moldParams.ventHolesEnabled && moldParams.ventHoleCount > 0) {
      const ventY = height * moldParams.ventHolePosition;
      const ventDepth = moldParams.wallThickness + 5;
      const ventAngleStep = Math.PI / moldParams.ventHoleCount;
      
      for (let i = 0; i < moldParams.ventHoleCount; i++) {
        // Position vents on the back side of each half (opposite pour hole)
        const ventAngle = splitRotation + Math.PI / 2 + ventAngleStep * i - (Math.PI / 4);
        const ventRadius = outerRadius - moldParams.wallThickness * SCALE * 0.5;
        
        const ventPos = new THREE.Vector3(
          Math.cos(ventAngle) * ventRadius,
          ventY,
          Math.sin(ventAngle) * ventRadius
        );
        
        const ventBrush = createVentHoleBrush(
          moldParams.ventHoleDiameter,
          ventDepth,
          ventPos,
          -Math.PI / 6 // Angle slightly upward
        );
        
        resultBrush = evaluator.evaluate(resultBrush, ventBrush, SUBTRACTION);
      }
    }
    
    // Add spare collar if enabled
    if (moldParams.spareEnabled && moldParams.spareHeight > 0) {
      const spareDiameter = moldParams.spareDiameter > 0 
        ? moldParams.spareDiameter 
        : moldParams.pourHoleDiameter * 1.5;
      
      const spareBrush = createSpareCollarBrush(
        moldParams.pourHoleDiameter,
        spareDiameter,
        moldParams.spareHeight,
        height
      );
      
      resultBrush = evaluator.evaluate(resultBrush, spareBrush, ADDITION);
    }
    
    // Add strap notches if enabled
    if (moldParams.strapNotchesEnabled && moldParams.strapNotchCount > 0) {
      const notchY = height * 0.5; // Center of mold
      const moldOuterRadius = (outerRadius / SCALE) + moldParams.wallThickness;
      const notchAngleStep = Math.PI / moldParams.strapNotchCount;
      
      for (let i = 0; i < moldParams.strapNotchCount; i++) {
        const notchAngle = splitRotation + Math.PI / 2 + notchAngleStep * i;
        
        const notchBrush = createStrapNotchBrush(
          moldParams.strapNotchWidth,
          moldParams.strapNotchDepth,
          moldOuterRadius,
          notchY / SCALE,
          notchAngle
        );
        
        resultBrush = evaluator.evaluate(resultBrush, notchBrush, SUBTRACTION);
      }
    }
    
    // Get the final geometry
    const finalGeometry = resultBrush.geometry;
    finalGeometry.computeVertexNormals();
    
    return finalGeometry;
  } catch (error) {
    console.warn('CSG operations failed, using base geometry:', error);
    // Return base geometry without CSG modifications
    return baseGeometry;
  }
}

/**
 * Generate both mold halves
 */
export function generateMoldGeometry(
  params: ParametricParams,
  objectType: ObjectType
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
    offset: params.moldOffset ?? 0.5,
    ventHolesEnabled: params.moldVentHolesEnabled ?? false,
    ventHoleCount: params.moldVentHoleCount ?? 4,
    ventHoleDiameter: params.moldVentHoleDiameter ?? 3,
    ventHolePosition: params.moldVentHolePosition ?? 0.8,
    spareEnabled: params.moldSpareEnabled ?? false,
    spareHeight: params.moldSpareHeight ?? 20,
    spareDiameter: params.moldSpareDiameter ?? 0,
    strapNotchesEnabled: params.moldStrapNotchesEnabled ?? false,
    strapNotchCount: params.moldStrapNotchCount ?? 2,
    strapNotchWidth: params.moldStrapNotchWidth ?? 12,
    strapNotchDepth: params.moldStrapNotchDepth ?? 4,
  };
  
  const halfA = generateMoldHalf(params, moldParams, true, objectType);
  const halfB = generateMoldHalf(params, moldParams, false, objectType);
  
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
  
  // Dispose geometries
  halfA.dispose();
  halfB.dispose();
}
