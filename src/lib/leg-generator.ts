import * as THREE from 'three';

/**
 * Leg style types
 */
export type LegStyle = 'tripod' | 'riser' | 'column' | 'bun';

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
  lipThickness?: number;   // mm - lip wall thickness (1.5-8mm)
}

/**
 * Simple socket/cord parameters
 */
export interface SocketParams {
  wallThickness: number;
  cordHoleEnabled?: boolean;
  cordHoleDiameter?: number;
  centeringLipEnabled?: boolean;
  centeringLipHeight?: number;
  socketType?: 'E26' | 'E12' | 'E14' | 'GU10';
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
 * Calculate deformed radius at a given angle (fallback when bottomRadiiArray not provided)
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
 * Get radius at a specific angle, using actual body radii if available
 */
function getRadiusAtAngle(
  theta: number,
  baseRadius: number,
  organicParams?: OrganicParams,
  bottomRadiiArray?: number[]
): number {
  if (bottomRadiiArray && bottomRadiiArray.length > 0) {
    // Use actual radii from body generation
    // Normalize theta to [0, 2π)
    let normalizedTheta = theta % (Math.PI * 2);
    if (normalizedTheta < 0) normalizedTheta += Math.PI * 2;
    
    // Convert to array index (radii are stored for each segment)
    const segmentCount = bottomRadiiArray.length;
    const index = normalizedTheta / (Math.PI * 2) * segmentCount;
    
    // Linear interpolation between adjacent values
    const i0 = Math.floor(index) % segmentCount;
    const i1 = (i0 + 1) % segmentCount;
    const frac = index - Math.floor(index);
    
    return bottomRadiiArray[i0] * (1 - frac) + bottomRadiiArray[i1] * frac;
  }
  
  // Fallback to calculated deformation
  return calculateDeformedRadius(theta, baseRadius, organicParams);
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
  legStyle: LegStyle = 'tripod',
  bottomRadiiArray?: number[]
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const effectiveThickness = pedestalParams?.thickness ?? baseThickness;
  
  // Create base disc with actual bottom radii from body if provided
  const discGeo = createBaseDisc(baseRadius, effectiveThickness, organicParams, socketParams, pedestalParams, bottomRadiiArray);
  geometries.push(discGeo);
  
  const discBottom = -effectiveThickness;
  
  // Generate legs based on style (pass bottomRadiiArray for accurate attachment points)
  switch (legStyle) {
    case 'riser':
      geometries.push(...createRiserLegs(baseRadius, legCount, legHeight, legSpread, legThickness, legInset, discBottom, organicParams, bottomRadiiArray));
      break;
    case 'column':
      geometries.push(...createColumnLegs(baseRadius, legCount, legHeight, legThickness, legInset, discBottom, organicParams, bottomRadiiArray));
      break;
    case 'bun':
      geometries.push(...createBunFeet(baseRadius, legCount, legThickness, legInset, discBottom, organicParams, bottomRadiiArray));
      break;
    case 'tripod':
    default:
      geometries.push(...createTripodLegs(baseRadius, legCount, legHeight, legSpread, legThickness, legTaper, legInset, discBottom, organicParams, bottomRadiiArray));
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
  organicParams?: OrganicParams,
  bottomRadiiArray?: number[]
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const spreadRad = (legSpread * Math.PI) / 180;
  const segments = 8;
  const heightSegments = 12;
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    // Use actual radii from body if available, otherwise use deformation approximation
    const deformedRadius = getRadiusAtAngle(angle, baseRadius, organicParams, bottomRadiiArray);
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
  organicParams?: OrganicParams,
  bottomRadiiArray?: number[]
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const segments = 12;
  
  // Risers are short and stubby with slight outward spread
  const effectiveHeight = Math.min(legHeight, 20); // Cap at 20mm for risers
  const spreadRad = (Math.min(legSpread, 10) * Math.PI) / 180; // Max 10° spread
  const riserRadius = legThickness * 0.8; // Wider than tall
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    const deformedRadius = getRadiusAtAngle(angle, baseRadius, organicParams, bottomRadiiArray);
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
  organicParams?: OrganicParams,
  bottomRadiiArray?: number[]
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const segments = 8;
  const heightSegments = 8;
  const radius = legThickness / 2;
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    const deformedRadius = getRadiusAtAngle(angle, baseRadius, organicParams, bottomRadiiArray);
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
 * Create bun feet - dome-shaped feet that are flat on the print bed (print-friendly)
 * These are squashed ellipsoids with max ~45° overhang for support-free printing
 */
function createBunFeet(
  baseRadius: number,
  legCount: 3 | 4,
  legThickness: number,
  legInset: number,
  discBottom: number,
  organicParams?: OrganicParams,
  bottomRadiiArray?: number[]
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const bunRadius = legThickness / 2;
  // Squash factor: height is 60% of radius for gentle 45° max overhang
  const bunHeight = bunRadius * 0.6;
  const widthSegs = 16;
  const heightSegs = 8;
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    const deformedRadius = getRadiusAtAngle(angle, baseRadius, organicParams, bottomRadiiArray);
    const attachRadius = deformedRadius * (1 - legInset * 0.5);
    
    const cx = Math.cos(angle) * attachRadius;
    const cz = Math.sin(angle) * attachRadius;
    
    const verts: number[] = [];
    const indices: number[] = [];
    
    // Create dome (bottom hemisphere of ellipsoid, with flat top at disc bottom)
    // Start from bottom (flat on print bed) going up to disc
    for (let h = 0; h <= heightSegs; h++) {
      // Only create bottom half dome (0 to 90 degrees, not full sphere)
      const phi = (h / heightSegs) * (Math.PI / 2); // 0 to 90 degrees
      const y = discBottom - bunHeight * Math.cos(phi); // Bottom of dome at discBottom - bunHeight
      const ringRadius = bunRadius * Math.sin(phi);
      
      for (let w = 0; w <= widthSegs; w++) {
        const theta = (w / widthSegs) * Math.PI * 2;
        verts.push(
          cx + Math.cos(theta) * ringRadius,
          y,
          cz + Math.sin(theta) * ringRadius
        );
      }
    }
    
    // Side faces
    for (let h = 0; h < heightSegs; h++) {
      for (let w = 0; w < widthSegs; w++) {
        const a = h * (widthSegs + 1) + w;
        const b = a + 1;
        const c = a + (widthSegs + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    
    // Bottom cap (flat for printing)
    const bottomY = discBottom - bunHeight;
    const bottomCenterIdx = verts.length / 3;
    verts.push(cx, bottomY, cz);
    for (let w = 0; w < widthSegs; w++) {
      indices.push(w, bottomCenterIdx, w + 1);
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
 * Create simple base disc with optional cord hole and pedestal styling
 */
function createBaseDisc(
  radius: number,
  thickness: number,
  organicParams?: OrganicParams,
  socketParams?: SocketParams,
  pedestalParams?: PedestalParams,
  bottomRadiiArray?: number[]
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const taper = pedestalParams?.taper ?? 0;
  const lip = pedestalParams?.lip ?? 0;
  const edgeStyle = pedestalParams?.edgeStyle ?? 'flat';
  const bottomRadius = radius * (1 - taper);
  
  // Lip is a raised rim at the outer edge
  // Use explicit lipThickness if provided, otherwise calculate from lip height
  const lipWidth = pedestalParams?.lipThickness ?? Math.max(1.5, lip * 0.4);
  const innerLipRadius = radius - lipWidth;
  
  // Edge style dimensions
  const edgeSize = Math.min(2, thickness * 0.4);
  const roundedSteps = 4;
  
  const cordHoleEnabled = socketParams?.cordHoleEnabled ?? false;
  const cordHoleDiameter = socketParams?.cordHoleDiameter ?? 8;
  const cordHoleRadius = cordHoleDiameter / 2;
  
  // Centering lip parameters
  const centeringLipEnabled = socketParams?.centeringLipEnabled ?? false;
  const centeringLipHeight = socketParams?.centeringLipHeight ?? 3;
  const socketType = socketParams?.socketType ?? 'E26';
  
  // Socket inner diameters in mm
  const socketDiameters: Record<string, number> = {
    E26: 26,
    E12: 12,
    E14: 14,
    GU10: 35,
  };
  const socketInnerRadius = (socketDiameters[socketType] ?? 26) / 2;
  
  // Use actual body radii for outer edge if available, otherwise use deformation
  const getOuterRadius = (theta: number) => getRadiusAtAngle(theta, radius, organicParams, bottomRadiiArray);
  // For bottom (tapered), scale the body radii proportionally
  const getBottomRadius = (theta: number) => {
    const outerR = getRadiusAtAngle(theta, radius, organicParams, bottomRadiiArray);
    return outerR * (1 - taper);
  };
  // For inner lip, scale the body radii proportionally  
  const getInnerLipRadius = (theta: number) => {
    const outerR = getRadiusAtAngle(theta, radius, organicParams, bottomRadiiArray);
    const lipRatio = innerLipRadius / radius;
    return outerR * lipRatio;
  };
  
  // Helper to add a ring of vertices
  const addRing = (radiusFn: (theta: number) => number, y: number): number => {
    const startIdx = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = radiusFn(theta);
      vertices.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
    }
    return startIdx;
  };
  
  // Helper to add a center point
  const addCenter = (y: number): number => {
    const idx = vertices.length / 3;
    vertices.push(0, y, 0);
    return idx;
  };
  
  // Helper to connect two rings
  const connectRings = (ring1Start: number, ring2Start: number, invert: boolean = false) => {
    for (let i = 0; i < segments; i++) {
      if (invert) {
        indices.push(ring1Start + i, ring1Start + i + 1, ring2Start + i);
        indices.push(ring1Start + i + 1, ring2Start + i + 1, ring2Start + i);
      } else {
        indices.push(ring1Start + i, ring2Start + i, ring1Start + i + 1);
        indices.push(ring1Start + i + 1, ring2Start + i, ring2Start + i + 1);
      }
    }
  };
  
  // Helper to fill from center to ring
  const fillFromCenter = (centerIdx: number, ringStart: number, invert: boolean = false) => {
    for (let i = 0; i < segments; i++) {
      if (invert) {
        indices.push(centerIdx, ringStart + i + 1, ringStart + i);
      } else {
        indices.push(centerIdx, ringStart + i, ringStart + i + 1);
      }
    }
  };
  
  // Generate edge profile rings (for chamfer/rounded edges)
  const generateEdgeRings = (topY: number, baseRadiusFn: (theta: number) => number): number[] => {
    const rings: number[] = [];
    
    if (edgeStyle === 'chamfer') {
      // Chamfer: single angled ring
      const chamferRing = addRing(
        (theta) => baseRadiusFn(theta) - edgeSize,
        topY - thickness
      );
      rings.push(chamferRing);
      
      // Transition ring at corner
      const cornerRing = addRing(baseRadiusFn, topY - thickness + edgeSize);
      rings.push(cornerRing);
    } else if (edgeStyle === 'rounded') {
      // Rounded: multiple rings forming a quarter-circle
      for (let step = 1; step <= roundedSteps; step++) {
        const angle = (step / roundedSteps) * (Math.PI / 2);
        const rOffset = edgeSize * (1 - Math.cos(angle));
        const yOffset = edgeSize * Math.sin(angle);
        
        const ring = addRing(
          (theta) => baseRadiusFn(theta) - rOffset,
          topY - thickness + edgeSize - yOffset
        );
        rings.push(ring);
      }
    }
    
    return rings;
  };

  // Top height (lip or flat)
  const topY = lip > 0 ? lip : 0;
  
  if (cordHoleEnabled) {
    // === WITH CORD HOLE ===
    
    if (lip > 0) {
      // Lip top outer
      const lipTopOuter = addRing(getOuterRadius, topY);
      // Lip top inner
      const lipTopInner = addRing(getInnerLipRadius, topY);
      // Connect lip top surface
      connectRings(lipTopOuter, lipTopInner);
      
      // Lip inner wall bottom
      const lipInnerBottom = addRing(getInnerLipRadius, 0);
      // Connect inner lip wall
      connectRings(lipTopInner, lipInnerBottom, true);
      
      // Platform surface (from lip inner to cord hole)
      const platformInner = addRing(() => cordHoleRadius, 0);
      connectRings(lipInnerBottom, platformInner);
      
      // Bottom surface
      const bottomOuter = addRing(getBottomRadius, -thickness);
      const bottomInner = addRing(() => cordHoleRadius, -thickness);
      connectRings(bottomOuter, bottomInner, true);
      
      // Outer wall with edge style
      if (edgeStyle === 'flat') {
        connectRings(lipTopOuter, bottomOuter);
      } else {
        const edgeRings = generateEdgeRings(topY, getOuterRadius);
        if (edgeRings.length >= 2 && edgeStyle === 'chamfer') {
          connectRings(lipTopOuter, edgeRings[1]); // to corner
          connectRings(edgeRings[1], edgeRings[0]); // corner to chamfer bottom
          connectRings(edgeRings[0], bottomOuter);  // chamfer bottom to bottom
        } else if (edgeRings.length > 0 && edgeStyle === 'rounded') {
          let prevRing = lipTopOuter;
          for (const ring of edgeRings) {
            connectRings(prevRing, ring);
            prevRing = ring;
          }
          connectRings(prevRing, bottomOuter);
        }
      }
      
      // Cord hole wall
      connectRings(platformInner, bottomInner, true);
    } else {
      // No lip
      const topOuter = addRing(getOuterRadius, 0);
      const topInner = addRing(() => cordHoleRadius, 0);
      connectRings(topOuter, topInner);
      
      const bottomOuter = addRing(getBottomRadius, -thickness);
      const bottomInner = addRing(() => cordHoleRadius, -thickness);
      connectRings(bottomOuter, bottomInner, true);
      
      // Outer wall with edge style
      if (edgeStyle === 'flat') {
        connectRings(topOuter, bottomOuter);
      } else {
        const edgeRings = generateEdgeRings(0, getOuterRadius);
        if (edgeRings.length >= 2 && edgeStyle === 'chamfer') {
          connectRings(topOuter, edgeRings[1]);
          connectRings(edgeRings[1], edgeRings[0]);
          connectRings(edgeRings[0], bottomOuter);
        } else if (edgeRings.length > 0 && edgeStyle === 'rounded') {
          let prevRing = topOuter;
          for (const ring of edgeRings) {
            connectRings(prevRing, ring);
            prevRing = ring;
          }
          connectRings(prevRing, bottomOuter);
        }
      }
      
      // Cord hole wall
      connectRings(topInner, bottomInner, true);
    }
  } else {
    // === SOLID DISC (no cord hole) ===
    
    if (lip > 0) {
      // Lip top outer
      const lipTopOuter = addRing(getOuterRadius, topY);
      // Lip top inner
      const lipTopInner = addRing(getInnerLipRadius, topY);
      connectRings(lipTopOuter, lipTopInner);
      
      // Lip inner wall
      const lipInnerBottom = addRing(getInnerLipRadius, 0);
      connectRings(lipTopInner, lipInnerBottom, true);
      
      // Platform center
      const platformCenter = addCenter(0);
      fillFromCenter(platformCenter, lipInnerBottom);
      
      // Bottom
      const bottomCenter = addCenter(-thickness);
      const bottomRing = addRing(getBottomRadius, -thickness);
      fillFromCenter(bottomCenter, bottomRing, true);
      
      // Outer wall with edge style
      if (edgeStyle === 'flat') {
        connectRings(lipTopOuter, bottomRing);
      } else {
        const edgeRings = generateEdgeRings(topY, getOuterRadius);
        if (edgeRings.length >= 2 && edgeStyle === 'chamfer') {
          connectRings(lipTopOuter, edgeRings[1]);
          connectRings(edgeRings[1], edgeRings[0]);
          connectRings(edgeRings[0], bottomRing);
        } else if (edgeRings.length > 0 && edgeStyle === 'rounded') {
          let prevRing = lipTopOuter;
          for (const ring of edgeRings) {
            connectRings(prevRing, ring);
            prevRing = ring;
          }
          connectRings(prevRing, bottomRing);
        }
      }
    } else {
      // No lip - simple disc
      const topCenter = addCenter(0);
      const topRing = addRing(getOuterRadius, 0);
      fillFromCenter(topCenter, topRing);
      
      const bottomCenter = addCenter(-thickness);
      const bottomRing = addRing(getBottomRadius, -thickness);
      fillFromCenter(bottomCenter, bottomRing, true);
      
      // Outer wall with edge style
      if (edgeStyle === 'flat') {
        connectRings(topRing, bottomRing);
      } else {
        const edgeRings = generateEdgeRings(0, getOuterRadius);
        if (edgeRings.length >= 2 && edgeStyle === 'chamfer') {
          connectRings(topRing, edgeRings[1]);
          connectRings(edgeRings[1], edgeRings[0]);
          connectRings(edgeRings[0], bottomRing);
        } else if (edgeRings.length > 0 && edgeStyle === 'rounded') {
          let prevRing = topRing;
          for (const ring of edgeRings) {
            connectRings(prevRing, ring);
            prevRing = ring;
          }
          connectRings(prevRing, bottomRing);
        }
      }
    }
  }
  
  // === Add centering lip ring if enabled ===
  if (centeringLipEnabled && cordHoleEnabled) {
    // The centering lip is a ring that sits on top of the platform
    // Inner radius matches the socket type, outer radius is slightly larger
    const centeringLipOuterRadius = socketInnerRadius + 3; // 3mm wall thickness
    const centeringLipInnerRadius = socketInnerRadius;
    
    // Only add centering lip if it fits within the available space
    const availableRadius = lip > 0 ? innerLipRadius : radius * 0.8;
    
    if (centeringLipOuterRadius < availableRadius && centeringLipInnerRadius > cordHoleRadius) {
      const baseY = lip > 0 ? 0 : 0; // Platform surface Y
      const lipTopY = baseY + centeringLipHeight;
      
      // Bottom outer ring of centering lip
      const clBottomOuter = addRing(() => centeringLipOuterRadius, baseY);
      // Bottom inner ring of centering lip  
      const clBottomInner = addRing(() => centeringLipInnerRadius, baseY);
      // Top outer ring
      const clTopOuter = addRing(() => centeringLipOuterRadius, lipTopY);
      // Top inner ring
      const clTopInner = addRing(() => centeringLipInnerRadius, lipTopY);
      
      // Connect the rings to form the centering lip
      // Outer wall (going up)
      connectRings(clBottomOuter, clTopOuter);
      // Inner wall (going down from top to bottom)
      connectRings(clTopInner, clBottomInner, true);
      // Top surface (from outer to inner)
      connectRings(clTopOuter, clTopInner);
      // Bottom surface (from inner to outer) - actually connects to platform, but we add for closed mesh
      connectRings(clBottomInner, clBottomOuter);
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