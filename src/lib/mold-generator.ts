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

export interface MultiPartMoldGeometry {
  parts: THREE.BufferGeometry[];
  partAngles: number[];  // Starting angle for each part in radians
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
 * @param splitAngle - The angle of the split face in radians, used to orient the key perpendicular to the split
 */
function createRegistrationKeyBrush(
  size: number,
  keyHeight: number,
  position: THREE.Vector3,
  isSocket: boolean,
  splitAngle: number
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
  
  // Rotate to point outward from split face (along X axis initially)
  geometry.rotateZ(Math.PI / 2);
  
  // Ensure UV attribute exists
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.copy(position);
  // Rotate around Y axis to align perpendicular to the split face at this angle
  brush.rotation.y = splitAngle;
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Generate pour hole brush at the top of the mold
 * The hole is tapered - wider at the top (opening) for easy pouring,
 * narrower at the bottom (into cavity)
 */
function createPourHoleBrush(
  diameter: number,
  depth: number,
  topY: number
): Brush {
  const radius = (diameter / 2) * SCALE;
  const holeDepth = depth * SCALE;
  
  // Tapered pour hole - wider at top (opening), narrower into cavity
  const topRadius = radius * 1.3;    // Wide opening at pour spout
  const bottomRadius = radius;       // Standard size into cavity
  
  // CylinderGeometry: (radiusTop, radiusBottom, height, segments)
  // The "top" of the cylinder is at +Y, which is the top of our mold (the opening)
  const geometry = new THREE.CylinderGeometry(
    topRadius,      // radiusTop - wide opening at pour spout (top of mold)
    bottomRadius,   // radiusBottom - standard size into cavity
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
/**
 * Create vent hole brush for air escape during casting
 * Positioned at high points of the cavity to allow trapped air to escape
 * @param diameter - vent hole diameter in mm
 * @param depth - depth of the vent hole in mm
 * @param position - 3D position of the vent
 * @param tiltAngle - upward tilt angle (radians)
 * @param radialAngle - angle around Y axis for radial direction (radians)
 */
function createVentHoleBrush(
  diameter: number,
  depth: number,
  position: THREE.Vector3,
  tiltAngle: number,
  radialAngle: number
): Brush {
  const radius = (diameter / 2) * SCALE;
  const holeDepth = depth * SCALE;
  
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius * 0.8, // Slight taper for better mold release
    holeDepth,
    12
  );
  
  // Rotate cylinder to point along X-axis (radial direction), then apply upward tilt
  geometry.rotateZ(Math.PI / 2);  // Point along X (radial outward)
  geometry.rotateY(tiltAngle);    // Tilt slightly upward
  
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.copy(position);
  // Rotate around Y to point radially outward at the specific angle
  brush.rotation.y = radialAngle;
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
  
  // Inner surface indices (facing outward - into the mold solid, away from cavity)
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < halfSegments; j++) {
      const a = innerVertexStart + i * (halfSegments + 1) + j;
      const b = a + halfSegments + 1;
      const c = a + 1;
      const d = b + 1;
      
      // Reversed winding for outward-facing normals
      indices.push(a, c, b);
      indices.push(c, d, b);
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
  
  // ========== BOTTOM FACE (BASE) - SOLID FLAT ==========
  // The bottom should be a solid disk from center to outer ring
  // The cavity stops at y=0, creating a solid flat base
  
  // Get inner bottom ring vertex indices (first ring of inner surface at y=0)
  const innerBottomRing: number[] = [];
  for (let j = 0; j <= halfSegments; j++) {
    innerBottomRing.push(innerVertexStart + j);
  }
  
  // Outer ring at base level (y=-baseThickness)
  const bottomOuterRingStart = vertices.length / 3;
  for (let j = 0; j <= halfSegments; j++) {
    const u = j / halfSegments;
    const thetaRaw = startAngle + u * Math.PI;
    const theta = thetaRaw + splitRotation;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, -baseThickness, z);
    uvs.push(u, -0.1);
  }
  
  // Center point at base level - positioned at origin
  const baseCenterStart = vertices.length / 3;
  vertices.push(0, -baseThickness, 0);
  uvs.push(0.5, -0.1);
  
  // Bottom face: Create solid triangular fan from center DIRECTLY to outer ring
  // This creates a completely solid flat base (no hollow area)
  for (let j = 0; j < halfSegments; j++) {
    const a = baseCenterStart;
    const b = bottomOuterRingStart + j;
    const c = bottomOuterRingStart + j + 1;
    indices.push(a, c, b); // Face downward (normal pointing -Y)
  }
  
  // Connect inner cavity bottom (y=0) to outer base ring (y=-baseThickness)
  // This creates a sloped inner wall connecting cavity floor to base bottom
  for (let j = 0; j < halfSegments; j++) {
    const topA = innerBottomRing[j];
    const topB = innerBottomRing[j + 1];
    const bottomA = bottomOuterRingStart + j;
    const bottomB = bottomOuterRingStart + j + 1;
    
    // Face inward (toward cavity)
    indices.push(topA, topB, bottomA);
    indices.push(topB, bottomB, bottomA);
  }
  
  // Connect outer surface bottom (y=0) to outer base ring (y=-baseThickness)
  for (let j = 0; j < halfSegments; j++) {
    const topOuter = outerVertexStart + j;
    const topOuterNext = outerVertexStart + j + 1;
    const bottomOuter = bottomOuterRingStart + j;
    const bottomOuterNext = bottomOuterRingStart + j + 1;
    
    indices.push(topOuter, bottomOuter, topOuterNext);
    indices.push(topOuterNext, bottomOuter, bottomOuterNext);
  }
  
  // ========== TOP FACE (RIM) - WATERTIGHT ==========
  // The top connects outer rim to inner cavity opening
  
  // Get inner top ring vertex indices (last ring of inner surface at y=height)
  const innerTopRing: number[] = [];
  for (let j = 0; j <= halfSegments; j++) {
    innerTopRing.push(innerVertexStart + rings * (halfSegments + 1) + j);
  }
  
  // Outer top ring vertices (at outer radius, y=height)
  const topVertexStart = vertices.length / 3;
  for (let j = 0; j <= halfSegments; j++) {
    const u = j / halfSegments;
    const thetaRaw = startAngle + u * Math.PI;
    const theta = thetaRaw + splitRotation;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, height, z);
    uvs.push(u, 1.1);
  }
  
  // Top rim: connect inner top ring to outer top ring
  for (let j = 0; j < halfSegments; j++) {
    const innerA = innerTopRing[j];
    const innerB = innerTopRing[j + 1];
    const outerA = topVertexStart + j;
    const outerB = topVertexStart + j + 1;
    
    // Face upward
    indices.push(innerA, innerB, outerA);
    indices.push(innerB, outerB, outerA);
  }
  
  // Connect outer surface top ring to the top rim outer vertices
  const outerTopRing = outerVertexStart + rings * (halfSegments + 1);
  for (let j = 0; j < halfSegments; j++) {
    const surfaceA = outerTopRing + j;
    const surfaceB = outerTopRing + j + 1;
    const rimA = topVertexStart + j;
    const rimB = topVertexStart + j + 1;
    
    indices.push(surfaceA, rimA, surfaceB);
    indices.push(surfaceB, rimA, rimB);
  }
  
  // ========== SPLIT FACE CLOSURES - FULL VERTICAL WALLS ==========
  // These close the left and right edges of the half-mold from top to bottom
  // With solid base, the split faces go from center -> innerBottom (y=0) -> outerBottom -> base outer
  
  // Left split edge indices
  const leftInnerBottom = innerBottomRing[0];
  const leftOuterBottom = outerVertexStart;
  const leftBaseOuter = bottomOuterRingStart;
  const leftInnerTop = innerTopRing[0];
  const leftOuterTop = outerTopRing;
  const leftRimOuter = topVertexStart;
  
  // Right split edge indices
  const rightInnerBottom = innerBottomRing[halfSegments];
  const rightOuterBottom = outerVertexStart + halfSegments;
  const rightBaseOuter = bottomOuterRingStart + halfSegments;
  const rightInnerTop = innerTopRing[halfSegments];
  const rightOuterTop = outerTopRing + halfSegments;
  const rightRimOuter = topVertexStart + halfSegments;
  
  // LEFT SPLIT FACE - Full vertical wall from base to rim
  // Bottom section: center -> innerBottom (cavity at y=0) -> outerBottom (outer at y=0) -> baseOuter (at y=-baseThickness)
  // Triangle from center to inner cavity bottom
  indices.push(baseCenterStart, leftBaseOuter, leftInnerBottom);
  
  // Quad from inner cavity (y=0) to outer wall (y=0)
  indices.push(leftInnerBottom, leftBaseOuter, leftOuterBottom);
  
  // Cavity bottom to cavity top: innerBottom -> innerTop, outerBottom -> outerTop (main wall)
  for (let i = 0; i < rings; i++) {
    const innerA = innerVertexStart + i * (halfSegments + 1);
    const innerB = innerVertexStart + (i + 1) * (halfSegments + 1);
    const outerA = outerVertexStart + i * (halfSegments + 1);
    const outerB = outerVertexStart + (i + 1) * (halfSegments + 1);
    
    // Quad from inner edge to outer edge
    indices.push(innerA, outerA, innerB);
    indices.push(innerB, outerA, outerB);
  }
  
  // Top section: innerTop -> outerTop -> rimOuter
  indices.push(leftInnerTop, leftOuterTop, leftRimOuter);
  
  // RIGHT SPLIT FACE - Full vertical wall from base to rim (opposite winding)
  // Triangle from center to inner cavity bottom
  indices.push(baseCenterStart, rightInnerBottom, rightBaseOuter);
  
  // Quad from inner cavity (y=0) to outer wall (y=0)
  indices.push(rightInnerBottom, rightOuterBottom, rightBaseOuter);
  
  // Cavity bottom to cavity top (main wall)
  for (let i = 0; i < rings; i++) {
    const innerA = innerVertexStart + i * (halfSegments + 1) + halfSegments;
    const innerB = innerVertexStart + (i + 1) * (halfSegments + 1) + halfSegments;
    const outerA = outerVertexStart + i * (halfSegments + 1) + halfSegments;
    const outerB = outerVertexStart + (i + 1) * (halfSegments + 1) + halfSegments;
    
    // Quad from inner edge to outer edge (opposite winding)
    indices.push(innerA, innerB, outerA);
    indices.push(innerB, outerB, outerA);
  }
  
  // Top section
  indices.push(rightInnerTop, rightRimOuter, rightOuterTop);
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
        { x: Math.cos(splitRotation) * keyRadius, z: Math.sin(splitRotation) * keyRadius, angle: splitRotation },
        // Right edge of split  
        { x: Math.cos(splitRotation + Math.PI) * keyRadius, z: Math.sin(splitRotation + Math.PI) * keyRadius, angle: splitRotation + Math.PI },
      ];
      
      for (const pos of keyPositionsXZ) {
        const keyPos = new THREE.Vector3(pos.x, y, pos.z);
        
        // Half A gets pegs (protrusions), Half B gets sockets (indentations)
        const isSocket = !isHalfA;
        const keyBrush = createRegistrationKeyBrush(
          moldParams.registrationKeySize,
          keyDepth,
          keyPos,
          isSocket,
          pos.angle + Math.PI / 2 // Perpendicular to split face
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
    
    // Add pour hole at the top - must go through wall into cavity
    // Depth needs to penetrate wall thickness plus some margin into cavity space
    const pourHoleDepth = moldParams.wallThickness + 10;
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
          -Math.PI / 6, // Upward tilt
          ventAngle     // Radial direction
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
    console.error('CSG operations failed for mold half:', {
      error,
      params: {
        height: params.height,
        wallThickness: moldParams.wallThickness,
        pourHoleDiameter: moldParams.pourHoleDiameter,
        keyCount: moldParams.registrationKeyCount,
      }
    });
    // Return base geometry without CSG modifications
    return baseGeometry;
  }
}

/**
 * Generate both mold halves (legacy 2-part function)
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
 * Generate multi-part mold geometry (2, 3, or 4 parts)
 */
export function generateMultiPartMoldGeometry(
  params: ParametricParams,
  objectType: ObjectType
): MultiPartMoldGeometry {
  const partCount = params.moldPartCount || 2;
  const anglePerPart = (Math.PI * 2) / partCount;
  const partAngles: number[] = [];
  const parts: THREE.BufferGeometry[] = [];
  
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
  
  for (let i = 0; i < partCount; i++) {
    const startAngle = anglePerPart * i;
    partAngles.push(startAngle);
    
    const partGeometry = generateMoldPart(
      params,
      moldParams,
      startAngle,
      startAngle + anglePerPart,
      i,
      partCount,
      objectType
    );
    parts.push(partGeometry);
  }
  
  return { parts, partAngles };
}

/**
 * Generate base geometry for a single mold part (without CSG features)
 */
function generateBaseMoldPart(
  params: ParametricParams,
  moldParams: MoldParams,
  startAngle: number,
  endAngle: number,
  objectType: ObjectType
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const wallThickness = moldParams.wallThickness * SCALE;
  const baseThickness = moldParams.baseThickness * SCALE;
  const offset = moldParams.offset * SCALE;
  const segments = 48;
  const rings = 64;
  
  const splitRotation = moldParams.splitAngle * Math.PI / 180;
  const adjustedStartAngle = startAngle + splitRotation;
  const adjustedEndAngle = endAngle + splitRotation;
  const angleSpan = endAngle - startAngle;
  
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  // Calculate segments for this part (proportional to angle)
  const partSegments = Math.floor(segments * (angleSpan / (Math.PI * 2)));
  
  // Calculate max body radius for outer mold bounds
  const maxBodyRadius = getMaxBodyRadius(params, { scale: SCALE, objectType });
  const outerRadius = maxBodyRadius + wallThickness;
  
  // Generate inner surface (cavity)
  const innerVertexStart = vertices.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = t * height;
    const draftOffset = (1 - t) * Math.tan(moldParams.draftAngle * Math.PI / 180) * height;
    
    for (let j = 0; j <= partSegments; j++) {
      const u = j / partSegments;
      const theta = adjustedStartAngle + u * angleSpan;
      const thetaRaw = theta - splitRotation;
      
      let radius = getBodyRadius(params, t, thetaRaw, { 
        scale: SCALE, 
        objectType,
        includeTwist: true 
      });
      radius += offset + draftOffset * 0.5;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      vertices.push(x, y, z);
      uvs.push(u, t);
    }
  }
  
  // Top wall thickness - extends mold above cavity to provide material for pour hole
  const topWallThickness = wallThickness;
  const moldTotalHeight = height + topWallThickness;
  
  // Generate outer surface - extends to moldTotalHeight (above cavity)
  const outerVertexStart = vertices.length / 3;
  const outerRings = rings + Math.ceil(rings * (topWallThickness / height)); // Extra rings for top wall
  for (let i = 0; i <= outerRings; i++) {
    const t = i / outerRings;
    const y = t * moldTotalHeight;
    
    for (let j = 0; j <= partSegments; j++) {
      const u = j / partSegments;
      const theta = adjustedStartAngle + u * angleSpan;
      
      const x = Math.cos(theta) * outerRadius;
      const z = Math.sin(theta) * outerRadius;
      
      vertices.push(x, y, z);
      uvs.push(u + 1, t);
    }
  }
  
  // Inner surface indices (facing outward - into the mold solid, away from cavity)
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < partSegments; j++) {
      const a = innerVertexStart + i * (partSegments + 1) + j;
      const b = a + partSegments + 1;
      const c = a + 1;
      const d = b + 1;
      
      // Reversed winding for outward-facing normals
      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }
  
  // Outer surface indices
  for (let i = 0; i < outerRings; i++) {
    for (let j = 0; j < partSegments; j++) {
      const a = outerVertexStart + i * (partSegments + 1) + j;
      const b = a + partSegments + 1;
      const c = a + 1;
      const d = b + 1;
      
      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }
  
  // Split faces (left and right edges)
  const leftEdgeInner: number[] = [];
  const leftEdgeOuter: number[] = [];
  const rightEdgeInner: number[] = [];
  const rightEdgeOuter: number[] = [];
  
  for (let i = 0; i <= rings; i++) {
    leftEdgeInner.push(innerVertexStart + i * (partSegments + 1));
    leftEdgeOuter.push(outerVertexStart + i * (partSegments + 1));
    rightEdgeInner.push(innerVertexStart + i * (partSegments + 1) + partSegments);
    rightEdgeOuter.push(outerVertexStart + i * (partSegments + 1) + partSegments);
  }
  
  // Left split face
  for (let i = 0; i < rings; i++) {
    const a = leftEdgeInner[i];
    const b = leftEdgeInner[i + 1];
    const c = leftEdgeOuter[i];
    const d = leftEdgeOuter[i + 1];
    
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  // Right split face
  for (let i = 0; i < rings; i++) {
    const a = rightEdgeInner[i];
    const b = rightEdgeInner[i + 1];
    const c = rightEdgeOuter[i];
    const d = rightEdgeOuter[i + 1];
    
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  
  // ========== BOTTOM FACE (BASE) - SOLID FLAT ==========
  // The bottom should be a solid disk from center to outer ring
  // The cavity stops at y=0, creating a solid flat base
  
  const innerBottomRing: number[] = [];
  for (let j = 0; j <= partSegments; j++) {
    innerBottomRing.push(innerVertexStart + j);
  }
  
  // Outer ring at base level
  const bottomOuterRingStart = vertices.length / 3;
  for (let j = 0; j <= partSegments; j++) {
    const u = j / partSegments;
    const theta = adjustedStartAngle + u * angleSpan;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, -baseThickness, z);
    uvs.push(u, -0.1);
  }
  
  // Center point at base level
  const baseCenterStart = vertices.length / 3;
  vertices.push(0, -baseThickness, 0);
  uvs.push(0.5, -0.1);
  
  // Bottom face: Create solid triangular fan from center DIRECTLY to outer ring
  // This creates a completely solid flat base (no hollow area)
  for (let j = 0; j < partSegments; j++) {
    const a = baseCenterStart;
    const b = bottomOuterRingStart + j;
    const c = bottomOuterRingStart + j + 1;
    indices.push(a, c, b); // Face downward (normal pointing -Y)
  }
  
  // Connect inner cavity bottom (y=0) to outer base ring (y=-baseThickness)
  // This creates a sloped inner wall connecting cavity floor to base bottom
  for (let j = 0; j < partSegments; j++) {
    const topA = innerBottomRing[j];
    const topB = innerBottomRing[j + 1];
    const bottomA = bottomOuterRingStart + j;
    const bottomB = bottomOuterRingStart + j + 1;
    
    indices.push(topA, topB, bottomA);
    indices.push(topB, bottomB, bottomA);
  }
  
  // Connect outer surface bottom to outer base ring
  for (let j = 0; j < partSegments; j++) {
    const topOuter = outerVertexStart + j;
    const topOuterNext = outerVertexStart + j + 1;
    const bottomOuter = bottomOuterRingStart + j;
    const bottomOuterNext = bottomOuterRingStart + j + 1;
    
    indices.push(topOuter, bottomOuter, topOuterNext);
    indices.push(topOuterNext, bottomOuter, bottomOuterNext);
  }
  
  // Inner cavity top ring (at cavity height)
  const innerTopRing: number[] = [];
  for (let j = 0; j <= partSegments; j++) {
    innerTopRing.push(innerVertexStart + rings * (partSegments + 1) + j);
  }
  
  // ========== TOP WALL GEOMETRY ==========
  // Create inner vertical wall from cavity top (height) to mold top (moldTotalHeight)
  const innerTopWallStart = vertices.length / 3;
  for (let j = 0; j <= partSegments; j++) {
    const u = j / partSegments;
    const theta = adjustedStartAngle + u * angleSpan;
    
    // Get cavity radius at top
    const thetaRaw = theta - splitRotation;
    let cavityRadius = getBodyRadius(params, 1.0, thetaRaw, { 
      scale: SCALE, 
      objectType,
      includeTwist: true 
    });
    cavityRadius += offset;
    
    // Bottom of top wall (at cavity height)
    vertices.push(Math.cos(theta) * cavityRadius, height, Math.sin(theta) * cavityRadius);
    uvs.push(u, 1.0);
    
    // Top of top wall (at mold total height) - same radius, creates vertical wall
    vertices.push(Math.cos(theta) * cavityRadius, moldTotalHeight, Math.sin(theta) * cavityRadius);
    uvs.push(u, 1.1);
  }
  
  // Inner top wall surface (vertical wall around cavity opening)
  for (let j = 0; j < partSegments; j++) {
    const bottomA = innerTopWallStart + j * 2;
    const topA = innerTopWallStart + j * 2 + 1;
    const bottomB = innerTopWallStart + (j + 1) * 2;
    const topB = innerTopWallStart + (j + 1) * 2 + 1;
    
    // Facing inward (into cavity)
    indices.push(bottomA, topA, bottomB);
    indices.push(topA, topB, bottomB);
  }
  
  // ========== TOP SURFACE (SOLID CAP AT MOLD TOP) ==========
  // Outer ring at mold top height
  const topOuterRingStart = vertices.length / 3;
  for (let j = 0; j <= partSegments; j++) {
    const u = j / partSegments;
    const theta = adjustedStartAngle + u * angleSpan;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    vertices.push(x, moldTotalHeight, z);
    uvs.push(u, 1.2);
  }
  
  // Inner ring at mold top (reuse the top vertices from top wall)
  // Connect outer top ring to inner top ring (the top of the vertical wall)
  for (let j = 0; j < partSegments; j++) {
    const outerA = topOuterRingStart + j;
    const outerB = topOuterRingStart + j + 1;
    const innerA = innerTopWallStart + j * 2 + 1; // Top vertex of inner wall
    const innerB = innerTopWallStart + (j + 1) * 2 + 1;
    
    // Top surface facing up
    indices.push(outerA, innerA, outerB);
    indices.push(outerB, innerA, innerB);
  }
  
  // ========== TOP CENTER CAP - Fills center for pour hole CSG ==========
  // Add a solid cap from inner top ring to center at mold top height
  const topCenterStart = vertices.length / 3;
  vertices.push(0, moldTotalHeight, 0);
  uvs.push(0.5, 1.0);
  
  // Create triangular fan from center to inner top ring at mold top (facing up)
  for (let j = 0; j < partSegments; j++) {
    const innerA = innerTopWallStart + j * 2 + 1;
    const innerB = innerTopWallStart + (j + 1) * 2 + 1;
    indices.push(topCenterStart, innerA, innerB);
  }
  
  // Connect outer surface top to top outer ring
  const outerSurfaceTopRing = outerVertexStart + outerRings * (partSegments + 1);
  for (let j = 0; j < partSegments; j++) {
    const surfaceA = outerSurfaceTopRing + j;
    const surfaceB = outerSurfaceTopRing + j + 1;
    const topA = topOuterRingStart + j;
    const topB = topOuterRingStart + j + 1;
    
    indices.push(surfaceA, topA, surfaceB);
    indices.push(surfaceB, topA, topB);
  }
  
  // ========== SPLIT FACE CLOSURES - FULL VERTICAL WALLS ==========
  // With solid base, split faces go from center -> innerBottom (y=0) -> outerBottom -> base outer
  
  const leftInnerBottom = innerBottomRing[0];
  const leftOuterBottom = outerVertexStart;
  const leftBaseOuter = bottomOuterRingStart;
  const leftInnerTop = innerTopRing[0];
  const leftRimOuter = topOuterRingStart;
  
  const rightInnerBottom = innerBottomRing[partSegments];
  const rightOuterBottom = outerVertexStart + partSegments;
  const rightBaseOuter = bottomOuterRingStart + partSegments;
  const rightInnerTop = innerTopRing[partSegments];
  const rightRimOuter = topOuterRingStart + partSegments;
  
  // Left split face closure
  // Triangle from center to inner cavity bottom
  indices.push(baseCenterStart, leftBaseOuter, leftInnerBottom);
  // Quad from inner cavity (y=0) to outer wall (y=0)
  indices.push(leftInnerBottom, leftBaseOuter, leftOuterBottom);
  
  for (let i = 0; i < rings; i++) {
    const innerA = innerVertexStart + i * (partSegments + 1);
    const innerB = innerVertexStart + (i + 1) * (partSegments + 1);
    const outerA = outerVertexStart + i * (partSegments + 1);
    const outerB = outerVertexStart + (i + 1) * (partSegments + 1);
    
    indices.push(innerA, outerA, innerB);
    indices.push(innerB, outerA, outerB);
  }
  
  indices.push(leftInnerTop, outerVertexStart + rings * (partSegments + 1), leftRimOuter);
  
  // Right split face closure
  // Triangle from center to inner cavity bottom
  indices.push(baseCenterStart, rightInnerBottom, rightBaseOuter);
  // Quad from inner cavity (y=0) to outer wall (y=0)
  indices.push(rightInnerBottom, rightOuterBottom, rightBaseOuter);
  
  for (let i = 0; i < rings; i++) {
    const innerA = innerVertexStart + i * (partSegments + 1) + partSegments;
    const innerB = innerVertexStart + (i + 1) * (partSegments + 1) + partSegments;
    const outerA = outerVertexStart + i * (partSegments + 1) + partSegments;
    const outerB = outerVertexStart + (i + 1) * (partSegments + 1) + partSegments;
    
    indices.push(innerA, innerB, outerA);
    indices.push(innerB, outerB, outerA);
  }
  
  indices.push(rightInnerTop, rightRimOuter, outerVertexStart + rings * (partSegments + 1) + partSegments);
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Generate a single mold part with CSG features (registration keys, pour hole, etc.)
 */
function generateMoldPart(
  params: ParametricParams,
  moldParams: MoldParams,
  startAngle: number,
  endAngle: number,
  partIndex: number,
  totalParts: number,
  objectType: ObjectType
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const offset = moldParams.offset * SCALE;
  const angleSpan = endAngle - startAngle;
  const splitRotation = moldParams.splitAngle * Math.PI / 180;
  const adjustedStartAngle = startAngle + splitRotation;
  const adjustedEndAngle = endAngle + splitRotation;
  
  // Get max radius for key positioning
  const maxBodyRadius = getMaxBodyRadius(params, { scale: SCALE, objectType });
  const outerRadius = maxBodyRadius + moldParams.wallThickness * SCALE;
  const innerRadius = maxBodyRadius + offset;
  const keyDepth = moldParams.registrationKeySize * 1.5;
  
  // Generate base geometry
  const baseGeometry = generateBaseMoldPart(params, moldParams, startAngle, endAngle, objectType);
  
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
    
    // Position keys on split faces
    const keyRadius = (innerRadius + outerRadius) / 2;
    
    for (const yPos of keyPositions) {
      const y = yPos * SCALE;
      
      // Left edge: this part has pegs (protrusions)
      const leftAngle = adjustedStartAngle;
      const leftKeyPos = new THREE.Vector3(
        Math.cos(leftAngle) * keyRadius,
        y,
        Math.sin(leftAngle) * keyRadius
      );
      
      // Keys point perpendicular to split face (add PI/2 to split angle)
      const leftKeyBrush = createRegistrationKeyBrush(
        moldParams.registrationKeySize,
        keyDepth,
        leftKeyPos,
        false, // peg (protrusion)
        leftAngle + Math.PI / 2 // Perpendicular to left split face
      );
      resultBrush = evaluator.evaluate(resultBrush, leftKeyBrush, ADDITION);
      
      // Right edge: this part has sockets (receives neighbor's pegs)
      const rightAngle = adjustedEndAngle;
      const rightKeyPos = new THREE.Vector3(
        Math.cos(rightAngle) * keyRadius,
        y,
        Math.sin(rightAngle) * keyRadius
      );
      
      const rightKeyBrush = createRegistrationKeyBrush(
        moldParams.registrationKeySize,
        keyDepth,
        rightKeyPos,
        true, // socket (indentation)
        rightAngle + Math.PI / 2 // Perpendicular to right split face
      );
      resultBrush = evaluator.evaluate(resultBrush, rightKeyBrush, SUBTRACTION);
    }
    
    // Add pour hole at top center - positioned at mold top (height + top wall thickness)
    const pourHoleDepth = moldParams.wallThickness + 10;
    const moldTopY = height + (moldParams.wallThickness * SCALE);
    const pourHoleBrush = createPourHoleBrush(
      moldParams.pourHoleDiameter,
      pourHoleDepth,
      moldTopY / SCALE // Convert back to mm for the brush function
    );
    resultBrush = evaluator.evaluate(resultBrush, pourHoleBrush, SUBTRACTION);
    
    // Add spare collar only on first part to avoid duplication
    if (partIndex === 0 && moldParams.spareEnabled && moldParams.spareHeight > 0) {
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
    
    // Add vent holes if enabled (distributed across parts based on angle)
    if (moldParams.ventHolesEnabled && moldParams.ventHoleCount > 0) {
      const ventY = height * moldParams.ventHolePosition;
      const ventDepth = moldParams.wallThickness + 5;
      
      // Distribute vents evenly around the full 360°
      const ventAngleStep = (Math.PI * 2) / moldParams.ventHoleCount;
      
      for (let i = 0; i < moldParams.ventHoleCount; i++) {
        // Calculate vent angle in world space (offset by 0.5 to center in each segment)
        const ventWorldAngle = splitRotation + ventAngleStep * (i + 0.5);
        
        // Check if this vent falls within this part's angular range
        const normalizedVentAngle = ((ventWorldAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const normalizedStart = ((adjustedStartAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const normalizedEnd = ((adjustedEndAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        
        // Handle wraparound case (e.g., part spans from 270° to 90°)
        const inRange = normalizedEnd > normalizedStart
          ? (normalizedVentAngle >= normalizedStart && normalizedVentAngle < normalizedEnd)
          : (normalizedVentAngle >= normalizedStart || normalizedVentAngle < normalizedEnd);
        
        if (inRange) {
          const ventRadius = outerRadius - moldParams.wallThickness * SCALE * 0.5;
          
          const ventPos = new THREE.Vector3(
            Math.cos(ventWorldAngle) * ventRadius,
            ventY,
            Math.sin(ventWorldAngle) * ventRadius
          );
          
          const ventBrush = createVentHoleBrush(
            moldParams.ventHoleDiameter,
            ventDepth,
            ventPos,
            -Math.PI / 6,   // Upward tilt
            ventWorldAngle  // Radial direction (point outward)
          );
          
          resultBrush = evaluator.evaluate(resultBrush, ventBrush, SUBTRACTION);
        }
      }
    }
    
    // Add strap notches if enabled (distributed across parts)
    if (moldParams.strapNotchesEnabled && moldParams.strapNotchCount > 0) {
      const notchesPerPart = Math.ceil(moldParams.strapNotchCount / totalParts);
      const notchY = height * 0.5;
      const moldOuterRadius = (outerRadius / SCALE) + moldParams.wallThickness;
      
      for (let i = 0; i < notchesPerPart; i++) {
        const notchProgress = (i + 0.5) / notchesPerPart;
        const notchAngle = adjustedStartAngle + angleSpan * notchProgress;
        
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
    
    const finalGeometry = resultBrush.geometry;
    finalGeometry.computeVertexNormals();
    
    return finalGeometry;
  } catch (error) {
    console.error('CSG operations failed for mold part:', {
      error,
      partIndex,
      totalParts,
      params: {
        height: params.height,
        wallThickness: moldParams.wallThickness,
        pourHoleDiameter: moldParams.pourHoleDiameter,
      }
    });
    return baseGeometry;
  }
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
 * Download mold STL files (2-part legacy)
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

/**
 * Download multi-part mold STL files
 */
export function downloadMultiPartMoldSTL(
  params: ParametricParams,
  objectType: ObjectType,
  partIndex: number | 'all',
  baseName: string
): void {
  const { parts } = generateMultiPartMoldGeometry(params, objectType);
  const partLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  
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
  
  if (partIndex === 'all') {
    parts.forEach((geometry, index) => {
      const blob = exportMoldHalfToSTL(geometry);
      downloadBlob(blob, `${baseName}_mold_${partLabels[index]}.stl`);
    });
  } else if (partIndex >= 0 && partIndex < parts.length) {
    const blob = exportMoldHalfToSTL(parts[partIndex]);
    downloadBlob(blob, `${baseName}_mold_${partLabels[partIndex]}.stl`);
  }
  
  // Dispose geometries
  parts.forEach(geometry => geometry.dispose());
}
