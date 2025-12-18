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

/**
 * Socket type dimensions (outer diameter in mm)
 */
export const socketDimensions: Record<string, { outerDiameter: number; name: string }> = {
  E26: { outerDiameter: 34, name: 'E26 (US Standard)' },
  E27: { outerDiameter: 35, name: 'E27 (EU Standard)' },
  E12: { outerDiameter: 18, name: 'E12 (Candelabra)' },
  E14: { outerDiameter: 20, name: 'E14 (Small Screw)' },
  GU10: { outerDiameter: 50, name: 'GU10 (Spotlight)' },
  G9: { outerDiameter: 25, name: 'G9 (Halogen)' },
};

export type SocketType = keyof typeof socketDimensions;

/**
 * Socket attachment parameters
 */
export interface SocketParams {
  plugHeight: number;     // mm - height of plug extending into body
  plugGap: number;        // mm - tolerance gap between plug and body inner wall
  lipWidth: number;       // mm - width of lip that body rests on
  wallThickness: number;  // mm - body wall thickness (needed to calculate inner radius)
  cordHoleEnabled?: boolean;    // Enable central cord exit hole
  cordHoleDiameter?: number;    // mm - cord exit hole diameter
  socketRecessEnabled?: boolean; // Enable socket recess on plug top
  socketType?: SocketType;       // Socket type for recess sizing
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
 * Includes inner plug that fits inside body and outer lip for body to rest on
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
  organicParams?: OrganicParams, // organic deformation parameters
  socketParams?: SocketParams    // socket attachment parameters
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  // First, create the base disc with lip and plug
  const discGeo = createBaseDiscWithSocket(baseRadius, baseThickness, organicParams, socketParams);
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
 * Create a base disc with socket attachment system:
 * - Outer lip: body rests on this (follows organic deformation)
 * - Inner plug: extends upward into body (follows inner wall radius minus gap)
 * - Base disc: solid base at bottom (or with socket hole if enabled)
 * - Socket hole with support ledge (optional): central hole sized for lamp socket
 */
function createBaseDiscWithSocket(
  radius: number, 
  thickness: number,
  organicParams?: OrganicParams,
  socketParams?: SocketParams
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Socket parameters with defaults
  const plugHeight = socketParams?.plugHeight ?? 8;
  const plugGap = socketParams?.plugGap ?? 0.25;
  const lipWidth = socketParams?.lipWidth ?? 2;
  const wallThickness = socketParams?.wallThickness ?? 2;
  
  // Cord hole parameters (simple exit hole only)
  const cordHoleEnabled = socketParams?.cordHoleEnabled ?? false;
  const cordHoleDiameter = socketParams?.cordHoleDiameter ?? 8;
  const cordHoleRadius = cordHoleDiameter / 2;
  
  // Socket recess parameters
  const socketRecessEnabled = socketParams?.socketRecessEnabled ?? false;
  const socketType = socketParams?.socketType ?? 'E26';
  const socketDims = socketDimensions[socketType];
  const recessDepth = 3; // 3mm deep recess
  
  // Calculate radii functions
  const getPlugRadius = (theta: number) => {
    const outerR = calculateDeformedRadius(theta, radius, organicParams);
    return outerR - wallThickness - plugGap;
  };
  
  const getLipOuterRadius = (theta: number) => calculateDeformedRadius(theta, radius, organicParams);
  
  // Get minimum plug radius to ensure recess fits
  const minPlugRadius = getPlugRadius(0); // Use theta=0 as approximation
  const idealRecessRadius = (socketDims.outerDiameter / 2) + 0.5; // Add 0.5mm tolerance
  // Clamp recess radius to fit inside plug with at least 2mm margin
  const recessRadius = Math.min(idealRecessRadius, minPlugRadius - 2);
  // Only enable recess if it can reasonably fit (recess larger than cord hole)
  const canFitRecess = socketRecessEnabled && recessRadius > cordHoleRadius + 2;
  
  // ===== PLUG (extends upward from lip into body) - with optional cord hole and socket recess =====
  if (cordHoleEnabled) {
    // Plug with cord hole through center (and optional socket recess on top)
    
    if (canFitRecess) {
      // ==== PLUG TOP WITH SOCKET RECESS ====
      
      // Plug top outer ring (at plugHeight)
      const plugTopOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getPlugRadius(theta);
        vertices.push(Math.cos(theta) * r, plugHeight, Math.sin(theta) * r);
      }
      
      // Recess edge ring at plugHeight (outer edge of recess)
      const recessEdgeTopStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * recessRadius, plugHeight, Math.sin(theta) * recessRadius);
      }
      
      // Plug top face (ring between outer and recess edge)
      for (let i = 0; i < segments; i++) {
        const outerA = plugTopOuterStart + i;
        const outerB = plugTopOuterStart + i + 1;
        const recessA = recessEdgeTopStart + i;
        const recessB = recessEdgeTopStart + i + 1;
        indices.push(outerA, recessA, outerB);
        indices.push(outerB, recessA, recessB);
      }
      
      // Recess edge ring at bottom of recess (plugHeight - recessDepth)
      const recessEdgeBottomStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * recessRadius, plugHeight - recessDepth, Math.sin(theta) * recessRadius);
      }
      
      // Recess wall (from top to bottom of recess)
      for (let i = 0; i < segments; i++) {
        const topA = recessEdgeTopStart + i;
        const topB = recessEdgeTopStart + i + 1;
        const botA = recessEdgeBottomStart + i;
        const botB = recessEdgeBottomStart + i + 1;
        // Reversed winding for inner wall
        indices.push(topA, botA, topB);
        indices.push(topB, botA, botB);
      }
      
      // Recess floor - cord hole edge at recess bottom
      const recessFloorInnerStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, plugHeight - recessDepth, Math.sin(theta) * cordHoleRadius);
      }
      
      // Recess floor face (ring between recess edge and cord hole)
      for (let i = 0; i < segments; i++) {
        const outerA = recessEdgeBottomStart + i;
        const outerB = recessEdgeBottomStart + i + 1;
        const innerA = recessFloorInnerStart + i;
        const innerB = recessFloorInnerStart + i + 1;
        indices.push(outerA, innerA, outerB);
        indices.push(outerB, innerA, innerB);
      }
      
      // Plug bottom outer ring (at lip level y=0)
      const plugBottomOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getPlugRadius(theta);
        vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
      
      // Plug bottom inner ring (cord hole at y=0)
      const plugBottomInnerStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, 0, Math.sin(theta) * cordHoleRadius);
      }
      
      // Plug outer side wall (from plug top to plug bottom)
      for (let i = 0; i < segments; i++) {
        const topA = plugTopOuterStart + i;
        const topB = plugTopOuterStart + i + 1;
        const botA = plugBottomOuterStart + i;
        const botB = plugBottomOuterStart + i + 1;
        indices.push(topA, topB, botA);
        indices.push(botA, topB, botB);
      }
      
      // Cord hole wall through plug (from recess floor to plug bottom)
      for (let i = 0; i < segments; i++) {
        const topA = recessFloorInnerStart + i;
        const topB = recessFloorInnerStart + i + 1;
        const botA = plugBottomInnerStart + i;
        const botB = plugBottomInnerStart + i + 1;
        // Reversed winding for inner wall
        indices.push(topA, botA, topB);
        indices.push(topB, botA, botB);
      }
      
      // Continue with LIP and BASE using plugBottomOuterStart and plugBottomInnerStart
      // ===== LIP (ring at y=0, body rests on this) =====
      const lipOuterRingStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getLipOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
      
      // Lip top surface (between plug bottom outer and lip outer)
      for (let i = 0; i < segments; i++) {
        const plugA = plugBottomOuterStart + i;
        const plugB = plugBottomOuterStart + i + 1;
        const lipA = lipOuterRingStart + i;
        const lipB = lipOuterRingStart + i + 1;
        indices.push(plugA, lipA, plugB);
        indices.push(plugB, lipA, lipB);
      }
      
      // ===== CORD HOLE continues through base =====
      const cordHoleBottomStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, -thickness, Math.sin(theta) * cordHoleRadius);
      }
      
      // Cord hole wall (from y=0 to base bottom)
      for (let i = 0; i < segments; i++) {
        const topA = plugBottomInnerStart + i;
        const topB = plugBottomInnerStart + i + 1;
        const botA = cordHoleBottomStart + i;
        const botB = cordHoleBottomStart + i + 1;
        indices.push(topA, botA, topB);
        indices.push(topB, botA, botB);
      }
      
      // ===== BASE BOTTOM (ring with cord hole) =====
      const baseBottomOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getLipOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
      }
      
      // Base bottom face (ring between outer and cord hole)
      for (let i = 0; i < segments; i++) {
        const outerA = baseBottomOuterStart + i;
        const outerB = baseBottomOuterStart + i + 1;
        const innerA = cordHoleBottomStart + i;
        const innerB = cordHoleBottomStart + i + 1;
        indices.push(outerA, outerB, innerA);
        indices.push(innerA, outerB, innerB);
      }
      
      // Base side wall (connects lip outer to base bottom)
      for (let i = 0; i < segments; i++) {
        const topA = lipOuterRingStart + i;
        const topB = lipOuterRingStart + i + 1;
        const botA = baseBottomOuterStart + i;
        const botB = baseBottomOuterStart + i + 1;
        indices.push(topA, topB, botA);
        indices.push(botA, topB, botB);
      }
      
    } else {
      // ==== PLUG TOP WITHOUT RECESS (flat top with cord hole) ====
      
      // Plug top - outer ring
      const plugTopOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getPlugRadius(theta);
        vertices.push(Math.cos(theta) * r, plugHeight, Math.sin(theta) * r);
      }
      
      // Plug top - inner ring (cord hole edge)
      const plugTopInnerStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, plugHeight, Math.sin(theta) * cordHoleRadius);
      }
      
      // Plug top face (ring between outer and inner)
      for (let i = 0; i < segments; i++) {
        const outerA = plugTopOuterStart + i;
        const outerB = plugTopOuterStart + i + 1;
        const innerA = plugTopInnerStart + i;
        const innerB = plugTopInnerStart + i + 1;
        indices.push(outerA, innerA, outerB);
        indices.push(outerB, innerA, innerB);
      }
      
      // Plug bottom outer ring (at lip level y=0)
      const plugBottomOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getPlugRadius(theta);
        vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
      
      // Plug bottom inner ring
      const plugBottomInnerStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, 0, Math.sin(theta) * cordHoleRadius);
      }
      
      // Plug outer side wall
      for (let i = 0; i < segments; i++) {
        const topA = plugTopOuterStart + i;
        const topB = plugTopOuterStart + i + 1;
        const botA = plugBottomOuterStart + i;
        const botB = plugBottomOuterStart + i + 1;
        indices.push(topA, topB, botA);
        indices.push(botA, topB, botB);
      }
      
      // Plug inner side wall (cord hole through plug)
      for (let i = 0; i < segments; i++) {
        const topA = plugTopInnerStart + i;
        const topB = plugTopInnerStart + i + 1;
        const botA = plugBottomInnerStart + i;
        const botB = plugBottomInnerStart + i + 1;
        indices.push(topA, botA, topB);
        indices.push(topB, botA, botB);
      }
      
      // ===== LIP (ring at y=0, body rests on this) =====
      const lipOuterRingStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getLipOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
      
      // Lip top surface (between plug bottom outer and lip outer)
      for (let i = 0; i < segments; i++) {
        const plugA = plugBottomOuterStart + i;
        const plugB = plugBottomOuterStart + i + 1;
        const lipA = lipOuterRingStart + i;
        const lipB = lipOuterRingStart + i + 1;
        indices.push(plugA, lipA, plugB);
        indices.push(plugB, lipA, lipB);
      }
      
      // ===== CORD HOLE continues through base =====
      const cordHoleBottomStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, -thickness, Math.sin(theta) * cordHoleRadius);
      }
      
      // Cord hole wall (from y=0 to base bottom)
      for (let i = 0; i < segments; i++) {
        const topA = plugBottomInnerStart + i;
        const topB = plugBottomInnerStart + i + 1;
        const botA = cordHoleBottomStart + i;
        const botB = cordHoleBottomStart + i + 1;
        indices.push(topA, botA, topB);
        indices.push(topB, botA, botB);
      }
      
      // ===== BASE BOTTOM (ring with cord hole) =====
      const baseBottomOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getLipOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
      }
      
      // Base bottom face (ring between outer and cord hole)
      for (let i = 0; i < segments; i++) {
        const outerA = baseBottomOuterStart + i;
        const outerB = baseBottomOuterStart + i + 1;
        const innerA = cordHoleBottomStart + i;
        const innerB = cordHoleBottomStart + i + 1;
        indices.push(outerA, outerB, innerA);
        indices.push(innerA, outerB, innerB);
      }
      
      // Base side wall (connects lip outer to base bottom)
      for (let i = 0; i < segments; i++) {
        const topA = lipOuterRingStart + i;
        const topB = lipOuterRingStart + i + 1;
        const botA = baseBottomOuterStart + i;
        const botB = baseBottomOuterStart + i + 1;
        indices.push(topA, topB, botA);
        indices.push(botA, topB, botB);
      }
    }
  } else {
    // Original solid center logic (no socket hole)
    // Plug top center
    const plugTopCenterIdx = vertices.length / 3;
    vertices.push(0, plugHeight, 0);
    
    // Plug top ring
    const plugTopRingStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getPlugRadius(theta);
      vertices.push(Math.cos(theta) * r, plugHeight, Math.sin(theta) * r);
    }
    
    // Plug bottom ring (at lip level y=0)
    const plugBottomRingStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getPlugRadius(theta);
      vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    }
    
    // Plug top face (solid cap)
    for (let i = 0; i < segments; i++) {
      indices.push(plugTopCenterIdx, plugTopRingStart + i + 1, plugTopRingStart + i);
    }
    
    // Plug side wall
    for (let i = 0; i < segments; i++) {
      const topA = plugTopRingStart + i;
      const topB = plugTopRingStart + i + 1;
      const botA = plugBottomRingStart + i;
      const botB = plugBottomRingStart + i + 1;
      indices.push(topA, topB, botA);
      indices.push(botA, topB, botB);
    }
    
    // ===== LIP (ring at y=0, body rests on this) =====
    const lipOuterRingStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getLipOuterRadius(theta);
      vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    }
    
    // Lip top surface (between plug bottom and lip outer)
    for (let i = 0; i < segments; i++) {
      const plugA = plugBottomRingStart + i;
      const plugB = plugBottomRingStart + i + 1;
      const lipA = lipOuterRingStart + i;
      const lipB = lipOuterRingStart + i + 1;
      indices.push(plugA, lipA, plugB);
      indices.push(plugB, lipA, lipB);
    }
    
    // ===== BASE DISC (solid bottom) =====
    const baseCenterIdx = vertices.length / 3;
    vertices.push(0, -thickness, 0);
    
    const baseBottomRingStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getLipOuterRadius(theta);
      vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
    }
    
    // Base bottom face
    for (let i = 0; i < segments; i++) {
      indices.push(baseCenterIdx, baseBottomRingStart + i, baseBottomRingStart + i + 1);
    }
    
    // Base side wall
    for (let i = 0; i < segments; i++) {
      const topA = lipOuterRingStart + i;
      const topB = lipOuterRingStart + i + 1;
      const botA = baseBottomRingStart + i;
      const botB = baseBottomRingStart + i + 1;
      indices.push(topA, topB, botA);
      indices.push(botA, topB, botB);
    }
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
