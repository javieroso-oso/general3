import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { ParametricParams, ObjectType, PrintSettings, printConstraints } from '@/types/parametric';
import { generateLegsWithBase } from '@/lib/leg-generator';

// Scale factor: mm to scene units
const SCALE = 0.01;

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

// Calculate radius at a given height t (0-1)
function getRadiusAtHeight(
  t: number,
  params: ParametricParams,
  type: ObjectType,
  theta: number = 0
): number {
  const {
    baseRadius,
    topRadius,
    wobbleFrequency,
    wobbleAmplitude,
    bulgePosition,
    bulgeAmount,
    pinchAmount,
    asymmetry,
    rippleCount,
    rippleDepth,
    lipFlare,
    lipHeight,
    organicNoise,
    noiseScale,
    height,
  } = params;

  // Base profile
  let radius: number;
  if (type === 'lamp') {
    radius = baseRadius + (topRadius - baseRadius) * Math.pow(t, 0.6);
  } else if (type === 'sculpture') {
    const curve = Math.sin(t * Math.PI);
    radius = baseRadius * (1 - t * 0.3) + topRadius * t * 0.7 + curve * baseRadius * 0.2;
  } else {
    const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
    radius = baseRadius * (1 - t * 0.4) + topRadius * t * 0.6 + curve * baseRadius * 0.12;
  }

  // Organic bulge
  const bulgeDist = Math.abs(t - bulgePosition);
  radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;

  // Pinch
  const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
  const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
  radius *= (1 - pinchTop - pinchBottom);

  // Lip flare
  const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
  radius += lipT * lipT * lipFlare * baseRadius;

  // Min radius
  radius = Math.max(radius, printConstraints.minBaseRadius * 0.5);

  // Angular deformations
  if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
    const maxWobble = Math.min(wobbleAmplitude, 0.15);
    radius += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * baseRadius;
  }

  if (rippleCount > 0 && rippleDepth > 0) {
    const maxRipple = Math.min(rippleDepth, 0.1);
    radius += Math.sin(theta * rippleCount) * maxRipple * baseRadius;
  }

  if (asymmetry > 0) {
    const maxAsym = Math.min(asymmetry, 0.1);
    radius += Math.sin(theta) * Math.cos(t * Math.PI * 2) * maxAsym * baseRadius;
  }

  if (organicNoise > 0) {
    const maxNoise = Math.min(organicNoise, 0.1);
    const y = t * height;
    const nx = Math.cos(theta) * radius;
    const nz = Math.sin(theta) * radius;
    radius += noise3D(nx * 0.1, y * 0.1, nz * 0.1, noiseScale) * maxNoise * baseRadius;
  }

  return Math.max(radius, params.wallThickness * 2);
}

// Generate body mesh (open bottom, no base cap) for STL export
// Handles wall mount cut if standType is wall_mount
export function generateBodyMesh(
  params: ParametricParams,
  type: ObjectType
): THREE.BufferGeometry {
  const {
    height,
    wallThickness,
    twistAngle,
    addLegs,
    standType,
    wallMountStyle,
    wallMountCutOffset,
  } = params;

  // Check if this is a back-style wall mount
  const isWallMount = addLegs && standType === 'wall_mount' && wallMountStyle === 'back';
  const cutOffset = wallMountCutOffset || 0;

  const segments = 64;
  const heightSegments = Math.ceil(height / 2);

  const outerVerts: number[] = [];
  const innerVerts: number[] = [];

  // Generate outer wall vertices
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    const twistRad = (twistAngle * Math.PI / 180) * t;

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      const r = getRadiusAtHeight(t, params, type, theta);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      outerVerts.push(x, y, z);
    }
  }

  // Generate inner wall vertices
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    const twistRad = (twistAngle * Math.PI / 180) * t;

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      const outerR = getRadiusAtHeight(t, params, type, theta);
      const r = Math.max(outerR - wallThickness, wallThickness);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      innerVerts.push(x, y, z);
    }
  }

  if (isWallMount) {
    // Wall mount: clip at cut plane and generate back wall
    return generateWallMountBody(outerVerts, innerVerts, heightSegments, segments, height, cutOffset, wallThickness);
  } else {
    // Normal full 360° body
    return generateFullBody(outerVerts, innerVerts, heightSegments, segments);
  }
}

// Generate full 360° body mesh
function generateFullBody(
  outerVerts: number[],
  innerVerts: number[],
  heightSegments: number,
  segments: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Copy outer vertices
  const outerStart = 0;
  for (let i = 0; i < outerVerts.length; i++) {
    vertices.push(outerVerts[i]);
  }

  // Copy inner vertices
  const innerStart = vertices.length / 3;
  for (let i = 0; i < innerVerts.length; i++) {
    vertices.push(innerVerts[i]);
  }

  // Outer wall faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = outerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Inner wall faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = innerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Bottom rim - connect outer to inner wall at base
  for (let j = 0; j < segments; j++) {
    const outer1 = outerStart + j;
    const outer2 = outerStart + j + 1;
    const inner1 = innerStart + j;
    const inner2 = innerStart + j + 1;
    
    indices.push(outer1, inner1, outer2);
    indices.push(outer2, inner1, inner2);
  }

  // Top rim - connect outer to inner wall
  const topOuterStart = outerStart + heightSegments * (segments + 1);
  const topInnerStart = innerStart + heightSegments * (segments + 1);
  
  for (let j = 0; j < segments; j++) {
    const outer1 = topOuterStart + j;
    const outer2 = topOuterStart + j + 1;
    const inner1 = topInnerStart + j;
    const inner2 = topInnerStart + j + 1;
    
    indices.push(outer1, outer2, inner1);
    indices.push(inner1, outer2, inner2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

// Generate wall mount body with cut plane and integrated keyholes
function generateWallMountBody(
  outerVerts: number[],
  innerVerts: number[],
  heightSegments: number,
  segments: number,
  height: number,
  cutOffset: number,
  wallThickness: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];

  // Clip outer vertices at cut plane
  const clippedOuter: number[] = [];
  for (let i = 0; i < outerVerts.length; i += 3) {
    const x = outerVerts[i];
    const y = outerVerts[i + 1];
    let z = outerVerts[i + 2];
    if (z < cutOffset) z = cutOffset;
    clippedOuter.push(x, y, z);
  }

  // Clip inner vertices at cut plane
  const clippedInner: number[] = [];
  for (let i = 0; i < innerVerts.length; i += 3) {
    const x = innerVerts[i];
    const y = innerVerts[i + 1];
    let z = innerVerts[i + 2];
    if (z < cutOffset) z = cutOffset;
    clippedInner.push(x, y, z);
  }

  // Copy clipped outer vertices
  const outerStart = 0;
  for (let i = 0; i < clippedOuter.length; i++) {
    vertices.push(clippedOuter[i]);
  }

  // Copy clipped inner vertices
  const innerStart = vertices.length / 3;
  for (let i = 0; i < clippedInner.length; i++) {
    vertices.push(clippedInner[i]);
  }

  // Build shell surface faces (front part only - where z > cutOffset)
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = outerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;

      const za = clippedOuter[a * 3 + 2];
      const zb = clippedOuter[b * 3 + 2];
      const zc = clippedOuter[c * 3 + 2];
      const zd = clippedOuter[d * 3 + 2];

      const aFront = za > cutOffset + 0.001;
      const bFront = zb > cutOffset + 0.001;
      const cFront = zc > cutOffset + 0.001;
      const dFront = zd > cutOffset + 0.001;

      if (aFront || bFront || cFront || dFront) {
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
  }

  // Inner wall faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = innerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;

      const za = clippedInner[(a - innerStart) * 3 + 2];
      const zb = clippedInner[(b - innerStart) * 3 + 2];
      const zc = clippedInner[(c - innerStart) * 3 + 2];
      const zd = clippedInner[(d - innerStart) * 3 + 2];

      const aFront = za > cutOffset + 0.001;
      const bFront = zb > cutOffset + 0.001;
      const cFront = zc > cutOffset + 0.001;
      const dFront = zd > cutOffset + 0.001;

      if (aFront || bFront || cFront || dFront) {
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
  }

  // Bottom rim
  for (let j = 0; j < segments; j++) {
    const outer1 = outerStart + j;
    const outer2 = outerStart + j + 1;
    const inner1 = innerStart + j;
    const inner2 = innerStart + j + 1;

    const zo1 = clippedOuter[outer1 * 3 + 2];
    const zo2 = clippedOuter[outer2 * 3 + 2];
    
    if (zo1 > cutOffset + 0.001 || zo2 > cutOffset + 0.001) {
      indices.push(outer1, inner1, outer2);
      indices.push(outer2, inner1, inner2);
    }
  }

  // Top rim
  const topOuterStart = outerStart + heightSegments * (segments + 1);
  const topInnerStart = innerStart + heightSegments * (segments + 1);
  
  for (let j = 0; j < segments; j++) {
    const outer1 = topOuterStart + j;
    const outer2 = topOuterStart + j + 1;
    const inner1 = topInnerStart + j;
    const inner2 = topInnerStart + j + 1;

    const zo1 = clippedOuter[(outer1 - outerStart) * 3 + 2];
    const zo2 = clippedOuter[(outer2 - outerStart) * 3 + 2];

    if (zo1 > cutOffset + 0.001 || zo2 > cutOffset + 0.001) {
      indices.push(outer1, outer2, inner1);
      indices.push(inner1, outer2, inner2);
    }
  }

  // === CREATE BACK WALL WITH PROPER INTERSECTION CALCULATION ===
  // Find actual intersection points where body crosses the cut plane
  
  const leftEdgePoints: { x: number; y: number }[] = [];
  const rightEdgePoints: { x: number; y: number }[] = [];

  for (let i = 0; i <= heightSegments; i++) {
    const y = (i / heightSegments) * height;
    
    // Collect all intersection points at this height level
    const intersections: number[] = [];
    
    for (let j = 0; j < segments; j++) {
      const idx1 = i * (segments + 1) + j;
      const idx2 = i * (segments + 1) + j + 1;
      
      const x1 = outerVerts[idx1 * 3];
      const z1 = outerVerts[idx1 * 3 + 2];
      const x2 = outerVerts[idx2 * 3];
      const z2 = outerVerts[idx2 * 3 + 2];
      
      // Check if the cut plane crosses between these two vertices
      if ((z1 >= cutOffset && z2 < cutOffset) || (z1 < cutOffset && z2 >= cutOffset)) {
        const tInterp = (cutOffset - z1) / (z2 - z1);
        const xIntersect = x1 + tInterp * (x2 - x1);
        intersections.push(xIntersect);
      }
    }
    
    // Take leftmost and rightmost intersections
    if (intersections.length >= 2) {
      intersections.sort((a, b) => a - b);
      leftEdgePoints.push({ x: intersections[0], y });
      rightEdgePoints.push({ x: intersections[intersections.length - 1], y });
    } else if (intersections.length === 1) {
      // Single intersection - use symmetric fallback
      leftEdgePoints.push({ x: intersections[0], y });
      rightEdgePoints.push({ x: -intersections[0], y });
    }
  }

  // Build complete back wall polygon
  if (leftEdgePoints.length >= 2 && rightEdgePoints.length >= 2) {
    // Create outline: left edge bottom to top, then right edge top to bottom
    const outline: { x: number; y: number }[] = [];
    
    // Left edge (bottom to top)
    for (const pt of leftEdgePoints) {
      outline.push(pt);
    }
    
    // Right edge (top to bottom - reversed)
    for (let i = rightEdgePoints.length - 1; i >= 0; i--) {
      outline.push(rightEdgePoints[i]);
    }
    
    if (outline.length >= 3) {
      // Add back wall vertices
      const backWallStartIdx = vertices.length / 3;
      for (const pt of outline) {
        vertices.push(pt.x, pt.y, cutOffset);
      }
      
      // Calculate centroid for fan triangulation
      let centerX = 0, centerY = 0;
      for (const pt of outline) {
        centerX += pt.x;
        centerY += pt.y;
      }
      centerX /= outline.length;
      centerY /= outline.length;
      
      const centerIdx = vertices.length / 3;
      vertices.push(centerX, centerY, cutOffset);
      
      // Create fan triangles (facing -Z direction, so we use proper winding)
      for (let i = 0; i < outline.length; i++) {
        const a = backWallStartIdx + i;
        const b = backWallStartIdx + ((i + 1) % outline.length);
        // Winding for back face (facing -Z)
        indices.push(centerIdx, b, a);
      }
      
      // === ADD KEYHOLE GEOMETRY TO BACK WALL ===
      // Create actual keyhole holes in the back wall for proper STL export
      const KEYHOLE_HEAD_RADIUS = 4; // 8mm diameter head hole
      const KEYHOLE_SLOT_WIDTH = 2;  // 4mm slot width
      const KEYHOLE_SLOT_LENGTH = 8; // 8mm slot length
      const KEYHOLE_DEPTH = wallThickness + 1; // Through the back wall
      
      // Calculate keyhole positions (2 vertical holes centered)
      const holeMargin = height * 0.15;
      const bottomY = Math.max(holeMargin, 15);
      const topY = Math.min(height - holeMargin, height - 15);
      
      const keyholePositions = [
        { x: 0, y: bottomY },
        { x: 0, y: topY }
      ];
      
      // Add keyhole hole geometry for each position
      for (const pos of keyholePositions) {
        addKeyholeHole(vertices, indices, pos.x, pos.y, cutOffset, KEYHOLE_HEAD_RADIUS, KEYHOLE_SLOT_WIDTH, KEYHOLE_SLOT_LENGTH, KEYHOLE_DEPTH);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Add keyhole hole geometry to the vertices/indices arrays
 * Creates a keyhole-shaped hole through the back wall
 */
function addKeyholeHole(
  vertices: number[],
  indices: number[],
  cx: number,
  cy: number,
  zPos: number,
  headRadius: number,
  slotWidth: number,
  slotLength: number,
  depth: number
): void {
  const segs = 16;
  const startIdx = vertices.length / 3;
  
  // Front ring of keyhole (at back wall surface)
  // Large circle at bottom
  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * Math.PI * 2;
    vertices.push(
      cx + Math.cos(angle) * headRadius,
      cy + Math.sin(angle) * headRadius,
      zPos
    );
  }
  
  // Back ring of keyhole (through the wall)
  const backRingStart = vertices.length / 3;
  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * Math.PI * 2;
    vertices.push(
      cx + Math.cos(angle) * headRadius,
      cy + Math.sin(angle) * headRadius,
      zPos - depth
    );
  }
  
  // Keyhole wall (cylinder through wall)
  for (let i = 0; i < segs; i++) {
    const frontA = startIdx + i;
    const frontB = startIdx + i + 1;
    const backA = backRingStart + i;
    const backB = backRingStart + i + 1;
    
    // Inner wall of hole (reversed winding for inside of hole)
    indices.push(frontA, frontB, backA);
    indices.push(backA, frontB, backB);
  }
  
  // Slot going up from circle
  const slotStartIdx = vertices.length / 3;
  
  // Slot front vertices (rectangular slot going up)
  vertices.push(cx - slotWidth, cy + headRadius * 0.3, zPos); // bottom left
  vertices.push(cx + slotWidth, cy + headRadius * 0.3, zPos); // bottom right
  vertices.push(cx + slotWidth, cy + slotLength, zPos);       // top right
  vertices.push(cx - slotWidth, cy + slotLength, zPos);       // top left
  
  // Slot back vertices
  vertices.push(cx - slotWidth, cy + headRadius * 0.3, zPos - depth); // bottom left
  vertices.push(cx + slotWidth, cy + headRadius * 0.3, zPos - depth); // bottom right
  vertices.push(cx + slotWidth, cy + slotLength, zPos - depth);       // top right
  vertices.push(cx - slotWidth, cy + slotLength, zPos - depth);       // top left
  
  // Slot walls (4 sides)
  // Left wall
  indices.push(slotStartIdx + 0, slotStartIdx + 3, slotStartIdx + 4);
  indices.push(slotStartIdx + 4, slotStartIdx + 3, slotStartIdx + 7);
  
  // Right wall  
  indices.push(slotStartIdx + 1, slotStartIdx + 5, slotStartIdx + 2);
  indices.push(slotStartIdx + 2, slotStartIdx + 5, slotStartIdx + 6);
  
  // Top wall
  indices.push(slotStartIdx + 2, slotStartIdx + 6, slotStartIdx + 3);
  indices.push(slotStartIdx + 3, slotStartIdx + 6, slotStartIdx + 7);
}

// Generate legs with base disc mesh for STL export
export function generateLegsWithBaseMesh(
  params: ParametricParams
): THREE.BufferGeometry {
  return generateLegsWithBase(
    params.baseRadius,
    params.legCount,
    params.legHeight,
    params.legSpread,
    params.legThickness,
    params.legTaper,
    params.legInset,
    params.baseThickness || 3,
    {
      wobbleFrequency: params.wobbleFrequency,
      wobbleAmplitude: params.wobbleAmplitude,
      rippleCount: params.rippleCount,
      rippleDepth: params.rippleDepth,
      asymmetry: params.asymmetry,
      organicNoise: params.organicNoise,
      noiseScale: params.noiseScale,
    },
    {
      wallThickness: params.wallThickness,
      cordHoleEnabled: params.cordHoleEnabled,
      cordHoleDiameter: params.cordHoleDiameter,
      centeringLipEnabled: params.centeringLipEnabled,
      centeringLipHeight: params.centeringLipHeight,
      socketType: params.socketType,
    },
    {
      attachmentType: params.attachmentType,
      screwCount: params.screwCount,
      baseRadius: params.baseRadius,
    }
  );
}

// Legacy function for backwards compatibility
export function generatePrintableMesh(
  params: ParametricParams,
  type: ObjectType
): THREE.BufferGeometry {
  return generateBodyMesh(params, type);
}

// Export body mesh to STL
export function exportBodyToSTL(
  params: ParametricParams,
  type: ObjectType
): Blob {
  const geometry = generateBodyMesh(params, type);
  const mesh = new THREE.Mesh(geometry);
  
  const exporter = new STLExporter();
  const result = exporter.parse(mesh);
  
  return new Blob([result], { type: 'application/octet-stream' });
}

// Export legs+base mesh to STL
export function exportLegsWithBaseToSTL(
  params: ParametricParams
): Blob {
  const geometry = generateLegsWithBaseMesh(params);
  const mesh = new THREE.Mesh(geometry);
  
  const exporter = new STLExporter();
  const result = exporter.parse(mesh);
  
  return new Blob([result], { type: 'application/octet-stream' });
}

// Legacy export function
export function exportToSTL(
  params: ParametricParams,
  type: ObjectType
): Blob {
  return exportBodyToSTL(params, type);
}

// Download body STL
export function downloadBodySTL(
  params: ParametricParams,
  type: ObjectType,
  filename: string = 'body.stl'
): void {
  const blob = exportBodyToSTL(params, type);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Download legs+base STL
export function downloadLegsWithBaseSTL(
  params: ParametricParams,
  filename: string = 'legs_base.stl'
): void {
  const blob = exportLegsWithBaseToSTL(params);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Download both parts
export function downloadAllParts(
  params: ParametricParams,
  type: ObjectType,
  baseFilename: string = 'model'
): void {
  downloadBodySTL(params, type, `${baseFilename}_body.stl`);
  
  if (params.addLegs) {
    setTimeout(() => {
      downloadLegsWithBaseSTL(params, `${baseFilename}_legs_base.stl`);
    }, 100);
  }
}

// Legacy download function
export function downloadSTL(
  params: ParametricParams,
  type: ObjectType,
  filename: string = 'model.stl'
): void {
  downloadBodySTL(params, type, filename);
}

// Generate G-code toolpath data
export interface GCodeLayer {
  z: number;
  paths: Array<{ x: number; y: number; z?: number }[]>;  // z is for non-planar
}

// Generate spiral vase G-code layers (continuous Z movement)
export function generateSpiralVaseLayers(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): GCodeLayer[] {
  const layers: GCodeLayer[] = [];
  const { height, twistAngle } = params;
  const { layerHeight } = settings;
  
  const totalLayers = Math.ceil(height / layerHeight);
  const segments = 64; // Points per revolution
  const totalPoints = totalLayers * segments;
  
  // Single continuous spiral path
  const spiralPath: { x: number; y: number; z: number }[] = [];
  
  for (let i = 0; i <= totalPoints; i++) {
    const progress = i / totalPoints;
    const z = progress * height;
    const t = z / height;
    const revolutions = i / segments;
    const theta = revolutions * Math.PI * 2;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    const outerR = getRadiusAtHeight(t, params, type, theta + twistRad);
    
    spiralPath.push({
      x: Math.cos(theta + twistRad) * outerR,
      y: Math.sin(theta + twistRad) * outerR,
      z: z,
    });
  }
  
  // Return as single layer with spiral path
  layers.push({
    z: 0,
    paths: [spiralPath],
  });
  
  return layers;
}

export function generateGCodeLayers(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): GCodeLayer[] {
  // Use spiral mode if enabled
  if (settings.spiralVase || settings.printMode === 'vase_spiral') {
    return generateSpiralVaseLayers(params, type, settings);
  }
  
  const layers: GCodeLayer[] = [];
  const { height, wallThickness, twistAngle } = params;
  const { layerHeight, nozzleDiameter } = settings;
  
  const layerCount = Math.ceil(height / layerHeight);
  const segments = 48; // Points per perimeter
  
  for (let layer = 0; layer < layerCount; layer++) {
    const z = layer * layerHeight;
    const t = z / height;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    const outerPath: { x: number; y: number }[] = [];
    const innerPath: { x: number; y: number }[] = [];
    
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      const outerR = getRadiusAtHeight(t, params, type, theta);
      const innerR = Math.max(outerR - wallThickness, wallThickness);
      
      outerPath.push({
        x: Math.cos(theta) * outerR,
        y: Math.sin(theta) * outerR,
      });
      
      innerPath.push({
        x: Math.cos(theta) * innerR,
        y: Math.sin(theta) * innerR,
      });
    }
    
    layers.push({
      z,
      paths: [outerPath, innerPath],
    });
  }
  
  return layers;
}

// Generate actual G-code string
export function generateGCode(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): string {
  const layers = generateGCodeLayers(params, type, settings);
  const { printSpeed, layerHeight, material } = settings;
  const isSpiralVase = settings.spiralVase || settings.printMode === 'vase_spiral';
  const isNonPlanar = settings.printMode === 'non_planar';
  
  const lines: string[] = [];
  
  // G-code header
  lines.push('; Generated by Parametric 3D Generator');
  lines.push(`; Object Type: ${type}`);
  lines.push(`; Height: ${params.height}mm`);
  lines.push(`; Material: ${material}`);
  lines.push(`; Layer Height: ${layerHeight}mm`);
  lines.push(`; Print Mode: ${settings.printMode}`);
  if (isSpiralVase) {
    lines.push('; Mode: Spiral Vase (continuous Z movement)');
  }
  if (isNonPlanar) {
    lines.push(`; Non-Planar: Max Z Angle ${settings.nonPlanar.maxZAngle}°`);
    lines.push('; Note: Requires non-planar capable slicer/printer');
  }
  lines.push(`; Layers: ${isSpiralVase ? 'Continuous spiral' : layers.length}`);
  lines.push('');
  lines.push('G21 ; Set units to millimeters');
  lines.push('G90 ; Use absolute positioning');
  lines.push('M82 ; Use absolute extrusion');
  lines.push('G28 ; Home all axes');
  lines.push('G1 Z5 F3000 ; Lift nozzle');
  lines.push('');
  
  // Temperature settings based on material
  const temps: Record<string, { bed: number; nozzle: number }> = {
    PLA: { bed: 60, nozzle: 200 },
    PETG: { bed: 80, nozzle: 235 },
    ABS: { bed: 100, nozzle: 240 },
    TPU: { bed: 50, nozzle: 220 },
  };
  const temp = temps[material] || temps.PLA;
  
  lines.push(`M140 S${temp.bed} ; Set bed temperature`);
  lines.push(`M104 S${temp.nozzle} ; Set nozzle temperature`);
  lines.push(`M190 S${temp.bed} ; Wait for bed`);
  lines.push(`M109 S${temp.nozzle} ; Wait for nozzle`);
  lines.push('');
  
  // Print layers
  let e = 0; // Extrusion distance
  const filamentDiameter = 1.75;
  const nozzleDiameter = settings.nozzleDiameter;
  const extrusionMultiplier = (layerHeight * nozzleDiameter) / (Math.PI * Math.pow(filamentDiameter / 2, 2));
  
  if (isSpiralVase && layers.length > 0 && layers[0].paths.length > 0) {
    // Spiral vase mode - continuous Z movement
    lines.push('; Spiral Vase Mode - Continuous extrusion');
    const spiralPath = layers[0].paths[0];
    
    if (spiralPath.length > 0) {
      const firstPoint = spiralPath[0];
      lines.push(`G0 X${firstPoint.x.toFixed(3)} Y${firstPoint.y.toFixed(3)} Z${(firstPoint.z || 0).toFixed(3)} F3000`);
      
      for (let i = 1; i < spiralPath.length; i++) {
        const point = spiralPath[i];
        const prevPoint = spiralPath[i - 1];
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const dz = (point.z || 0) - (prevPoint.z || 0);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        e += dist * extrusionMultiplier;
        
        lines.push(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} Z${(point.z || 0).toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
      }
    }
  } else {
    // Standard layer-by-layer printing
    layers.forEach((layer, layerIndex) => {
      lines.push(`; Layer ${layerIndex + 1} / ${layers.length}`);
      lines.push(`G1 Z${layer.z.toFixed(3)} F1000`);
      
      layer.paths.forEach((path, pathIndex) => {
        if (path.length < 2) return;
        
        // Move to start
        lines.push(`G0 X${path[0].x.toFixed(3)} Y${path[0].y.toFixed(3)} F3000`);
        
        // Extrude along path
        for (let i = 1; i < path.length; i++) {
          const dx = path[i].x - path[i - 1].x;
          const dy = path[i].y - path[i - 1].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          e += dist * extrusionMultiplier;
          
          lines.push(`G1 X${path[i].x.toFixed(3)} Y${path[i].y.toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
        }
      });
    });
  }
  
  // G-code footer
  lines.push('');
  lines.push('; End G-code');
  lines.push('G1 E-2 F2400 ; Retract');
  lines.push(`G1 Z${params.height + 10} F3000 ; Lift nozzle`);
  lines.push('G28 X Y ; Home X and Y');
  lines.push('M104 S0 ; Turn off nozzle');
  lines.push('M140 S0 ; Turn off bed');
  lines.push('M84 ; Disable motors');
  
  return lines.join('\n');
}

// Download G-code file
export function downloadGCode(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings,
  filename: string = 'model.gcode'
): void {
  const gcode = generateGCode(params, type, settings);
  const blob = new Blob([gcode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
