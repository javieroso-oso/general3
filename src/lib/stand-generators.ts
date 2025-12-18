import * as THREE from 'three';
import { OrganicParams, SocketParams, AttachmentParams } from './leg-generator';

/**
 * Stand-specific parameters
 */
export interface StandParams {
  standType: 'tripod' | 'wall_mount';
  baseRadius: number;          // mm - shade base radius for sizing
  
  // Wall mount (sconce style)
  wallMountPlateShape: 'circle' | 'rectangle' | 'rounded_rectangle';
  wallMountPlateWidth: number;
  wallMountPlateHeight: number;
  wallMountPlateThickness: number;
  wallMountHoleType: 'keyhole' | 'screw' | 'adhesive';
  wallMountHoleCount: 2 | 3 | 4;
  wallMountBulbFixture: boolean;
  
  // Legacy wall bracket
  wallBracketArmLength: number;
  wallBracketArmAngle: number;
  wallBracketPlateSize: number;
  
  // Socket/cord options
  cordHoleEnabled?: boolean;
  cordHoleDiameter?: number;
}

/**
 * Merge multiple geometries into one
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;
  
  for (const geo of geometries) {
    const posAttr = geo.getAttribute('position');
    const posArray = posAttr.array as Float32Array;
    
    for (let i = 0; i < posArray.length; i++) {
      positions.push(posArray[i]);
    }
    
    const geoIndices = geo.getIndex();
    if (geoIndices) {
      const idxArray = geoIndices.array;
      for (let i = 0; i < idxArray.length; i++) {
        indices.push(idxArray[i] + indexOffset);
      }
    }
    
    indexOffset += posAttr.count;
  }
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  
  return merged;
}

/**
 * Generate a solid pedestal base (WOOJ-style)
 * Sculptural cylinder/cone with optional hollow for cord
 */
export function generatePedestal(
  diameter: number,
  height: number,
  taper: number,
  hollow: boolean,
  cordHoleDiameter: number = 8,
  organicParams?: OrganicParams
): THREE.BufferGeometry {
  const segments = 48;
  const heightSegments = 24;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const bottomRadius = diameter / 2;
  const topRadius = bottomRadius * (1 - taper * 0.5);
  const cordHoleRadius = hollow ? cordHoleDiameter / 2 : 0;
  
  // Generate outer surface
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const y = -height + t * height; // From bottom (-height) to top (0)
    const radius = bottomRadius + (topRadius - bottomRadius) * t;
    
    // Add subtle organic variation if params provided
    let variation = 0;
    if (organicParams && organicParams.organicNoise > 0) {
      variation = Math.sin(t * Math.PI * 2 + t * 10) * organicParams.organicNoise * bottomRadius * 0.5;
    }
    
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const r = radius + variation * Math.sin(theta * 3);
      vertices.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
    }
  }
  
  // Outer surface indices
  for (let h = 0; h < heightSegments; h++) {
    for (let s = 0; s < segments; s++) {
      const a = h * (segments + 1) + s;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  if (hollow) {
    // Inner surface for cord channel
    const innerStart = vertices.length / 3;
    for (let h = 0; h <= heightSegments; h++) {
      const t = h / heightSegments;
      const y = -height + t * height;
      
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, y, Math.sin(theta) * cordHoleRadius);
      }
    }
    
    // Inner surface indices (inverted winding)
    for (let h = 0; h < heightSegments; h++) {
      for (let s = 0; s < segments; s++) {
        const a = innerStart + h * (segments + 1) + s;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
    
    // Bottom ring (connect outer to inner)
    const bottomOuterStart = 0;
    const bottomInnerStart = innerStart;
    for (let s = 0; s < segments; s++) {
      const outerA = bottomOuterStart + s;
      const outerB = bottomOuterStart + s + 1;
      const innerA = bottomInnerStart + s;
      const innerB = bottomInnerStart + s + 1;
      indices.push(outerA, outerB, innerA);
      indices.push(innerA, outerB, innerB);
    }
    
    // Top ring (connect outer to inner)
    const topOuterStart = heightSegments * (segments + 1);
    const topInnerStart = innerStart + heightSegments * (segments + 1);
    for (let s = 0; s < segments; s++) {
      const outerA = topOuterStart + s;
      const outerB = topOuterStart + s + 1;
      const innerA = topInnerStart + s;
      const innerB = topInnerStart + s + 1;
      indices.push(outerA, innerA, outerB);
      indices.push(outerB, innerA, innerB);
    }
  } else {
    // Solid bottom cap
    const bottomCenterIdx = vertices.length / 3;
    vertices.push(0, -height, 0);
    for (let s = 0; s < segments; s++) {
      indices.push(bottomCenterIdx, s + 1, s);
    }
    
    // Solid top cap
    const topRingStart = heightSegments * (segments + 1);
    const topCenterIdx = vertices.length / 3;
    vertices.push(0, 0, 0);
    for (let s = 0; s < segments; s++) {
      indices.push(topCenterIdx, topRingStart + s, topRingStart + s + 1);
    }
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/**
 * Generate a wireframe cage stand (Akari-inspired)
 * Vertical ribs connected by horizontal rings
 */
export function generateWireframeCage(
  baseRadius: number,
  height: number,
  ribCount: number,
  ringCount: number,
  thickness: number
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const ribRadius = thickness / 2;
  const segments = 8;
  
  // Create vertical ribs
  for (let r = 0; r < ribCount; r++) {
    const angle = (r / ribCount) * Math.PI * 2;
    const ribVerts: number[] = [];
    const ribIndices: number[] = [];
    
    // Start at bottom, go to top (y = -height to y = 0)
    const heightSegs = 16;
    for (let h = 0; h <= heightSegs; h++) {
      const t = h / heightSegs;
      const y = -height + t * height;
      
      // Slight inward curve
      const curve = Math.sin(t * Math.PI) * baseRadius * 0.1;
      const ribDist = baseRadius - curve;
      
      const centerX = Math.cos(angle) * ribDist;
      const centerZ = Math.sin(angle) * ribDist;
      
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        const dx = Math.cos(segAngle) * ribRadius;
        const dy = Math.sin(segAngle) * ribRadius;
        
        // Rotate around the rib axis
        const perpX = -Math.sin(angle);
        const perpZ = Math.cos(angle);
        
        ribVerts.push(
          centerX + perpX * dx,
          y + dy,
          centerZ + perpZ * dx
        );
      }
    }
    
    // Rib surface indices
    for (let h = 0; h < heightSegs; h++) {
      for (let s = 0; s < segments; s++) {
        const a = h * (segments + 1) + s;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;
        ribIndices.push(a, c, b);
        ribIndices.push(b, c, d);
      }
    }
    
    const ribGeo = new THREE.BufferGeometry();
    ribGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribVerts, 3));
    ribGeo.setIndex(ribIndices);
    ribGeo.computeVertexNormals();
    geometries.push(ribGeo);
  }
  
  // Create horizontal rings
  for (let ring = 0; ring < ringCount; ring++) {
    const ringT = (ring + 1) / (ringCount + 1);
    const ringY = -height + ringT * height;
    const curve = Math.sin(ringT * Math.PI) * baseRadius * 0.1;
    const ringRadius = baseRadius - curve;
    
    const torusGeo = createTorus(ringRadius, ribRadius * 0.8, 32, segments, ringY);
    geometries.push(torusGeo);
  }
  
  // Add bottom ring
  const bottomRingGeo = createTorus(baseRadius, ribRadius * 1.2, 32, segments, -height);
  geometries.push(bottomRingGeo);
  
  // Add top ring (smaller to hold shade)
  const topRingGeo = createTorus(baseRadius * 0.9, ribRadius * 1.2, 32, segments, 0);
  geometries.push(topRingGeo);
  
  return mergeGeometries(geometries);
}

/**
 * Create a torus (ring) geometry at a specific Y position
 */
function createTorus(
  radius: number,
  tubeRadius: number,
  radialSegments: number,
  tubularSegments: number,
  y: number
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  for (let j = 0; j <= radialSegments; j++) {
    for (let i = 0; i <= tubularSegments; i++) {
      const u = (i / tubularSegments) * Math.PI * 2;
      const v = (j / radialSegments) * Math.PI * 2;
      
      const x = (radius + tubeRadius * Math.cos(v)) * Math.cos(u);
      const py = y + tubeRadius * Math.sin(v);
      const z = (radius + tubeRadius * Math.cos(v)) * Math.sin(u);
      
      vertices.push(x, py, z);
    }
  }
  
  for (let j = 1; j <= radialSegments; j++) {
    for (let i = 1; i <= tubularSegments; i++) {
      const a = (tubularSegments + 1) * j + i - 1;
      const b = (tubularSegments + 1) * (j - 1) + i - 1;
      const c = (tubularSegments + 1) * (j - 1) + i;
      const d = (tubularSegments + 1) * j + i;
      
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/**
 * Generate a pendant canopy for ceiling mounting
 * Dome shape with screw holes and cord exit
 */
export function generatePendantCanopy(
  diameter: number,
  height: number,
  cordHoleDiameter: number = 8
): THREE.BufferGeometry {
  const segments = 48;
  const heightSegments = 16;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const radius = diameter / 2;
  const cordRadius = cordHoleDiameter / 2;
  const wallThickness = 3; // mm
  
  // Generate dome outer surface (positioned at ceiling, opening down)
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    // Dome curve - starts at rim (t=0), curves up to top (t=1)
    const angle = t * Math.PI / 2;
    const r = radius * Math.cos(angle);
    const y = height * Math.sin(angle); // y goes up from 0 at rim
    
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
    }
  }
  
  // Outer surface indices
  for (let h = 0; h < heightSegments; h++) {
    for (let s = 0; s < segments; s++) {
      const a = h * (segments + 1) + s;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  // Inner surface (offset by wall thickness)
  const innerStart = vertices.length / 3;
  const innerRadius = radius - wallThickness;
  const innerHeight = height - wallThickness;
  
  for (let h = 0; h <= heightSegments; h++) {
    const t = h / heightSegments;
    const angle = t * Math.PI / 2;
    const r = Math.max(cordRadius + 2, innerRadius * Math.cos(angle));
    const y = innerHeight * Math.sin(angle);
    
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
    }
  }
  
  // Inner surface indices (inverted winding)
  for (let h = 0; h < heightSegments; h++) {
    for (let s = 0; s < segments; s++) {
      const a = innerStart + h * (segments + 1) + s;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  
  // Rim at bottom (connect outer to inner)
  const outerRimStart = 0;
  const innerRimStart = innerStart;
  for (let s = 0; s < segments; s++) {
    const outerA = outerRimStart + s;
    const outerB = outerRimStart + s + 1;
    const innerA = innerRimStart + s;
    const innerB = innerRimStart + s + 1;
    indices.push(outerA, outerB, innerA);
    indices.push(innerA, outerB, innerB);
  }
  
  // Cord hole at top (simple hole - inner top ring already there)
  // Add screw hole indicators (3 holes at 120° intervals)
  const screwHoleRadius = 2.5; // M5 screw
  const screwHoleDistance = radius * 0.6;
  
  for (let i = 0; i < 3; i++) {
    const screwAngle = (i / 3) * Math.PI * 2;
    const screwX = Math.cos(screwAngle) * screwHoleDistance;
    const screwZ = Math.sin(screwAngle) * screwHoleDistance;
    
    // Visual indicator - small cylinder
    const holeStart = vertices.length / 3;
    const holeSegs = 12;
    
    for (let s = 0; s <= holeSegs; s++) {
      const theta = (s / holeSegs) * Math.PI * 2;
      vertices.push(
        screwX + Math.cos(theta) * screwHoleRadius,
        0,
        screwZ + Math.sin(theta) * screwHoleRadius
      );
    }
    
    for (let s = 0; s <= holeSegs; s++) {
      const theta = (s / holeSegs) * Math.PI * 2;
      vertices.push(
        screwX + Math.cos(theta) * screwHoleRadius,
        wallThickness,
        screwZ + Math.sin(theta) * screwHoleRadius
      );
    }
    
    // Hole wall (inverted for inside view)
    for (let s = 0; s < holeSegs; s++) {
      const a = holeStart + s;
      const b = holeStart + s + 1;
      const c = holeStart + holeSegs + 1 + s;
      const d = holeStart + holeSegs + 1 + s + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/**
 * Generate a wall bracket with backplate and optional arm
 */
export function generateWallBracket(
  plateSize: number,
  armLength: number,
  armAngle: number,
  shadeRadius: number,
  cordHoleDiameter: number = 8
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plateThickness = 8; // mm
  const armThickness = 12; // mm
  const armAngleRad = (armAngle * Math.PI) / 180;
  
  // Wall plate (flat square/rectangle)
  const plateVerts: number[] = [];
  const plateIndices: number[] = [];
  const half = plateSize / 2;
  
  // Front face (facing room, at z=0)
  plateVerts.push(-half, -half, 0);
  plateVerts.push(half, -half, 0);
  plateVerts.push(half, half, 0);
  plateVerts.push(-half, half, 0);
  
  // Back face (against wall)
  plateVerts.push(-half, -half, -plateThickness);
  plateVerts.push(half, -half, -plateThickness);
  plateVerts.push(half, half, -plateThickness);
  plateVerts.push(-half, half, -plateThickness);
  
  // Front face
  plateIndices.push(0, 1, 2, 0, 2, 3);
  // Back face
  plateIndices.push(4, 6, 5, 4, 7, 6);
  // Sides
  plateIndices.push(0, 4, 5, 0, 5, 1); // bottom
  plateIndices.push(2, 6, 7, 2, 7, 3); // top
  plateIndices.push(0, 3, 7, 0, 7, 4); // left
  plateIndices.push(1, 5, 6, 1, 6, 2); // right
  
  const plateGeo = new THREE.BufferGeometry();
  plateGeo.setAttribute('position', new THREE.Float32BufferAttribute(plateVerts, 3));
  plateGeo.setIndex(plateIndices);
  plateGeo.computeVertexNormals();
  geometries.push(plateGeo);
  
  // Arm extending from plate
  if (armLength > 0) {
    const armGeo = createArm(armLength, armThickness, armAngleRad, cordHoleDiameter);
    geometries.push(armGeo);
    
    // End ring to hold shade
    const endX = armLength * Math.cos(armAngleRad);
    const endY = armLength * Math.sin(armAngleRad);
    const ringGeo = createTorus(shadeRadius * 0.8, armThickness / 3, 24, 8, 0);
    
    // Transform ring to arm end position
    const ringPositions = ringGeo.getAttribute('position').array as Float32Array;
    for (let i = 0; i < ringPositions.length; i += 3) {
      ringPositions[i] += endX;
      ringPositions[i + 1] += endY;
    }
    ringGeo.getAttribute('position').needsUpdate = true;
    ringGeo.computeVertexNormals();
    geometries.push(ringGeo);
  }
  
  return mergeGeometries(geometries);
}

/**
 * Create arm geometry for wall bracket
 */
function createArm(
  length: number,
  thickness: number,
  angle: number,
  cordHoleDiameter: number
): THREE.BufferGeometry {
  const segments = 12;
  const lengthSegs = 16;
  const radius = thickness / 2;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Arm as tapered cylinder along angled path
  for (let l = 0; l <= lengthSegs; l++) {
    const t = l / lengthSegs;
    const px = t * length * Math.cos(angle);
    const py = t * length * Math.sin(angle);
    const r = radius * (1 - t * 0.2); // Slight taper
    
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      vertices.push(
        px + Math.cos(theta) * r * Math.sin(angle + Math.PI / 2),
        py + Math.cos(theta) * r * Math.cos(angle + Math.PI / 2),
        Math.sin(theta) * r
      );
    }
  }
  
  // Surface indices
  for (let l = 0; l < lengthSegs; l++) {
    for (let s = 0; s < segments; s++) {
      const a = l * (segments + 1) + s;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  // End caps
  const startCenter = vertices.length / 3;
  vertices.push(0, 0, 0);
  for (let s = 0; s < segments; s++) {
    indices.push(startCenter, s + 1, s);
  }
  
  const endCenter = vertices.length / 3;
  const endX = length * Math.cos(angle);
  const endY = length * Math.sin(angle);
  vertices.push(endX, endY, 0);
  const lastRingStart = lengthSegs * (segments + 1);
  for (let s = 0; s < segments; s++) {
    indices.push(endCenter, lastRingStart + s, lastRingStart + s + 1);
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/**
 * Generate a simple ring base (torus on ground)
 */
export function generateRingBase(
  diameter: number,
  thickness: number,
  cordHoleDiameter: number = 8
): THREE.BufferGeometry {
  const radius = diameter / 2;
  const tubeRadius = thickness / 2;
  
  // Create torus at y = 0 (sitting on ground level at -tubeRadius)
  const geo = createTorus(radius, tubeRadius, 48, 24, -tubeRadius);
  
  return geo;
}

/**
 * Generate a wall mount plate (sconce style)
 * Flat plate with keyhole/screw holes and optional bulb fixture opening
 */
export function generateWallMount(
  plateShape: 'circle' | 'rectangle' | 'rounded_rectangle',
  plateWidth: number,
  plateHeight: number,
  plateThickness: number,
  holeType: 'keyhole' | 'screw' | 'adhesive',
  holeCount: 2 | 3 | 4,
  bulbFixture: boolean,
  objectRadius: number,
  cordHoleDiameter: number = 8
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const segments = 48;
  const halfW = plateWidth / 2;
  const halfH = plateHeight / 2;
  const cornerRadius = Math.min(plateWidth, plateHeight) * 0.15;
  
  // Generate plate outline vertices based on shape
  const outlineVerts: { x: number; y: number }[] = [];
  
  if (plateShape === 'circle') {
    const radius = Math.min(halfW, halfH);
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      outlineVerts.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
  } else if (plateShape === 'rectangle') {
    // Simple rectangle
    outlineVerts.push({ x: -halfW, y: -halfH });
    outlineVerts.push({ x: halfW, y: -halfH });
    outlineVerts.push({ x: halfW, y: halfH });
    outlineVerts.push({ x: -halfW, y: halfH });
  } else {
    // Rounded rectangle
    const cr = cornerRadius;
    const cornerSegs = 8;
    
    // Bottom-left corner
    for (let i = 0; i <= cornerSegs; i++) {
      const angle = Math.PI + (i / cornerSegs) * (Math.PI / 2);
      outlineVerts.push({ x: -halfW + cr + Math.cos(angle) * cr, y: -halfH + cr + Math.sin(angle) * cr });
    }
    // Bottom-right corner
    for (let i = 0; i <= cornerSegs; i++) {
      const angle = -Math.PI / 2 + (i / cornerSegs) * (Math.PI / 2);
      outlineVerts.push({ x: halfW - cr + Math.cos(angle) * cr, y: -halfH + cr + Math.sin(angle) * cr });
    }
    // Top-right corner
    for (let i = 0; i <= cornerSegs; i++) {
      const angle = 0 + (i / cornerSegs) * (Math.PI / 2);
      outlineVerts.push({ x: halfW - cr + Math.cos(angle) * cr, y: halfH - cr + Math.sin(angle) * cr });
    }
    // Top-left corner
    for (let i = 0; i <= cornerSegs; i++) {
      const angle = Math.PI / 2 + (i / cornerSegs) * (Math.PI / 2);
      outlineVerts.push({ x: -halfW + cr + Math.cos(angle) * cr, y: halfH - cr + Math.sin(angle) * cr });
    }
  }
  
  // Front face (z = plateThickness, facing room)
  const frontStart = vertices.length / 3;
  for (const v of outlineVerts) {
    vertices.push(v.x, v.y, plateThickness);
  }
  // Center of front face
  const frontCenterIdx = vertices.length / 3;
  vertices.push(0, 0, plateThickness);
  
  // Front face triangles (fan from center)
  for (let i = 0; i < outlineVerts.length - 1; i++) {
    indices.push(frontCenterIdx, frontStart + i, frontStart + i + 1);
  }
  if (plateShape !== 'rectangle') {
    indices.push(frontCenterIdx, frontStart + outlineVerts.length - 1, frontStart);
  }
  
  // Back face (z = 0, against wall)
  const backStart = vertices.length / 3;
  for (const v of outlineVerts) {
    vertices.push(v.x, v.y, 0);
  }
  // Center of back face
  const backCenterIdx = vertices.length / 3;
  vertices.push(0, 0, 0);
  
  // Back face triangles (reversed winding)
  for (let i = 0; i < outlineVerts.length - 1; i++) {
    indices.push(backCenterIdx, backStart + i + 1, backStart + i);
  }
  if (plateShape !== 'rectangle') {
    indices.push(backCenterIdx, backStart, backStart + outlineVerts.length - 1);
  }
  
  // Side walls (connect front to back)
  for (let i = 0; i < outlineVerts.length - 1; i++) {
    const a = frontStart + i;
    const b = frontStart + i + 1;
    const c = backStart + i;
    const d = backStart + i + 1;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  // Close the loop for non-rectangle shapes
  if (plateShape !== 'rectangle') {
    const a = frontStart + outlineVerts.length - 1;
    const b = frontStart;
    const c = backStart + outlineVerts.length - 1;
    const d = backStart;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  const plateGeo = new THREE.BufferGeometry();
  plateGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  plateGeo.setIndex(indices);
  plateGeo.computeVertexNormals();
  geometries.push(plateGeo);
  
  // Add mounting holes
  const holeGeos = generateMountingHoles(holeType, holeCount, plateWidth, plateHeight, plateThickness);
  geometries.push(...holeGeos);
  
  // Add bulb fixture opening (raised ring for socket alignment)
  if (bulbFixture) {
    const fixtureGeo = generateBulbFixture(objectRadius, plateThickness, cordHoleDiameter);
    geometries.push(fixtureGeo);
  }
  
  return mergeGeometries(geometries);
}

/**
 * Generate mounting holes (keyhole slots, screw holes, or adhesive pad markers)
 */
function generateMountingHoles(
  holeType: 'keyhole' | 'screw' | 'adhesive',
  holeCount: 2 | 3 | 4,
  plateWidth: number,
  plateHeight: number,
  plateThickness: number
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  
  // Calculate hole positions
  const positions: { x: number; y: number }[] = [];
  const marginX = plateWidth * 0.25;
  const marginY = plateHeight * 0.25;
  
  if (holeCount === 2) {
    // Two holes: top and bottom center
    positions.push({ x: 0, y: plateHeight / 2 - marginY });
    positions.push({ x: 0, y: -plateHeight / 2 + marginY });
  } else if (holeCount === 3) {
    // Three holes: triangle pattern
    positions.push({ x: 0, y: plateHeight / 2 - marginY });
    positions.push({ x: -plateWidth / 2 + marginX, y: -plateHeight / 2 + marginY });
    positions.push({ x: plateWidth / 2 - marginX, y: -plateHeight / 2 + marginY });
  } else {
    // Four holes: corners
    positions.push({ x: -plateWidth / 2 + marginX, y: plateHeight / 2 - marginY });
    positions.push({ x: plateWidth / 2 - marginX, y: plateHeight / 2 - marginY });
    positions.push({ x: -plateWidth / 2 + marginX, y: -plateHeight / 2 + marginY });
    positions.push({ x: plateWidth / 2 - marginX, y: -plateHeight / 2 + marginY });
  }
  
  for (const pos of positions) {
    if (holeType === 'keyhole') {
      geometries.push(generateKeyholeSlot(pos.x, pos.y, plateThickness));
    } else if (holeType === 'screw') {
      geometries.push(generateScrewHole(pos.x, pos.y, plateThickness));
    } else {
      geometries.push(generateAdhesivePad(pos.x, pos.y, plateThickness));
    }
  }
  
  return geometries;
}

/**
 * Generate a keyhole slot for easy wall mounting
 */
function generateKeyholeSlot(x: number, y: number, thickness: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const headRadius = 5;      // Screw head passes through
  const shankRadius = 2.5;   // Screw shank slot
  const slotLength = 8;      // Vertical drop distance
  const segments = 16;
  
  // Front opening (large circle at top)
  const topCenterY = y + slotLength / 2;
  const bottomCenterY = y - slotLength / 2;
  
  // Create the keyhole shape outline (on front face, z = thickness)
  const outlineVerts: { px: number; py: number }[] = [];
  
  // Top circle (head hole)
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI / 2 + (i / segments) * Math.PI; // Top half
    outlineVerts.push({ px: x + Math.cos(angle) * headRadius, py: topCenterY + Math.sin(angle) * headRadius });
  }
  
  // Right side of slot
  outlineVerts.push({ px: x + shankRadius, py: topCenterY });
  outlineVerts.push({ px: x + shankRadius, py: bottomCenterY });
  
  // Bottom circle (shank slot end)
  for (let i = 0; i <= segments / 2; i++) {
    const angle = -Math.PI / 2 + (i / (segments / 2)) * Math.PI; // Bottom half
    outlineVerts.push({ px: x + Math.cos(angle) * shankRadius, py: bottomCenterY + Math.sin(angle) * shankRadius });
  }
  
  // Left side of slot
  outlineVerts.push({ px: x - shankRadius, py: bottomCenterY });
  outlineVerts.push({ px: x - shankRadius, py: topCenterY });
  
  // Create hole through plate (front and back faces with inverted normals)
  const frontStart = vertices.length / 3;
  for (const v of outlineVerts) {
    vertices.push(v.px, v.py, thickness + 0.1); // Slightly in front
  }
  
  const backStart = vertices.length / 3;
  for (const v of outlineVerts) {
    vertices.push(v.px, v.py, -0.1); // Slightly behind
  }
  
  // Hole walls (connect front to back)
  for (let i = 0; i < outlineVerts.length - 1; i++) {
    const a = frontStart + i;
    const b = frontStart + i + 1;
    const c = backStart + i;
    const d = backStart + i + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  // Close the loop
  const last = outlineVerts.length - 1;
  indices.push(frontStart + last, backStart + last, frontStart);
  indices.push(frontStart, backStart + last, backStart);
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/**
 * Generate a simple screw hole
 */
function generateScrewHole(x: number, y: number, thickness: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const holeRadius = 3;
  const segments = 16;
  
  // Front ring
  const frontStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(x + Math.cos(angle) * holeRadius, y + Math.sin(angle) * holeRadius, thickness + 0.1);
  }
  
  // Back ring
  const backStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(x + Math.cos(angle) * holeRadius, y + Math.sin(angle) * holeRadius, -0.1);
  }
  
  // Hole walls
  for (let i = 0; i < segments; i++) {
    const a = frontStart + i;
    const b = frontStart + i + 1;
    const c = backStart + i;
    const d = backStart + i + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/**
 * Generate adhesive pad marker (visual indicator, slight recess)
 */
function generateAdhesivePad(x: number, y: number, thickness: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const padRadius = 10;
  const recessDepth = 1;
  const segments = 24;
  
  // Outer ring (at surface level)
  const outerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(x + Math.cos(angle) * padRadius, y + Math.sin(angle) * padRadius, thickness);
  }
  
  // Inner ring (recessed)
  const innerStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(x + Math.cos(angle) * (padRadius * 0.8), y + Math.sin(angle) * (padRadius * 0.8), thickness - recessDepth);
  }
  
  // Center (recessed)
  const centerIdx = vertices.length / 3;
  vertices.push(x, y, thickness - recessDepth);
  
  // Connect outer to inner (sloped edge)
  for (let i = 0; i < segments; i++) {
    const a = outerStart + i;
    const b = outerStart + i + 1;
    const c = innerStart + i;
    const d = innerStart + i + 1;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  // Inner face (fan from center)
  for (let i = 0; i < segments; i++) {
    indices.push(centerIdx, innerStart + i + 1, innerStart + i);
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/**
 * Generate bulb fixture opening with centering ring
 */
function generateBulbFixture(objectRadius: number, plateThickness: number, cordHoleDiameter: number): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Fixture ring dimensions
  const outerRadius = objectRadius * 0.8; // Socket opening slightly smaller than object
  const innerRadius = cordHoleDiameter / 2 + 2; // Cord hole with margin
  const ringHeight = 4; // Raised ring height
  const wallThickness = 3;
  const segments = 32;
  
  // Ring sits on the front face of the plate, centered
  const baseZ = plateThickness;
  
  // Outer wall - bottom ring
  const outerBottomStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius, baseZ);
  }
  
  // Outer wall - top ring
  const outerTopStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius, baseZ + ringHeight);
  }
  
  // Inner wall (inside of ring) - bottom ring
  const innerOuterBottomStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * (outerRadius - wallThickness), Math.sin(angle) * (outerRadius - wallThickness), baseZ);
  }
  
  // Inner wall - top ring
  const innerOuterTopStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * (outerRadius - wallThickness), Math.sin(angle) * (outerRadius - wallThickness), baseZ + ringHeight);
  }
  
  // Outer surface
  for (let i = 0; i < segments; i++) {
    const a = outerBottomStart + i;
    const b = outerBottomStart + i + 1;
    const c = outerTopStart + i;
    const d = outerTopStart + i + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  
  // Inner surface (reversed winding)
  for (let i = 0; i < segments; i++) {
    const a = innerOuterBottomStart + i;
    const b = innerOuterBottomStart + i + 1;
    const c = innerOuterTopStart + i;
    const d = innerOuterTopStart + i + 1;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  // Top ring (connect outer top to inner top)
  for (let i = 0; i < segments; i++) {
    const a = outerTopStart + i;
    const b = outerTopStart + i + 1;
    const c = innerOuterTopStart + i;
    const d = innerOuterTopStart + i + 1;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  // Cord hole in center (through plate)
  const cordHoleRadius = cordHoleDiameter / 2;
  const cordFrontStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * cordHoleRadius, Math.sin(angle) * cordHoleRadius, baseZ + 0.1);
  }
  
  const cordBackStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * cordHoleRadius, Math.sin(angle) * cordHoleRadius, -0.1);
  }
  
  // Cord hole walls
  for (let i = 0; i < segments; i++) {
    const a = cordFrontStart + i;
    const b = cordFrontStart + i + 1;
    const c = cordBackStart + i;
    const d = cordBackStart + i + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  return geo;
}

/**
 * Main dispatcher function - generates the appropriate stand based on type
 */
export function generateStand(params: StandParams, organicParams?: OrganicParams): THREE.BufferGeometry | null {
  switch (params.standType) {
    case 'wall_mount':
      return generateWallMount(
        params.wallMountPlateShape,
        params.wallMountPlateWidth,
        params.wallMountPlateHeight,
        params.wallMountPlateThickness,
        params.wallMountHoleType,
        params.wallMountHoleCount,
        params.wallMountBulbFixture,
        params.baseRadius,
        params.cordHoleDiameter || 8
      );
      
    case 'tripod':
    default:
      // Tripod is handled by existing generateLegsWithBase
      return null;
  }
}
