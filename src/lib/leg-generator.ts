import * as THREE from 'three';

/**
 * Leg style types
 */
export type LegStyle = 'tripod' | 'riser' | 'column' | 'ball';

/**
 * Organic deformation parameters for base disc
 */
export interface OrganicParams {
  wobbleFrequency: number;
  wobbleAmplitude: number;
  rippleCount: number;
  rippleDepth: number;
  asymmetry: number;
  organicNoise: number;
  noiseScale: number;
}

/**
 * Pedestal-style base parameters
 */
export interface PedestalParams {
  thickness: number;       // mm - height of the base disc (2-30mm)
  taper: number;           // 0-0.5 - taper from bottom to top
  edgeStyle: 'flat' | 'rounded' | 'chamfer';  // edge profile style
  lip: number;             // mm - raised lip height around edge (0-10mm)
}

/**
 * Simple socket/cord parameters
 */
export interface SocketParams {
  wallThickness: number;
  cordHoleEnabled?: boolean;
  cordHoleDiameter?: number;
}

// Deterministic noise for consistent results
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

/**
 * Calculate deformed radius at a given angle
 */
function calculateDeformedRadius(
  theta: number,
  baseRadius: number,
  organicParams?: OrganicParams
): number {
  if (!organicParams) return baseRadius;
  
  const {
    wobbleFrequency,
    wobbleAmplitude,
    rippleCount,
    rippleDepth,
    asymmetry,
    organicNoise,
    noiseScale,
  } = organicParams;
  
  let r = baseRadius;
  const t = 0;
  
  if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
    const maxWobble = Math.min(wobbleAmplitude, 0.15);
    r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * baseRadius;
  }
  
  if (rippleCount > 0 && rippleDepth > 0) {
    const maxRipple = Math.min(rippleDepth, 0.1);
    r += Math.sin(theta * rippleCount) * maxRipple * baseRadius;
  }
  
  if (asymmetry > 0) {
    const primaryWave = Math.sin(theta) * Math.cos(t * Math.PI) * asymmetry * baseRadius;
    const secondaryWave = Math.sin(theta * 2 + t * Math.PI * 3) * asymmetry * 0.3 * baseRadius;
    r += primaryWave + secondaryWave;
  }
  
  if (organicNoise > 0) {
    const maxNoise = Math.min(organicNoise, 0.1);
    const nx = Math.cos(theta) * r;
    const nz = Math.sin(theta) * r;
    r += noise3D(nx * 0.1, 0, nz * 0.1, noiseScale) * maxNoise * baseRadius;
  }
  
  return Math.max(r, baseRadius * 0.5);
}

/**
 * Generate legs with a base disc.
 * Base disc top is at y=0, legs extend downward.
 */
export function generateLegsWithBase(
  baseRadius: number,
  legCount: 3 | 4,
  legHeight: number,
  legSpread: number,
  legThickness: number,
  legTaper: number,
  legInset: number = 0.3,
  baseThickness: number = 3,
  organicParams?: OrganicParams,
  socketParams?: SocketParams,
  _attachmentParams?: unknown,
  pedestalParams?: PedestalParams,
  legStyle: LegStyle = 'tripod'
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const effectiveThickness = pedestalParams?.thickness ?? baseThickness;
  
  // Create base disc
  const discGeo = createBaseDisc(baseRadius, effectiveThickness, organicParams, socketParams, pedestalParams);
  geometries.push(discGeo);
  
  const discBottom = -effectiveThickness;
  
  // Generate legs based on style
  switch (legStyle) {
    case 'riser':
      geometries.push(...createRiserLegs(baseRadius, legCount, legHeight, legSpread, legThickness, legInset, discBottom, organicParams));
      break;
    case 'column':
      geometries.push(...createColumnLegs(baseRadius, legCount, legHeight, legThickness, legInset, discBottom, organicParams));
      break;
    case 'ball':
      geometries.push(...createBallFeet(baseRadius, legCount, legThickness, legInset, discBottom, organicParams));
      break;
    case 'tripod':
    default:
      geometries.push(...createTripodLegs(baseRadius, legCount, legHeight, legSpread, legThickness, legTaper, legInset, discBottom, organicParams));
      break;
  }
  
  return mergeGeometries(geometries);
}

/**
 * Create classic tripod legs - angled outward
 */
function createTripodLegs(
  baseRadius: number,
  legCount: 3 | 4,
  legHeight: number,
  legSpread: number,
  legThickness: number,
  legTaper: number,
  legInset: number,
  discBottom: number,
  organicParams?: OrganicParams
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const spreadRad = (legSpread * Math.PI) / 180;
  const segments = 8;
  const heightSegments = 12;
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    const deformedRadius = calculateDeformedRadius(angle, baseRadius, organicParams);
    const attachRadius = deformedRadius * (1 - legInset * 0.7);
    
    const attachX = Math.cos(angle) * attachRadius;
    const attachZ = Math.sin(angle) * attachRadius;
    
    const outwardX = Math.cos(angle);
    const outwardZ = Math.sin(angle);
    
    const horizontalDist = Math.sin(spreadRad) * legHeight;
    const verticalDist = Math.cos(spreadRad) * legHeight;
    
    const footX = attachX + outwardX * horizontalDist;
    const footZ = attachZ + outwardZ * horizontalDist;
    const footY = discBottom - verticalDist;
    
    const legVerts: number[] = [];
    const legIndices: number[] = [];
    
    // Leg direction
    const legDirX = footX - attachX;
    const legDirY = footY - discBottom;
    const legDirZ = footZ - attachZ;
    const legLen = Math.sqrt(legDirX * legDirX + legDirY * legDirY + legDirZ * legDirZ);
    
    const dirX = legDirX / legLen;
    const dirY = legDirY / legLen;
    const dirZ = legDirZ / legLen;
    
    // Perpendicular vectors
    let perpX = -dirZ;
    let perpZ = dirX;
    const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ);
    if (perpLen > 0.001) {
      perpX /= perpLen;
      perpZ /= perpLen;
    } else {
      perpX = 1;
      perpZ = 0;
    }
    
    const perp2X = dirY * perpZ;
    const perp2Y = dirZ * perpX - dirX * perpZ;
    const perp2Z = -dirY * perpX;
    
    const topRadius = legThickness / 2;
    const bottomRadius = topRadius * (1 - legTaper * 0.6);
    
    // Top ring flush with disc bottom
    for (let s = 0; s <= segments; s++) {
      const segAngle = (s / segments) * Math.PI * 2;
      const cx = Math.cos(segAngle) * perpX + Math.sin(segAngle) * perp2X;
      const cz = Math.cos(segAngle) * perpZ + Math.sin(segAngle) * perp2Z;
      legVerts.push(
        attachX + cx * topRadius,
        discBottom,
        attachZ + cz * topRadius
      );
    }
    
    // Leg body rings
    for (let h = 1; h <= heightSegments; h++) {
      const t = h / heightSegments;
      const px = attachX + (footX - attachX) * t;
      const py = discBottom + (footY - discBottom) * t;
      const pz = attachZ + (footZ - attachZ) * t;
      const r = topRadius + (bottomRadius - topRadius) * t;
      
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        const cx = Math.cos(segAngle) * perpX + Math.sin(segAngle) * perp2X;
        const cy = Math.sin(segAngle) * perp2Y;
        const cz = Math.cos(segAngle) * perpZ + Math.sin(segAngle) * perp2Z;
        legVerts.push(px + cx * r, py + cy * r, pz + cz * r);
      }
    }
    
    // Index faces
    for (let h = 0; h < heightSegments; h++) {
      for (let s = 0; s < segments; s++) {
        const a = h * (segments + 1) + s;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;
        legIndices.push(a, c, b);
        legIndices.push(b, c, d);
      }
    }
    
    // Foot cap
    const footCenterIdx = legVerts.length / 3;
    legVerts.push(footX, footY, footZ);
    const lastRingStart = heightSegments * (segments + 1);
    for (let s = 0; s < segments; s++) {
      legIndices.push(lastRingStart + s, footCenterIdx, lastRingStart + s + 1);
    }
    
    // Top cap
    const topCenterIdx = legVerts.length / 3;
    legVerts.push(attachX, discBottom, attachZ);
    for (let s = 0; s < segments; s++) {
      legIndices.push(s + 1, topCenterIdx, s);
    }
    
    const legGeo = new THREE.BufferGeometry();
    legGeo.setAttribute('position', new THREE.Float32BufferAttribute(legVerts, 3));
    legGeo.setIndex(legIndices);
    legGeo.computeVertexNormals();
    geometries.push(legGeo);
  }
  
  return geometries;
}

/**
 * Create riser legs - small stubby feet for table lamps
 */
function createRiserLegs(
  baseRadius: number,
  legCount: 3 | 4,
  legHeight: number,
  legSpread: number,
  legThickness: number,
  legInset: number,
  discBottom: number,
  organicParams?: OrganicParams
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const segments = 12;
  
  // Risers are short and stubby with slight outward spread
  const effectiveHeight = Math.min(legHeight, 20); // Cap at 20mm for risers
  const spreadRad = (Math.min(legSpread, 10) * Math.PI) / 180; // Max 10° spread
  const riserRadius = legThickness * 0.8; // Wider than tall
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    const deformedRadius = calculateDeformedRadius(angle, baseRadius, organicParams);
    const attachRadius = deformedRadius * (1 - legInset * 0.5);
    
    const attachX = Math.cos(angle) * attachRadius;
    const attachZ = Math.sin(angle) * attachRadius;
    
    // Slight outward spread
    const outwardX = Math.cos(angle) * Math.sin(spreadRad) * effectiveHeight;
    const outwardZ = Math.sin(angle) * Math.sin(spreadRad) * effectiveHeight;
    
    const footX = attachX + outwardX;
    const footZ = attachZ + outwardZ;
    const footY = discBottom - effectiveHeight * Math.cos(spreadRad);
    
    // Create a tapered cylinder (wider at bottom)
    const verts: number[] = [];
    const indices: number[] = [];
    const heightSegs = 4;
    
    for (let h = 0; h <= heightSegs; h++) {
      const t = h / heightSegs;
      const y = discBottom - t * (discBottom - footY);
      const cx = attachX + t * (footX - attachX);
      const cz = attachZ + t * (footZ - attachZ);
      // Wider at bottom (inverse taper)
      const r = riserRadius * (1 + t * 0.3);
      
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        verts.push(
          cx + Math.cos(segAngle) * r,
          y,
          cz + Math.sin(segAngle) * r
        );
      }
    }
    
    // Side faces
    for (let h = 0; h < heightSegs; h++) {
      for (let s = 0; s < segments; s++) {
        const a = h * (segments + 1) + s;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    
    // Top cap
    const topCenterIdx = verts.length / 3;
    verts.push(attachX, discBottom, attachZ);
    for (let s = 0; s < segments; s++) {
      indices.push(s + 1, topCenterIdx, s);
    }
    
    // Bottom cap
    const bottomCenterIdx = verts.length / 3;
    verts.push(footX, footY, footZ);
    const lastRingStart = heightSegs * (segments + 1);
    for (let s = 0; s < segments; s++) {
      indices.push(lastRingStart + s, bottomCenterIdx, lastRingStart + s + 1);
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geometries.push(geo);
  }
  
  return geometries;
}

/**
 * Create column legs - straight vertical legs, no spread
 */
function createColumnLegs(
  baseRadius: number,
  legCount: 3 | 4,
  legHeight: number,
  legThickness: number,
  legInset: number,
  discBottom: number,
  organicParams?: OrganicParams
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const segments = 8;
  const heightSegments = 8;
  const radius = legThickness / 2;
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    const deformedRadius = calculateDeformedRadius(angle, baseRadius, organicParams);
    const attachRadius = deformedRadius * (1 - legInset * 0.7);
    
    const cx = Math.cos(angle) * attachRadius;
    const cz = Math.sin(angle) * attachRadius;
    
    const verts: number[] = [];
    const indices: number[] = [];
    
    // Straight vertical cylinder
    for (let h = 0; h <= heightSegments; h++) {
      const t = h / heightSegments;
      const y = discBottom - t * legHeight;
      
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        verts.push(
          cx + Math.cos(segAngle) * radius,
          y,
          cz + Math.sin(segAngle) * radius
        );
      }
    }
    
    // Side faces
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
    
    // Top cap
    const topCenterIdx = verts.length / 3;
    verts.push(cx, discBottom, cz);
    for (let s = 0; s < segments; s++) {
      indices.push(s + 1, topCenterIdx, s);
    }
    
    // Bottom cap
    const bottomCenterIdx = verts.length / 3;
    const footY = discBottom - legHeight;
    verts.push(cx, footY, cz);
    const lastRingStart = heightSegments * (segments + 1);
    for (let s = 0; s < segments; s++) {
      indices.push(lastRingStart + s, bottomCenterIdx, lastRingStart + s + 1);
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geometries.push(geo);
  }
  
  return geometries;
}

/**
 * Create ball feet - spherical feet at each position
 */
function createBallFeet(
  baseRadius: number,
  legCount: 3 | 4,
  legThickness: number,
  legInset: number,
  discBottom: number,
  organicParams?: OrganicParams
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const ballRadius = legThickness / 2;
  const widthSegs = 16;
  const heightSegs = 12;
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    const deformedRadius = calculateDeformedRadius(angle, baseRadius, organicParams);
    const attachRadius = deformedRadius * (1 - legInset * 0.5);
    
    const cx = Math.cos(angle) * attachRadius;
    const cz = Math.sin(angle) * attachRadius;
    const cy = discBottom - ballRadius; // Center of sphere
    
    // Create sphere geometry manually for positioning
    const sphereGeo = new THREE.SphereGeometry(ballRadius, widthSegs, heightSegs);
    sphereGeo.translate(cx, cy, cz);
    geometries.push(sphereGeo);
  }
  
  return geometries;
}

/**
 * Create simple base disc with optional cord hole and pedestal styling
 */
function createBaseDisc(
  radius: number,
  thickness: number,
  organicParams?: OrganicParams,
  socketParams?: SocketParams,
  pedestalParams?: PedestalParams
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const taper = pedestalParams?.taper ?? 0;
  const lip = pedestalParams?.lip ?? 0;
  const bottomRadius = radius * (1 - taper);
  
  const cordHoleEnabled = socketParams?.cordHoleEnabled ?? false;
  const cordHoleDiameter = socketParams?.cordHoleDiameter ?? 8;
  const cordHoleRadius = cordHoleDiameter / 2;
  
  const getOuterRadius = (theta: number) => calculateDeformedRadius(theta, radius, organicParams);
  const getBottomRadius = (theta: number) => calculateDeformedRadius(theta, bottomRadius, organicParams);
  
  if (cordHoleEnabled) {
    // Disc with cord hole
    
    // Top surface outer ring (y=0 or y=lip if we have a lip)
    const topY = lip > 0 ? lip : 0;
    const topOuterStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getOuterRadius(theta);
      vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
    }
    
    // Top surface inner ring (cord hole)
    const topInnerStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * cordHoleRadius, topY, Math.sin(theta) * cordHoleRadius);
    }
    
    // Top surface (ring between outer and hole)
    for (let i = 0; i < segments; i++) {
      indices.push(topOuterStart + i, topInnerStart + i, topOuterStart + i + 1);
      indices.push(topOuterStart + i + 1, topInnerStart + i, topInnerStart + i + 1);
    }
    
    // If lip > 0, add inner wall (the lip rim going down from topY to 0)
    if (lip > 0) {
      const lipBottomOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
      
      // Inner surface of the lip (vertical wall from top to platform)
      for (let i = 0; i < segments; i++) {
        indices.push(topOuterStart + i, lipBottomOuterStart + i + 1, lipBottomOuterStart + i);
        indices.push(topOuterStart + i, topOuterStart + i + 1, lipBottomOuterStart + i + 1);
      }
    }
    
    // Bottom surface outer ring
    const bottomOuterStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getBottomRadius(theta);
      vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
    }
    
    // Bottom surface inner ring (cord hole)
    const bottomInnerStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      vertices.push(Math.cos(theta) * cordHoleRadius, -thickness, Math.sin(theta) * cordHoleRadius);
    }
    
    // Bottom surface (inverted)
    for (let i = 0; i < segments; i++) {
      indices.push(bottomOuterStart + i, bottomOuterStart + i + 1, bottomInnerStart + i);
      indices.push(bottomOuterStart + i + 1, bottomInnerStart + i + 1, bottomInnerStart + i);
    }
    
    // Outer wall (from lip top or top down to bottom)
    const outerWallTopStart = lip > 0 ? (vertices.length / 3 - 2 * (segments + 1) - (segments + 1)) : topOuterStart;
    // If lip > 0, we use the lipBottomOuterStart ring, otherwise use topOuterStart
    if (lip > 0) {
      // Wall from lipBottomOuter to bottomOuter
      const lipBottomStart = topOuterStart + (segments + 1) + (segments + 1); // After topOuter, topInner, then lipBottomOuter
      for (let i = 0; i < segments; i++) {
        const lipIdx = topOuterStart + 2 * (segments + 1) + i; // lipBottomOuterStart
        indices.push(lipIdx, bottomOuterStart + i, lipIdx + 1);
        indices.push(lipIdx + 1, bottomOuterStart + i, bottomOuterStart + i + 1);
      }
    } else {
      for (let i = 0; i < segments; i++) {
        indices.push(topOuterStart + i, bottomOuterStart + i, topOuterStart + i + 1);
        indices.push(topOuterStart + i + 1, bottomOuterStart + i, bottomOuterStart + i + 1);
      }
    }
    
    // Cord hole wall (inner, inverted)
    for (let i = 0; i < segments; i++) {
      indices.push(topInnerStart + i, topInnerStart + i + 1, bottomInnerStart + i);
      indices.push(topInnerStart + i + 1, bottomInnerStart + i + 1, bottomInnerStart + i);
    }
  } else {
    // Solid disc (no cord hole)
    const topY = lip > 0 ? lip : 0;
    
    // Top surface
    const topCenterIdx = vertices.length / 3;
    vertices.push(0, topY, 0);
    
    const topRingStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getOuterRadius(theta);
      vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
    }
    
    for (let i = 0; i < segments; i++) {
      indices.push(topCenterIdx, topRingStart + i, topRingStart + i + 1);
    }
    
    // If lip > 0, add a platform at y=0 and inner wall
    let lipBottomRingStart = -1;
    if (lip > 0) {
      lipBottomRingStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
      
      // Inner wall of lip (from topRing down to lipBottomRing)
      for (let i = 0; i < segments; i++) {
        indices.push(topRingStart + i, lipBottomRingStart + i + 1, lipBottomRingStart + i);
        indices.push(topRingStart + i, topRingStart + i + 1, lipBottomRingStart + i + 1);
      }
    }
    
    // Bottom surface
    const bottomCenterIdx = vertices.length / 3;
    vertices.push(0, -thickness, 0);
    
    const bottomRingStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getBottomRadius(theta);
      vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
    }
    
    for (let i = 0; i < segments; i++) {
      indices.push(bottomCenterIdx, bottomRingStart + i + 1, bottomRingStart + i);
    }
    
    // Outer wall
    const wallTopRingStart = lip > 0 ? lipBottomRingStart : topRingStart;
    for (let i = 0; i < segments; i++) {
      indices.push(wallTopRingStart + i, bottomRingStart + i, wallTopRingStart + i + 1);
      indices.push(wallTopRingStart + i + 1, bottomRingStart + i, bottomRingStart + i + 1);
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Generate wall mount base plate with keyhole slots
 */
export function generateBaseMountPlate(
  radius: number,
  thickness: number,
  holeCount: 2 | 3 | 4,
  organicParams?: OrganicParams,
  socketParams?: SocketParams,
  _attachmentParams?: unknown,
  pedestalParams?: PedestalParams
): THREE.BufferGeometry {
  // For wall mount base, create a simple disc without legs
  return createBaseDisc(radius, pedestalParams?.thickness ?? thickness, organicParams, socketParams, pedestalParams);
}

/**
 * Merge multiple geometries into one
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }
  if (geometries.length === 1) {
    return geometries[0];
  }
  
  let totalVerts = 0;
  let totalIndices = 0;
  
  for (const geo of geometries) {
    const pos = geo.getAttribute('position');
    if (pos) totalVerts += pos.count;
    const idx = geo.getIndex();
    if (idx) totalIndices += idx.count;
  }
  
  const mergedPositions = new Float32Array(totalVerts * 3);
  const mergedIndices: number[] = [];
  
  let vertOffset = 0;
  let posOffset = 0;
  
  for (const geo of geometries) {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const idx = geo.getIndex();
    
    if (pos) {
      mergedPositions.set(pos.array as Float32Array, posOffset);
      posOffset += pos.count * 3;
    }
    
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        mergedIndices.push(idx.getX(i) + vertOffset);
      }
    }
    
    if (pos) vertOffset += pos.count;
  }
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
  merged.setIndex(mergedIndices);
  merged.computeVertexNormals();
  
  return merged;
}