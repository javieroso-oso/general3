import * as THREE from 'three';

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
 * Calculate deformed radius at a given angle (for base disc at t=0)
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
  const t = 0; // Base is at t=0
  
  // Wobble (at t=0, simplified)
  if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
    const maxWobble = Math.min(wobbleAmplitude, 0.15);
    r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * baseRadius;
  }
  
  // Ripples
  if (rippleCount > 0 && rippleDepth > 0) {
    const maxRipple = Math.min(rippleDepth, 0.1);
    r += Math.sin(theta * rippleCount) * maxRipple * baseRadius;
  }
  
  // Asymmetry
  if (asymmetry > 0) {
    const maxAsym = Math.min(asymmetry, 0.1);
    r += Math.sin(theta) * Math.cos(t * Math.PI * 2) * maxAsym * baseRadius;
  }
  
  // Organic noise
  if (organicNoise > 0) {
    const maxNoise = Math.min(organicNoise, 0.1);
    const nx = Math.cos(theta) * r;
    const nz = Math.sin(theta) * r;
    r += noise3D(nx * 0.1, 0, nz * 0.1, noiseScale) * maxNoise * baseRadius;
  }
  
  return Math.max(r, baseRadius * 0.5); // Ensure minimum radius
}

/**
 * Generate legs with a base disc - this becomes one printable part
 * The base disc sits at y=0 and legs extend downward from it
 */
export function generateLegsWithBase(
  baseRadius: number,      // mm - radius of the base disc
  legCount: 3 | 4,
  legHeight: number,       // mm - how tall the legs are
  legSpread: number,       // degrees - angle outward from vertical
  legThickness: number,    // mm - leg diameter
  legTaper: number,        // 0-1 - taper factor (1 = full taper to point)
  legInset: number = 0.3,  // 0-1 - how far inward from edge (0 = edge, 1 = center)
  baseThickness: number = 3, // mm - thickness of the base disc
  organicParams?: OrganicParams // organic deformation parameters
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  // First, create the base disc with organic deformation
  const discGeo = createBaseDisc(baseRadius, baseThickness, organicParams);
  geometries.push(discGeo);
  
  // Then create legs extending from bottom of disc
  const spreadRad = (legSpread * Math.PI) / 180;
  const segments = 8;
  const heightSegments = 12;
  
  const discBottom = -baseThickness; // Legs attach to bottom of disc
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    // Calculate attach radius using organic deformation
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
    
    for (let h = 0; h <= heightSegments; h++) {
      const t = h / heightSegments;
      
      const px = attachX + (footX - attachX) * t;
      const py = discBottom + (footY - discBottom) * t;
      const pz = attachZ + (footZ - attachZ) * t;
      
      const topRadius = legThickness / 2;
      const bottomRadius = topRadius * (1 - legTaper * 0.6);
      const r = topRadius + (bottomRadius - topRadius) * t;
      
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        
        const legDirX = footX - attachX;
        const legDirY = footY - discBottom;
        const legDirZ = footZ - attachZ;
        const legLen = Math.sqrt(legDirX * legDirX + legDirY * legDirY + legDirZ * legDirZ);
        
        const dirX = legDirX / legLen;
        const dirY = legDirY / legLen;
        const dirZ = legDirZ / legLen;
        
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
        
        const cx = Math.cos(segAngle) * perpX + Math.sin(segAngle) * perp2X;
        const cy = Math.sin(segAngle) * perp2Y;
        const cz = Math.cos(segAngle) * perpZ + Math.sin(segAngle) * perp2Z;
        
        legVerts.push(px + cx * r, py + cy * r, pz + cz * r);
      }
    }
    
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
    
    // Top cap (connects to disc)
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
  
  return mergeGeometries(geometries);
}

/**
 * Create a solid base disc with organic deformation
 */
function createBaseDisc(
  radius: number, 
  thickness: number,
  organicParams?: OrganicParams
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Top surface center
  const topCenterIdx = 0;
  vertices.push(0, 0, 0);
  
  // Top surface ring with organic deformation
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = calculateDeformedRadius(theta, radius, organicParams);
    vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
  }
  
  // Bottom surface center
  const bottomCenterIdx = vertices.length / 3;
  vertices.push(0, -thickness, 0);
  
  // Bottom surface ring with organic deformation
  const bottomRingStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = calculateDeformedRadius(theta, radius, organicParams);
    vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
  }
  
  // Top face triangles
  for (let i = 0; i < segments; i++) {
    indices.push(topCenterIdx, 1 + i + 1, 1 + i);
  }
  
  // Bottom face triangles (reverse winding)
  for (let i = 0; i < segments; i++) {
    indices.push(bottomCenterIdx, bottomRingStart + i, bottomRingStart + i + 1);
  }
  
  // Side faces
  for (let i = 0; i < segments; i++) {
    const topA = 1 + i;
    const topB = 1 + i + 1;
    const botA = bottomRingStart + i;
    const botB = bottomRingStart + i + 1;
    indices.push(topA, topB, botA);
    indices.push(botA, topB, botB);
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generate just the legs (for preview) - without base disc
 */
export function generateLegs(
  baseRadius: number,
  legCount: 3 | 4,
  legHeight: number,
  legSpread: number,
  legThickness: number,
  legTaper: number,
  legInset: number = 0.3
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const spreadRad = (legSpread * Math.PI) / 180;
  const segments = 8;
  const heightSegments = 12;
  
  const attachRadius = baseRadius * (1 - legInset * 0.7);
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    const attachX = Math.cos(angle) * attachRadius;
    const attachZ = Math.sin(angle) * attachRadius;
    
    const outwardX = Math.cos(angle);
    const outwardZ = Math.sin(angle);
    
    const horizontalDist = Math.sin(spreadRad) * legHeight;
    const verticalDist = Math.cos(spreadRad) * legHeight;
    
    const footX = attachX + outwardX * horizontalDist;
    const footZ = attachZ + outwardZ * horizontalDist;
    const footY = -verticalDist;
    
    const legVerts: number[] = [];
    const legIndices: number[] = [];
    
    for (let h = 0; h <= heightSegments; h++) {
      const t = h / heightSegments;
      
      const px = attachX + (footX - attachX) * t;
      const py = 0 + (footY - 0) * t;
      const pz = attachZ + (footZ - attachZ) * t;
      
      const topRadius = legThickness / 2;
      const bottomRadius = topRadius * (1 - legTaper * 0.6);
      const r = topRadius + (bottomRadius - topRadius) * t;
      
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        
        const legDirX = footX - attachX;
        const legDirY = footY - 0;
        const legDirZ = footZ - attachZ;
        const legLen = Math.sqrt(legDirX * legDirX + legDirY * legDirY + legDirZ * legDirZ);
        
        const dirX = legDirX / legLen;
        const dirY = legDirY / legLen;
        const dirZ = legDirZ / legLen;
        
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
        
        const cx = Math.cos(segAngle) * perpX + Math.sin(segAngle) * perp2X;
        const cy = Math.sin(segAngle) * perp2Y;
        const cz = Math.cos(segAngle) * perpZ + Math.sin(segAngle) * perp2Z;
        
        legVerts.push(px + cx * r, py + cy * r, pz + cz * r);
      }
    }
    
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
    
    const footCenterIdx = legVerts.length / 3;
    legVerts.push(footX, footY, footZ);
    const lastRingStart = heightSegments * (segments + 1);
    for (let s = 0; s < segments; s++) {
      legIndices.push(lastRingStart + s, footCenterIdx, lastRingStart + s + 1);
    }
    
    const topCenterIdx = legVerts.length / 3;
    legVerts.push(attachX, 0, attachZ);
    for (let s = 0; s < segments; s++) {
      legIndices.push(s + 1, topCenterIdx, s);
    }
    
    const legGeo = new THREE.BufferGeometry();
    legGeo.setAttribute('position', new THREE.Float32BufferAttribute(legVerts, 3));
    legGeo.setIndex(legIndices);
    legGeo.computeVertexNormals();
    geometries.push(legGeo);
  }
  
  return mergeGeometries(geometries);
}

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
