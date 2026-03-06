import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { getBodyRadius, getMaxBodyRadius } from '@/lib/body-profile-generator';
import { calculateOptimalSplits } from '@/lib/mold-undercut-detector';

// Scale factor: mm to scene units
const SCALE = 0.01;

export interface MoldParams {
  wallThickness: number;        // mm
  baseThickness: number;        // mm
  pourHoleDiameter: number;     // mm
  pourHoleTaper: number;        // degrees (5-30) - funnel taper angle
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
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positionCount; i++) {
      uvs[i * 2] = positions[i * 3] * 0.1;
      uvs[i * 2 + 1] = positions[i * 3 + 1] * 0.1;
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
 * Create registration key geometry that points RADIALLY
 * 
 * Keys point RADIALLY (toward or away from center) so that:
 * - Pegs on left edge point INTO the previous part (counter-clockwise neighbor)
 * - Sockets on right edge RECEIVE pegs from next part (clockwise neighbor)
 * 
 * When mold parts separate radially outward, the keys slide apart cleanly.
 * 
 * @param size - Key diameter in mm
 * @param keyHeight - Key length in mm
 * @param position - Position on the split face
 * @param isSocket - If true, creates a socket (hole); if false, creates a peg
 * @param splitAngle - The angle of the split face in radians
 * @param isLeftEdge - If true, key is on left/start edge; if false, on right/end edge
 */
function createRegistrationKeyBrush(
  size: number,
  keyHeight: number,
  position: THREE.Vector3,
  isSocket: boolean,
  splitAngle: number,
  isLeftEdge: boolean
): Brush {
  // Tapered cylinder for better alignment
  const topRadius = size * 0.7 * SCALE;
  const bottomRadius = size * SCALE;
  const height = keyHeight * SCALE;
  
  // Tolerance for socket (0.5mm clearance for 3D printed molds)
  const tolerance = isSocket ? 0.005 : 0;
  
  const geometry = new THREE.CylinderGeometry(
    topRadius + tolerance,
    bottomRadius + tolerance,
    height,
    16
  );
  
  // Cylinder is created along Y axis. We need it to point radially.
  // First, rotate so it points along +X (horizontal, radially outward)
  geometry.rotateZ(Math.PI / 2);
  
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.copy(position);
  
  // For left edge pegs: point perpendicular to split face toward the previous part
  // For right edge sockets: oriented to receive pegs from the next part
  // The key should be perpendicular to the split face.
  // splitAngle is the angle OF the split face.
  // To point perpendicular INTO the neighbor: 
  //   Left edge (peg): rotate to (splitAngle - PI/2) to point counter-clockwise
  //   Right edge (socket): rotate to (splitAngle + PI/2) to receive from clockwise
  if (isLeftEdge) {
    // Peg on left edge points into the counter-clockwise neighbor
    brush.rotation.y = splitAngle - Math.PI / 2;
  } else {
    // Socket on right edge receives peg from clockwise neighbor
    brush.rotation.y = splitAngle + Math.PI / 2;
  }
  
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Create funnel-shaped pour hole with configurable taper angle
 * @param diameter - Base diameter of the pour hole (into cavity)
 * @param depth - Total depth of the pour hole
 * @param topY - Y position of the mold top
 * @param taperAngle - Taper angle in degrees (5-30)
 */
function createPourHoleBrush(
  diameter: number,
  depth: number,
  topY: number,
  taperAngle: number = 15
): Brush {
  const bottomRadius = (diameter / 2) * SCALE;
  const holeDepth = depth * SCALE;
  
  // Calculate top radius from taper angle
  // tan(angle) = (topRadius - bottomRadius) / depth
  const taperRad = (taperAngle * Math.PI) / 180;
  const topRadius = bottomRadius + Math.tan(taperRad) * holeDepth;
  
  // CylinderGeometry: (radiusTop, radiusBottom, height, segments)
  const geometry = new THREE.CylinderGeometry(
    topRadius,      // Wide opening at top (funnel)
    bottomRadius,   // Standard size into cavity
    holeDepth,
    24
  );
  
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.set(0, topY - holeDepth / 2 + 0.001, 0);
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Create vent hole brush for air escape during casting
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
    radius * 0.8,
    radius,
    holeDepth,
    12
  );
  
  // Point along +X (radial direction)
  geometry.rotateZ(-Math.PI / 2);
  // Tilt upward
  geometry.rotateZ(tiltAngle);
  
  ensureUVAttribute(geometry);
  
  const brush = new Brush(geometry);
  brush.position.copy(position);
  brush.rotation.y = radialAngle;
  brush.updateMatrixWorld();
  
  return brush;
}

/**
 * Create spare/reservoir collar brush
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
 * Create strap notch brush
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
 * Generate a TRUE WEDGE mold part geometry
 * 
 * This creates a proper radial wedge that:
 * - Meets at the central Y-axis
 * - Has planar split faces at startAngle and endAngle
 * - Is watertight and manifold
 * - Works correctly for any number of parts (2-8)
 */
function generateWedgeMoldPart(
  params: ParametricParams,
  moldParams: MoldParams,
  startAngle: number,
  endAngle: number,
  _objectType?: string
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const wallThickness = moldParams.wallThickness * SCALE;
  const baseThickness = moldParams.baseThickness * SCALE;
  const offset = moldParams.offset * SCALE;
  const topWallThickness = wallThickness;
  const moldTotalHeight = height + topWallThickness;
  
  // Resolution
  const radialSegments = 32; // Segments around the arc
  const heightSegments = 48; // Segments along height
  
  const splitRotation = moldParams.splitAngle * Math.PI / 180;
  const adjustedStartAngle = startAngle + splitRotation;
  const adjustedEndAngle = endAngle + splitRotation;
  const angleSpan = endAngle - startAngle;
  
  // Calculate number of segments for this wedge (proportional to angle)
  const segmentsForWedge = Math.max(4, Math.floor(radialSegments * (angleSpan / (Math.PI * 2))));
  
  // Get max body radius for outer mold bounds
  const maxBodyRadius = getMaxBodyRadius(params, { scale: SCALE, objectType: 'vase' });
  const outerRadius = maxBodyRadius + wallThickness;
  
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  // Helper to add vertex and return its index
  const addVertex = (x: number, y: number, z: number, u: number, v: number): number => {
    const idx = vertices.length / 3;
    vertices.push(x, y, z);
    uvs.push(u, v);
    return idx;
  };
  
  // ========== INNER SURFACE (CAVITY) ==========
  // Generate the cavity surface following the body profile
  const innerSurfaceStart = vertices.length / 3;
  
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const y = t * height;
    
    // Draft angle offset - cavity expands toward top for demolding
    const draftOffset = t * Math.tan(moldParams.draftAngle * Math.PI / 180) * height;
    
    for (let s = 0; s <= segmentsForWedge; s++) {
      const u = s / segmentsForWedge;
      const theta = adjustedStartAngle + u * angleSpan;
      const thetaRaw = theta - splitRotation;
      
      // Get actual body radius at this point
      let radius = getBodyRadius(params, t, thetaRaw, { 
        scale: SCALE, 
        objectType: 'vase',
        includeTwist: true 
      });
      radius += offset + draftOffset * 0.5;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      addVertex(x, y, z, u, t);
    }
  }
  
  // Inner surface indices (normals point outward from cavity = into mold solid)
  for (let h = 0; h < heightSegments; h++) {
    for (let s = 0; s < segmentsForWedge; s++) {
      const a = innerSurfaceStart + h * (segmentsForWedge + 1) + s;
      const b = a + segmentsForWedge + 1;
      const c = a + 1;
      const d = b + 1;
      
      // Winding for outward-facing normals (into mold body)
      indices.push(a, c, b);
      indices.push(c, d, b);
    }
  }
  
  // ========== OUTER SURFACE (MOLD EXTERIOR) ==========
  const outerSurfaceStart = vertices.length / 3;
  
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const y = -baseThickness + (t * (moldTotalHeight + baseThickness));
    
    for (let s = 0; s <= segmentsForWedge; s++) {
      const u = s / segmentsForWedge;
      const theta = adjustedStartAngle + u * angleSpan;
      
      const x = Math.cos(theta) * outerRadius;
      const z = Math.sin(theta) * outerRadius;
      
      addVertex(x, y, z, u + 1, t);
    }
  }
  
  // Outer surface indices (normals point outward)
  for (let h = 0; h < heightSegments; h++) {
    for (let s = 0; s < segmentsForWedge; s++) {
      const a = outerSurfaceStart + h * (segmentsForWedge + 1) + s;
      const b = a + segmentsForWedge + 1;
      const c = a + 1;
      const d = b + 1;
      
      // Winding for outward-facing normals
      indices.push(a, b, c);
      indices.push(c, b, d);
    }
  }
  
  // ========== LEFT SPLIT FACE (at startAngle) ==========
  // This is a planar face from center axis to outer radius
  const leftFaceStart = vertices.length / 3;
  
  // Add vertices along the center axis (radius = 0)
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const y = -baseThickness + (t * (moldTotalHeight + baseThickness));
    addVertex(0, y, 0, 0, t);
  }
  
  // Add vertices along the outer edge at startAngle
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const y = -baseThickness + (t * (moldTotalHeight + baseThickness));
    const x = Math.cos(adjustedStartAngle) * outerRadius;
    const z = Math.sin(adjustedStartAngle) * outerRadius;
    addVertex(x, y, z, 1, t);
  }
  
  // Left split face indices (normal points "left" = into previous wedge space)
  for (let h = 0; h < heightSegments; h++) {
    const centerA = leftFaceStart + h;
    const centerB = leftFaceStart + h + 1;
    const edgeA = leftFaceStart + (heightSegments + 1) + h;
    const edgeB = leftFaceStart + (heightSegments + 1) + h + 1;
    
    // Winding: looking from the left (previous wedge), face normal points toward us
    indices.push(centerA, edgeA, centerB);
    indices.push(centerB, edgeA, edgeB);
  }
  
  // ========== RIGHT SPLIT FACE (at endAngle) ==========
  const rightFaceStart = vertices.length / 3;
  
  // Center axis vertices
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const y = -baseThickness + (t * (moldTotalHeight + baseThickness));
    addVertex(0, y, 0, 0, t);
  }
  
  // Outer edge at endAngle
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const y = -baseThickness + (t * (moldTotalHeight + baseThickness));
    const x = Math.cos(adjustedEndAngle) * outerRadius;
    const z = Math.sin(adjustedEndAngle) * outerRadius;
    addVertex(x, y, z, 1, t);
  }
  
  // Right split face indices (normal points "right" = into next wedge space)
  for (let h = 0; h < heightSegments; h++) {
    const centerA = rightFaceStart + h;
    const centerB = rightFaceStart + h + 1;
    const edgeA = rightFaceStart + (heightSegments + 1) + h;
    const edgeB = rightFaceStart + (heightSegments + 1) + h + 1;
    
    // Winding: opposite of left face
    indices.push(centerA, centerB, edgeA);
    indices.push(centerB, edgeB, edgeA);
  }
  
  // ========== BOTTOM FACE (solid flat base) ==========
  const bottomCenterIdx = addVertex(0, -baseThickness, 0, 0.5, 0);
  
  // Bottom edge vertices (outer ring at y = -baseThickness)
  const bottomRingStart = vertices.length / 3;
  for (let s = 0; s <= segmentsForWedge; s++) {
    const u = s / segmentsForWedge;
    const theta = adjustedStartAngle + u * angleSpan;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    addVertex(x, -baseThickness, z, u, 0);
  }
  
  // Bottom face: fan from center to outer ring (facing down)
  for (let s = 0; s < segmentsForWedge; s++) {
    const a = bottomCenterIdx;
    const b = bottomRingStart + s;
    const c = bottomRingStart + s + 1;
    indices.push(a, c, b); // Normal pointing -Y (down)
  }
  
  // ========== TOP FACE (solid cap with pour hole cavity) ==========
  const topCenterIdx = addVertex(0, moldTotalHeight, 0, 0.5, 1);
  
  // Top edge vertices (outer ring at y = moldTotalHeight)
  const topRingStart = vertices.length / 3;
  for (let s = 0; s <= segmentsForWedge; s++) {
    const u = s / segmentsForWedge;
    const theta = adjustedStartAngle + u * angleSpan;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    addVertex(x, moldTotalHeight, z, u, 1);
  }
  
  // Top face: fan from center to outer ring (facing up)
  for (let s = 0; s < segmentsForWedge; s++) {
    const a = topCenterIdx;
    const b = topRingStart + s;
    const c = topRingStart + s + 1;
    indices.push(a, b, c); // Normal pointing +Y (up)
  }
  
  // ========== CAVITY FLOOR (at y = 0, inside the mold) ==========
  // This closes the bottom of the cavity
  const cavityFloorCenterIdx = addVertex(0, 0, 0, 0.5, 0);
  
  // Get inner surface bottom ring (first ring of inner surface)
  const innerBottomRingStart = innerSurfaceStart; // First row of inner surface
  
  // Create floor ring at cavity floor level
  const cavityFloorRingStart = vertices.length / 3;
  for (let s = 0; s <= segmentsForWedge; s++) {
    const u = s / segmentsForWedge;
    const theta = adjustedStartAngle + u * angleSpan;
    const thetaRaw = theta - splitRotation;
    
    // Get body radius at bottom
    let radius = getBodyRadius(params, 0, thetaRaw, { 
      scale: SCALE, 
      objectType: 'vase',
      includeTwist: true 
    });
    radius += offset;
    
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    addVertex(x, 0, z, u, 0);
  }
  
  // Cavity floor: fan from center to inner ring (facing up into cavity)
  for (let s = 0; s < segmentsForWedge; s++) {
    const a = cavityFloorCenterIdx;
    const b = cavityFloorRingStart + s;
    const c = cavityFloorRingStart + s + 1;
    indices.push(a, b, c); // Normal pointing +Y (up into cavity)
  }
  
  // ========== TOP CAVITY OPENING (rim at top of cavity) ==========
  // This creates the horizontal rim surface between cavity opening and mold outer surface
  
  // Get inner surface top ring (last row of inner surface)
  const innerTopRingOffset = heightSegments * (segmentsForWedge + 1);
  
  // Create rim ring at top (y = height)
  const rimInnerStart = vertices.length / 3;
  for (let s = 0; s <= segmentsForWedge; s++) {
    const innerIdx = innerSurfaceStart + innerTopRingOffset + s;
    const x = vertices[innerIdx * 3];
    const z = vertices[innerIdx * 3 + 2];
    addVertex(x, height, z, s / segmentsForWedge, 0.9);
  }
  
  // Outer rim at cavity height
  const rimOuterStart = vertices.length / 3;
  for (let s = 0; s <= segmentsForWedge; s++) {
    const u = s / segmentsForWedge;
    const theta = adjustedStartAngle + u * angleSpan;
    const x = Math.cos(theta) * outerRadius;
    const z = Math.sin(theta) * outerRadius;
    addVertex(x, height, z, u, 1);
  }
  
  // Rim surface (horizontal, facing up, between cavity and outer wall)
  // We need a vertical wall from cavity top to mold top, not a horizontal rim
  // Actually, the cavity extends to height, and mold extends to moldTotalHeight
  // The area between needs to be filled
  
  // Inner vertical wall from cavity top (height) to mold top (moldTotalHeight)
  const innerTopWallBottomStart = vertices.length / 3;
  for (let s = 0; s <= segmentsForWedge; s++) {
    const u = s / segmentsForWedge;
    const theta = adjustedStartAngle + u * angleSpan;
    const thetaRaw = theta - splitRotation;
    
    let radius = getBodyRadius(params, 1.0, thetaRaw, { 
      scale: SCALE, 
      objectType: 'vase',
      includeTwist: true 
    });
    radius += offset;
    
    addVertex(Math.cos(theta) * radius, height, Math.sin(theta) * radius, u, 0);
    addVertex(Math.cos(theta) * radius, moldTotalHeight, Math.sin(theta) * radius, u, 1);
  }
  
  // Inner top wall surface (vertical wall around cavity opening)
  for (let s = 0; s < segmentsForWedge; s++) {
    const bottomA = innerTopWallBottomStart + s * 2;
    const topA = innerTopWallBottomStart + s * 2 + 1;
    const bottomB = innerTopWallBottomStart + (s + 1) * 2;
    const topB = innerTopWallBottomStart + (s + 1) * 2 + 1;
    
    // Facing inward (into cavity) - reversed winding
    indices.push(bottomA, bottomB, topA);
    indices.push(topA, bottomB, topB);
  }
  
  // Top surface: connect inner top wall top to outer top ring
  for (let s = 0; s < segmentsForWedge; s++) {
    const innerA = innerTopWallBottomStart + s * 2 + 1;
    const innerB = innerTopWallBottomStart + (s + 1) * 2 + 1;
    const outerA = topRingStart + s;
    const outerB = topRingStart + s + 1;
    
    indices.push(innerA, outerA, innerB);
    indices.push(innerB, outerA, outerB);
  }
  
  // Build geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Add CSG features (keys, pour hole, vents) to a wedge mold part
 */
function addMoldPartFeatures(
  baseGeometry: THREE.BufferGeometry,
  params: ParametricParams,
  moldParams: MoldParams,
  startAngle: number,
  endAngle: number,
  partIndex: number,
  totalParts: number,
  _objectType?: string
): THREE.BufferGeometry {
  const height = params.height * SCALE;
  const wallThickness = moldParams.wallThickness * SCALE;
  const offset = moldParams.offset * SCALE;
  const moldTotalHeight = height + wallThickness;
  const splitRotation = moldParams.splitAngle * Math.PI / 180;
  const adjustedStartAngle = startAngle + splitRotation;
  const adjustedEndAngle = endAngle + splitRotation;
  
  const maxBodyRadius = getMaxBodyRadius(params, { scale: SCALE, objectType: params.shapeStyle });
  const outerRadius = maxBodyRadius + wallThickness;
  
  // Key positioning: midpoint of wall for structural integrity
  const keyRadius = (maxBodyRadius + offset + outerRadius) / 2;
  const keyDepth = Math.min(moldParams.registrationKeySize * 1.5, moldParams.wallThickness * 0.6);
  
  try {
    const evaluator = new Evaluator();
    let resultBrush = new Brush(baseGeometry);
    resultBrush.updateMatrixWorld();
    
    // Calculate key positions
    const keyPositions = calculateKeyPositions(
      params.height,
      moldParams.registrationKeyCount,
      moldParams.baseThickness
    );
    
    // Add registration keys
    for (const yPos of keyPositions) {
      const y = yPos * SCALE;
      
      // Left edge: this part has PEGS that point into the counter-clockwise neighbor
      const leftKeyPos = new THREE.Vector3(
        Math.cos(adjustedStartAngle) * keyRadius,
        y,
        Math.sin(adjustedStartAngle) * keyRadius
      );
      
      const leftKeyBrush = createRegistrationKeyBrush(
        moldParams.registrationKeySize,
        keyDepth,
        leftKeyPos,
        false, // peg (protrusion)
        adjustedStartAngle,
        true // isLeftEdge = true
      );
      resultBrush = evaluator.evaluate(resultBrush, leftKeyBrush, ADDITION);
      
      // Right edge: this part has SOCKETS that receive pegs from the clockwise neighbor
      const rightKeyPos = new THREE.Vector3(
        Math.cos(adjustedEndAngle) * keyRadius,
        y,
        Math.sin(adjustedEndAngle) * keyRadius
      );
      
      const rightKeyBrush = createRegistrationKeyBrush(
        moldParams.registrationKeySize,
        keyDepth,
        rightKeyPos,
        true, // socket (indentation)
        adjustedEndAngle,
        false // isLeftEdge = false
      );
      resultBrush = evaluator.evaluate(resultBrush, rightKeyBrush, SUBTRACTION);
    }
    
    // Pour hole - only on first part (or whichever contains the center)
    if (partIndex === 0) {
      const pourHoleDepth = moldParams.wallThickness + 10;
      const pourHoleBrush = createPourHoleBrush(
        moldParams.pourHoleDiameter,
        pourHoleDepth,
        moldTotalHeight / SCALE,
        moldParams.pourHoleTaper || 15
      );
      resultBrush = evaluator.evaluate(resultBrush, pourHoleBrush, SUBTRACTION);
    }
    
    // Vent holes if enabled
    if (moldParams.ventHolesEnabled && moldParams.ventHoleCount > 0) {
      const ventY = height * moldParams.ventHolePosition;
      const ventDepth = moldParams.wallThickness + 5;
      const angleSpan = endAngle - startAngle;
      const ventsPerPart = Math.ceil(moldParams.ventHoleCount / totalParts);
      const ventAngleStep = angleSpan / (ventsPerPart + 1);
      
      for (let i = 1; i <= ventsPerPart; i++) {
        const ventAngle = adjustedStartAngle + ventAngleStep * i;
        const ventRadius = outerRadius - wallThickness * 0.5;
        
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
          ventAngle
        );
        
        resultBrush = evaluator.evaluate(resultBrush, ventBrush, SUBTRACTION);
      }
    }
    
    // Spare collar only on first part
    if (partIndex === 0 && moldParams.spareEnabled && moldParams.spareHeight > 0) {
      const spareDiameter = moldParams.spareDiameter > 0 
        ? moldParams.spareDiameter 
        : moldParams.pourHoleDiameter * 1.5;
      
      const spareBrush = createSpareCollarBrush(
        moldParams.pourHoleDiameter,
        spareDiameter,
        moldParams.spareHeight,
        moldTotalHeight / SCALE
      );
      
      resultBrush = evaluator.evaluate(resultBrush, spareBrush, ADDITION);
    }
    
    // Strap notches
    if (moldParams.strapNotchesEnabled && moldParams.strapNotchCount > 0) {
      const notchY = height * 0.5;
      const moldOuterRadius = outerRadius / SCALE + moldParams.wallThickness;
      const angleSpan = endAngle - startAngle;
      const notchesPerPart = Math.ceil(moldParams.strapNotchCount / totalParts);
      const notchAngleStep = angleSpan / (notchesPerPart + 1);
      
      for (let i = 1; i <= notchesPerPart; i++) {
        const notchAngle = adjustedStartAngle + notchAngleStep * i;
        
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
    console.error('CSG operations failed for mold part:', error);
    return baseGeometry;
  }
}

/**
 * Generate multi-part mold geometry (2-8 parts)
 * Uses true wedge geometry that meets at the central axis
 */
export function generateMultiPartMoldGeometry(
  params: ParametricParams,
  _objectType?: ShapeStyle // deprecated, uses params.shapeStyle
): MultiPartMoldGeometry {
  const partCount = params.moldPartCount || 2;
  const partAngles: number[] = [];
  const parts: THREE.BufferGeometry[] = [];
  
  // Determine split angles
  let splitAngles: number[];
  
  if (params.moldAutoSplit) {
    const optimalSplits = calculateOptimalSplits(params, params.shapeStyle, partCount);
    splitAngles = optimalSplits.splitAngles;
    
    while (splitAngles.length < partCount) {
      const nextAngle = (splitAngles.length / partCount) * Math.PI * 2;
      splitAngles.push(nextAngle);
    }
    splitAngles = splitAngles.slice(0, partCount);
  } else if (params.moldSplitAngles && params.moldSplitAngles.length >= partCount) {
    splitAngles = params.moldSplitAngles.slice(0, partCount);
  } else {
    // Default: equal angular division
    splitAngles = [];
    for (let i = 0; i < partCount; i++) {
      splitAngles.push((i / partCount) * Math.PI * 2);
    }
  }
  
  splitAngles.sort((a, b) => a - b);
  
  const moldParams: MoldParams = {
    wallThickness: params.moldWallThickness,
    baseThickness: params.moldBaseThickness,
    pourHoleDiameter: params.moldPourHoleDiameter,
    pourHoleTaper: (params as any).moldPourHoleTaper ?? 15,
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
  
  // Generate each wedge part
  for (let i = 0; i < partCount; i++) {
    const startAngle = splitAngles[i];
    const nextIndex = (i + 1) % partCount;
    let endAngle = splitAngles[nextIndex];
    
    if (endAngle <= startAngle) {
      endAngle += Math.PI * 2;
    }
    
    partAngles.push(startAngle);
    
    // Generate base wedge geometry
    const baseGeometry = generateWedgeMoldPart(
      params,
      moldParams,
      startAngle,
      endAngle,
      params.shapeStyle
    );
    
    // Add CSG features (keys, pour hole, vents)
    const partGeometry = addMoldPartFeatures(
      baseGeometry,
      params,
      moldParams,
      startAngle,
      endAngle,
      i,
      partCount,
      params.shapeStyle
    );
    
    parts.push(partGeometry);
  }
  
  return { parts, partAngles };
}

/**
 * Generate two-part mold geometry (legacy function for compatibility)
 */
export function generateMoldGeometry(
  params: ParametricParams,
  _objectType?: ShapeStyle // deprecated, uses params.shapeStyle
): MoldGeometry {
  // Use multi-part with count = 2
  const paramsWithTwoParts = { ...params, moldPartCount: 2 as const };
  const multiPart = generateMultiPartMoldGeometry(paramsWithTwoParts);
  
  return {
    halfA: multiPart.parts[0],
    halfB: multiPart.parts[1]
  };
}

/**
 * Export a single mold geometry to STL blob
 */
export function exportMoldHalfToSTL(geometry: THREE.BufferGeometry): Blob {
  const exporter = new STLExporter();
  const mesh = new THREE.Mesh(geometry);
  
  // Scale up from scene units to mm
  mesh.scale.set(100, 100, 100);
  mesh.updateMatrixWorld();
  
  const stlString = exporter.parse(mesh, { binary: false });
  return new Blob([stlString], { type: 'application/octet-stream' });
}

/**
 * Download two-part mold STL files
 * @param half - 'A', 'B', or 'both'
 */
export function downloadMoldSTL(
  params: ParametricParams,
  _objectType?: ShapeStyle, // deprecated, uses params.shapeStyle
  half: 'A' | 'B' | 'both' = 'both',
  filename: string = 'mold'
): void {
  const { halfA, halfB } = generateMoldGeometry(params);
  
  const downloadPart = (geometry: THREE.BufferGeometry, suffix: string) => {
    const blob = exportMoldHalfToSTL(geometry);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_half_${suffix}.stl`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  if (half === 'A' || half === 'both') {
    downloadPart(halfA, 'A');
  }
  if (half === 'B' || half === 'both') {
    downloadPart(halfB, 'B');
  }
}

/**
 * Download multi-part mold STL files
 * @param partIndex - specific part index, or 'all' for all parts
 */
export function downloadMultiPartMoldSTL(
  params: ParametricParams,
  _objectType?: ShapeStyle, // deprecated, uses params.shapeStyle
  partIndex: number | 'all' = 'all',
  filename: string = 'mold'
): void {
  const { parts } = generateMultiPartMoldGeometry(params);
  
  const downloadPart = (geometry: THREE.BufferGeometry, index: number) => {
    const blob = exportMoldHalfToSTL(geometry);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_part_${String.fromCharCode(65 + index)}.stl`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  if (partIndex === 'all') {
    parts.forEach((geometry, index) => downloadPart(geometry, index));
  } else if (typeof partIndex === 'number' && partIndex >= 0 && partIndex < parts.length) {
    downloadPart(parts[partIndex], partIndex);
  }
}
