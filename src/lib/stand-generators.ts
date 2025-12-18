import * as THREE from 'three';
import { OrganicParams, SocketParams, AttachmentParams } from './leg-generator';

/**
 * Stand-specific parameters
 */
export interface StandParams {
  standType: 'tripod' | 'pedestal' | 'wireframe' | 'pendant' | 'wall_bracket' | 'ring_base';
  baseRadius: number;          // mm - shade base radius for sizing
  
  // Pedestal
  pedestalDiameter: number;    // mm
  pedestalHeight: number;      // mm
  pedestalTaper: number;       // 0-1
  pedestalHollow: boolean;
  
  // Wireframe
  wireframeRibCount: number;
  wireframeRingCount: number;
  wireframeThickness: number;  // mm
  wireframeHeight: number;     // mm
  
  // Pendant
  pendantCanopyDiameter: number;
  pendantCanopyHeight: number;
  pendantCordLength: number;
  
  // Wall bracket
  wallBracketArmLength: number;
  wallBracketArmAngle: number;
  wallBracketPlateSize: number;
  
  // Ring base
  ringBaseDiameter: number;
  ringBaseThickness: number;
  
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
 * Main dispatcher function - generates the appropriate stand based on type
 */
export function generateStand(params: StandParams, organicParams?: OrganicParams): THREE.BufferGeometry | null {
  switch (params.standType) {
    case 'pedestal':
      return generatePedestal(
        params.pedestalDiameter,
        params.pedestalHeight,
        params.pedestalTaper,
        params.pedestalHollow,
        params.cordHoleDiameter || 8,
        organicParams
      );
      
    case 'wireframe':
      return generateWireframeCage(
        params.baseRadius * 1.2, // Slightly larger than shade
        params.wireframeHeight,
        params.wireframeRibCount,
        params.wireframeRingCount,
        params.wireframeThickness
      );
      
    case 'pendant':
      return generatePendantCanopy(
        params.pendantCanopyDiameter,
        params.pendantCanopyHeight,
        params.cordHoleDiameter || 8
      );
      
    case 'wall_bracket':
      return generateWallBracket(
        params.wallBracketPlateSize,
        params.wallBracketArmLength,
        params.wallBracketArmAngle,
        params.baseRadius,
        params.cordHoleDiameter || 8
      );
      
    case 'ring_base':
      return generateRingBase(
        params.ringBaseDiameter,
        params.ringBaseThickness,
        params.cordHoleDiameter || 8
      );
      
    case 'tripod':
    default:
      // Tripod is handled by existing generateLegsWithBase
      return null;
  }
}
