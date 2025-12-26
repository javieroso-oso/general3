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
 * Socket attachment parameters - simplified flat base with centering lip
 */
export interface SocketParams {
  wallThickness: number;  // mm - body wall thickness
  cordHoleEnabled?: boolean;    // Enable central cord exit hole
  cordHoleDiameter?: number;    // mm - cord exit hole diameter
  centeringLipEnabled?: boolean; // Enable centering lip sized to socket
  centeringLipHeight?: number;   // mm - height of centering lip (2-5mm)
  socketType?: 'E26' | 'E12' | 'E14' | 'GU10';  // Socket type for lip sizing
}

/**
 * Attachment parameters for body-to-stand connection
 */
export interface AttachmentParams {
  attachmentType: 'integrated' | 'screw_m3' | 'screw_m4' | 'bayonet';
  screwCount: 3 | 4;
  baseRadius: number;      // mm - for calculating hole positions
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

// Socket THREAD diameters in mm (the E-number IS the thread diameter!)
// These determine centering lip size - the lip should fit snugly around the threaded portion
const SOCKET_THREAD_DIAMETERS: Record<string, number> = {
  'E26': 26,   // US/Japan standard - 26mm thread diameter
  'E12': 12,   // Candelabra - 12mm thread diameter
  'E14': 14,   // European candelabra - 14mm thread diameter
  'GU10': 35,  // GU10 is different - uses pin base ~35mm body
};

// Screw specifications
const SCREW_SPECS = {
  m3: {
    clearanceHole: 3.4,      // mm - hole diameter in base for screw to pass through
    nutAcrossFlats: 5.5,     // mm - hex nut size
    nutThickness: 2.4,       // mm - depth of nut recess
  },
  m4: {
    clearanceHole: 4.5,
    nutAcrossFlats: 7,
    nutThickness: 3.2,
  },
};

// Bayonet specifications
const BAYONET_SPECS = {
  tabWidth: 5,              // mm
  tabHeight: 3,             // mm
  tabDepth: 4,              // mm
  slotWidth: 5.5,           // mm (tab width + clearance)
  slotLength: 8,            // mm - L-slot vertical portion
  rotationAngle: 30,        // degrees - how far to twist to lock
};

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
  
  // Asymmetry - now uses full value without cap
  if (asymmetry > 0) {
    const primaryWave = Math.sin(theta) * Math.cos(t * Math.PI) * asymmetry * baseRadius;
    const secondaryWave = Math.sin(theta * 2 + t * Math.PI * 3) * asymmetry * 0.3 * baseRadius;
    r += primaryWave + secondaryWave;
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
 * Includes optional attachment features (screw holes, bayonet slots)
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
  socketParams?: SocketParams,   // socket attachment parameters
  attachmentParams?: AttachmentParams, // body-to-stand attachment
  pedestalParams?: PedestalParams // pedestal-style base parameters
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  // Use pedestal thickness if provided, otherwise use baseThickness
  const effectiveThickness = pedestalParams?.thickness ?? baseThickness;
  
  // First, create the base disc with lip and optional attachment features
  const discGeo = createBaseDiscWithSocket(baseRadius, effectiveThickness, organicParams, socketParams, attachmentParams, pedestalParams);
  geometries.push(discGeo);
  
  // Then create legs extending from bottom of disc
  const spreadRad = (legSpread * Math.PI) / 180;
  const segments = 8;
  const heightSegments = 12;
  
  const discBottom = -baseThickness; // Legs attach to bottom of disc
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    // Calculate attach radius - legs attach at disc edge
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
    
    // Calculate leg direction for perpendicular calculations
    const legDirX = footX - attachX;
    const legDirY = footY - discBottom;
    const legDirZ = footZ - attachZ;
    const legLen = Math.sqrt(legDirX * legDirX + legDirY * legDirY + legDirZ * legDirZ);
    
    const dirX = legDirX / legLen;
    const dirY = legDirY / legLen;
    const dirZ = legDirZ / legLen;
    
    // Calculate perpendicular vectors for the leg cylinder
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
    
    // First ring: FLUSH with disc bottom - all vertices at y = discBottom
    // This creates an angled elliptical opening that sits flat against the base
    for (let s = 0; s <= segments; s++) {
      const segAngle = (s / segments) * Math.PI * 2;
      // Offset in horizontal plane perpendicular to leg direction
      const cx = Math.cos(segAngle) * perpX + Math.sin(segAngle) * perp2X;
      const cz = Math.cos(segAngle) * perpZ + Math.sin(segAngle) * perp2Z;
      // All top vertices at disc bottom (flush with base)
      legVerts.push(
        attachX + cx * topRadius,
        discBottom,
        attachZ + cz * topRadius
      );
    }
    
    // Remaining rings: interpolate from attachment point to foot
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
    
    // Index leg body (all rings including flush top ring)
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
    
    // Top cap - flat disc at disc bottom connecting to flush top ring
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
 * Create a FLAT base disc with optional centering lip and attachment features
 * 
 * Structure:
 *   ┌───┐     ← Centering lip (sized to socket ~40mm diameter)
 * ════╧═══════  ← Flat base disc top surface (y=0)
 * │  ○   ○  │   ← Screw clearance holes (if screw attachment)
 * └────┬────┘   ← Base disc bottom (-thickness)
 *      │        ← Cord hole (if enabled)
 */
function createBaseDiscWithSocket(
  radius: number, 
  thickness: number,
  organicParams?: OrganicParams,
  socketParams?: SocketParams,
  attachmentParams?: AttachmentParams,
  pedestalParams?: PedestalParams
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Pedestal parameters
  const taper = pedestalParams?.taper ?? 0;
  const edgeStyle = pedestalParams?.edgeStyle ?? 'flat';
  const edgeLip = pedestalParams?.lip ?? 0;
  
  // Calculate tapered radius at bottom (shrinks based on taper)
  const bottomRadius = radius * (1 - taper);
  
  // Cord hole parameters
  const cordHoleEnabled = socketParams?.cordHoleEnabled ?? false;
  const cordHoleDiameter = socketParams?.cordHoleDiameter ?? 8;
  const cordHoleRadius = cordHoleDiameter / 2;
  
  // Centering lip parameters (sized to socket, not cord hole)
  const centeringLipEnabled = socketParams?.centeringLipEnabled ?? false;
  const centeringLipHeight = socketParams?.centeringLipHeight ?? 3;
  const socketType = socketParams?.socketType ?? 'E26';
  const socketThreadDiameter = SOCKET_THREAD_DIAMETERS[socketType] ?? 26;
  
  // Lip dimensions: inner = socket thread diameter / 2 + 0.5mm clearance for snug fit
  const lipInnerRadius = socketThreadDiameter / 2 + 0.5;
  const lipOuterRadius = lipInnerRadius + 2; // 2mm wall thickness
  
  // Outer radius with organic deformation (for top surface)
  const getOuterRadius = (theta: number) => calculateDeformedRadius(theta, radius, organicParams);
  // Bottom radius with taper applied
  const getBottomRadius = (theta: number) => calculateDeformedRadius(theta, bottomRadius, organicParams);
  
  // Edge styling parameters
  const chamferSize = edgeStyle === 'chamfer' ? Math.min(thickness * 0.3, 3) : 0;
  const roundedRadius = edgeStyle === 'rounded' ? Math.min(thickness * 0.4, 4) : 0;
  const roundedSegments = 6;
  
  // Helper to create a tapered/styled base disc
  // This handles the main body of the pedestal with taper and edge profiles
  
  if (cordHoleEnabled) {
    // === BASE WITH CORD HOLE ===
    
    if (centeringLipEnabled) {
      // With centering lip: flat base + raised ring for socket
      
      // 1. Top surface outer ring (y=0) - with optional edge lip
      const topY = edgeLip > 0 ? edgeLip : 0;
      const topOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
      }
      
      // If we have an edge lip, add the inner edge of the lip
      let lipInnerEdgeStart = -1;
      if (edgeLip > 0) {
        lipInnerEdgeStart = vertices.length / 3;
        const lipWallThickness = 2; // mm
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const r = getOuterRadius(theta) - lipWallThickness;
          vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
        }
        
        // Lip top face
        for (let i = 0; i < segments; i++) {
          indices.push(topOuterStart + i, lipInnerEdgeStart + i, topOuterStart + i + 1);
          indices.push(topOuterStart + i + 1, lipInnerEdgeStart + i, lipInnerEdgeStart + i + 1);
        }
        
        // Lip inner wall (drop down to y=0)
        const lipInnerBottomStart = vertices.length / 3;
        const lipWall = 2;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const r = getOuterRadius(theta) - lipWall;
          vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
        }
        
        for (let i = 0; i < segments; i++) {
          indices.push(lipInnerEdgeStart + i, lipInnerBottomStart + i, lipInnerEdgeStart + i + 1);
          indices.push(lipInnerEdgeStart + i + 1, lipInnerBottomStart + i, lipInnerBottomStart + i + 1);
        }
      }
      
      // 2. Centering lip outer ring at base (y=0)
      const lipOuterBottomStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * lipOuterRadius, 0, Math.sin(theta) * lipOuterRadius);
      }
      
      // Top surface (ring between disc outer/lip-inner and centering lip outer)
      const surfaceOuterStart = edgeLip > 0 ? (lipInnerEdgeStart !== -1 ? vertices.length / 3 - (segments + 1) * 2 : topOuterStart) : topOuterStart;
      const actualSurfaceStart = edgeLip > 0 && lipInnerEdgeStart !== -1 ? lipInnerEdgeStart + segments + 1 : topOuterStart;
      
      for (let i = 0; i < segments; i++) {
        const outerIdx = edgeLip > 0 ? actualSurfaceStart + i : topOuterStart + i;
        const outerIdxNext = edgeLip > 0 ? actualSurfaceStart + i + 1 : topOuterStart + i + 1;
        indices.push(outerIdx, lipOuterBottomStart + i, outerIdxNext);
        indices.push(outerIdxNext, lipOuterBottomStart + i, lipOuterBottomStart + i + 1);
      }
      
      // 3. Centering lip outer ring at top
      const lipOuterTopStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * lipOuterRadius, centeringLipHeight, Math.sin(theta) * lipOuterRadius);
      }
      
      // Lip outer wall
      for (let i = 0; i < segments; i++) {
        indices.push(lipOuterBottomStart + i, lipOuterBottomStart + i + 1, lipOuterTopStart + i);
        indices.push(lipOuterTopStart + i, lipOuterBottomStart + i + 1, lipOuterTopStart + i + 1);
      }
      
      // 4. Centering lip inner ring at top
      const socketLipInnerTopStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * lipInnerRadius, centeringLipHeight, Math.sin(theta) * lipInnerRadius);
      }
      
      // Lip top face
      for (let i = 0; i < segments; i++) {
        indices.push(lipOuterTopStart + i, socketLipInnerTopStart + i, lipOuterTopStart + i + 1);
        indices.push(lipOuterTopStart + i + 1, socketLipInnerTopStart + i, socketLipInnerTopStart + i + 1);
      }
      
      // 5. Centering lip inner ring at bottom (y=0)
      const socketLipInnerBottomStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * lipInnerRadius, 0, Math.sin(theta) * lipInnerRadius);
      }
      
      // Lip inner wall
      for (let i = 0; i < segments; i++) {
        indices.push(socketLipInnerTopStart + i, socketLipInnerBottomStart + i, socketLipInnerTopStart + i + 1);
        indices.push(socketLipInnerTopStart + i + 1, socketLipInnerBottomStart + i, socketLipInnerBottomStart + i + 1);
      }
      
      // 6. Cord hole ring at top (y=0)
      const cordTopStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, 0, Math.sin(theta) * cordHoleRadius);
      }
      
      // Floor between socket lip inner and cord hole
      for (let i = 0; i < segments; i++) {
        indices.push(socketLipInnerBottomStart + i, cordTopStart + i, socketLipInnerBottomStart + i + 1);
        indices.push(socketLipInnerBottomStart + i + 1, cordTopStart + i, cordTopStart + i + 1);
      }
      
      // 7. Cord hole ring at bottom
      const cordBottomStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, -thickness, Math.sin(theta) * cordHoleRadius);
      }
      
      // Cord hole wall
      for (let i = 0; i < segments; i++) {
        indices.push(cordTopStart + i, cordBottomStart + i, cordTopStart + i + 1);
        indices.push(cordTopStart + i + 1, cordBottomStart + i, cordBottomStart + i + 1);
      }
      
      // 8. Base bottom outer ring (with taper!)
      const bottomOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getBottomRadius(theta); // Use tapered radius!
        vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
      }
      
      // Base bottom (ring)
      for (let i = 0; i < segments; i++) {
        indices.push(bottomOuterStart + i, bottomOuterStart + i + 1, cordBottomStart + i);
        indices.push(cordBottomStart + i, bottomOuterStart + i + 1, cordBottomStart + i + 1);
      }
      
      // Base side wall with edge profile
      if (edgeStyle === 'chamfer' && chamferSize > 0) {
        // Add chamfer ring at top outer edge
        const chamferStart = vertices.length / 3;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const topR = getOuterRadius(theta);
          const chamferR = topR - chamferSize * 0.5;
          vertices.push(Math.cos(theta) * chamferR, -chamferSize, Math.sin(theta) * chamferR);
        }
        
        // Top to chamfer
        for (let i = 0; i < segments; i++) {
          indices.push(topOuterStart + i, topOuterStart + i + 1, chamferStart + i);
          indices.push(chamferStart + i, topOuterStart + i + 1, chamferStart + i + 1);
        }
        
        // Chamfer to bottom
        for (let i = 0; i < segments; i++) {
          indices.push(chamferStart + i, chamferStart + i + 1, bottomOuterStart + i);
          indices.push(bottomOuterStart + i, chamferStart + i + 1, bottomOuterStart + i + 1);
        }
      } else if (edgeStyle === 'rounded' && roundedRadius > 0) {
        // Add rounded edge with multiple rings
        let prevRingStart = topOuterStart;
        for (let r = 1; r <= roundedSegments; r++) {
          const t = r / roundedSegments;
          const angle = t * Math.PI / 2;
          const yOffset = -roundedRadius * (1 - Math.cos(angle));
          const rOffset = roundedRadius * (1 - Math.sin(angle));
          
          const ringStart = vertices.length / 3;
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const topR = getOuterRadius(theta);
            const botR = getBottomRadius(theta);
            const blendT = Math.min(1, (-yOffset) / thickness);
            const baseR = topR + (botR - topR) * blendT;
            vertices.push(Math.cos(theta) * (baseR - rOffset), yOffset, Math.sin(theta) * (baseR - rOffset));
          }
          
          for (let i = 0; i < segments; i++) {
            indices.push(prevRingStart + i, prevRingStart + i + 1, ringStart + i);
            indices.push(ringStart + i, prevRingStart + i + 1, ringStart + i + 1);
          }
          prevRingStart = ringStart;
        }
        
        // Connect last rounded ring to bottom
        for (let i = 0; i < segments; i++) {
          indices.push(prevRingStart + i, prevRingStart + i + 1, bottomOuterStart + i);
          indices.push(bottomOuterStart + i, prevRingStart + i + 1, bottomOuterStart + i + 1);
        }
      } else {
        // Flat edge - straight wall with taper
        for (let i = 0; i < segments; i++) {
          indices.push(topOuterStart + i, topOuterStart + i + 1, bottomOuterStart + i);
          indices.push(bottomOuterStart + i, topOuterStart + i + 1, bottomOuterStart + i + 1);
        }
      }
      
    } else {
      // Flat base with cord hole, no centering lip
      
      // 1. Top surface outer ring (y=0) - with optional edge lip
      const topY = edgeLip > 0 ? edgeLip : 0;
      const topOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
      }
      
      // Edge lip inner ring and wall if needed
      let surfaceRingStart = topOuterStart;
      if (edgeLip > 0) {
        const lipWall = 2;
        const lipInnerStart = vertices.length / 3;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const r = getOuterRadius(theta) - lipWall;
          vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
        }
        
        // Lip top face
        for (let i = 0; i < segments; i++) {
          indices.push(topOuterStart + i, lipInnerStart + i, topOuterStart + i + 1);
          indices.push(topOuterStart + i + 1, lipInnerStart + i, lipInnerStart + i + 1);
        }
        
        // Lip inner wall down to y=0
        const lipInnerBottomStart = vertices.length / 3;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const r = getOuterRadius(theta) - lipWall;
          vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
        }
        
        for (let i = 0; i < segments; i++) {
          indices.push(lipInnerStart + i, lipInnerBottomStart + i, lipInnerStart + i + 1);
          indices.push(lipInnerStart + i + 1, lipInnerBottomStart + i, lipInnerBottomStart + i + 1);
        }
        
        surfaceRingStart = lipInnerBottomStart;
      }
      
      // 2. Cord hole ring at top (y=0)
      const cordTopStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, 0, Math.sin(theta) * cordHoleRadius);
      }
      
      // Top surface (ring between outer and cord hole)
      for (let i = 0; i < segments; i++) {
        indices.push(surfaceRingStart + i, cordTopStart + i, surfaceRingStart + i + 1);
        indices.push(surfaceRingStart + i + 1, cordTopStart + i, cordTopStart + i + 1);
      }
      
      // 3. Cord hole ring at bottom
      const cordBottomStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * cordHoleRadius, -thickness, Math.sin(theta) * cordHoleRadius);
      }
      
      // Cord hole wall
      for (let i = 0; i < segments; i++) {
        indices.push(cordTopStart + i, cordBottomStart + i, cordTopStart + i + 1);
        indices.push(cordTopStart + i + 1, cordBottomStart + i, cordBottomStart + i + 1);
      }
      
      // 4. Base bottom outer ring (with taper!)
      const bottomOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getBottomRadius(theta);
        vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
      }
      
      // Base bottom (ring)
      for (let i = 0; i < segments; i++) {
        indices.push(bottomOuterStart + i, bottomOuterStart + i + 1, cordBottomStart + i);
        indices.push(cordBottomStart + i, bottomOuterStart + i + 1, cordBottomStart + i + 1);
      }
      
      // Base side wall with edge profile
      if (edgeStyle === 'chamfer' && chamferSize > 0) {
        const chamferStart = vertices.length / 3;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const topR = getOuterRadius(theta);
          vertices.push(Math.cos(theta) * (topR - chamferSize * 0.5), -chamferSize, Math.sin(theta) * (topR - chamferSize * 0.5));
        }
        
        for (let i = 0; i < segments; i++) {
          indices.push(topOuterStart + i, topOuterStart + i + 1, chamferStart + i);
          indices.push(chamferStart + i, topOuterStart + i + 1, chamferStart + i + 1);
        }
        
        for (let i = 0; i < segments; i++) {
          indices.push(chamferStart + i, chamferStart + i + 1, bottomOuterStart + i);
          indices.push(bottomOuterStart + i, chamferStart + i + 1, bottomOuterStart + i + 1);
        }
      } else if (edgeStyle === 'rounded' && roundedRadius > 0) {
        let prevRingStart = topOuterStart;
        for (let r = 1; r <= roundedSegments; r++) {
          const t = r / roundedSegments;
          const angle = t * Math.PI / 2;
          const yOffset = -roundedRadius * (1 - Math.cos(angle));
          const rOffset = roundedRadius * (1 - Math.sin(angle));
          
          const ringStart = vertices.length / 3;
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const topR = getOuterRadius(theta);
            const botR = getBottomRadius(theta);
            const blendT = Math.min(1, (-yOffset) / thickness);
            const baseR = topR + (botR - topR) * blendT;
            vertices.push(Math.cos(theta) * (baseR - rOffset), yOffset, Math.sin(theta) * (baseR - rOffset));
          }
          
          for (let i = 0; i < segments; i++) {
            indices.push(prevRingStart + i, prevRingStart + i + 1, ringStart + i);
            indices.push(ringStart + i, prevRingStart + i + 1, ringStart + i + 1);
          }
          prevRingStart = ringStart;
        }
        
        for (let i = 0; i < segments; i++) {
          indices.push(prevRingStart + i, prevRingStart + i + 1, bottomOuterStart + i);
          indices.push(bottomOuterStart + i, prevRingStart + i + 1, bottomOuterStart + i + 1);
        }
      } else {
        for (let i = 0; i < segments; i++) {
          indices.push(topOuterStart + i, topOuterStart + i + 1, bottomOuterStart + i);
          indices.push(bottomOuterStart + i, topOuterStart + i + 1, bottomOuterStart + i + 1);
        }
      }
    }
  } else {
    // === SOLID BASE (no cord hole) ===
    
    // Top surface with optional edge lip
    const topY = edgeLip > 0 ? edgeLip : 0;
    
    // 1. Top surface center
    const topCenterIdx = vertices.length / 3;
    vertices.push(0, topY, 0);
    
    // 2. Top surface outer ring (or lip inner ring if we have lip)
    let topFaceOuterStart: number;
    
    if (edgeLip > 0) {
      const lipWall = 2;
      // Lip outer ring
      const lipOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
      }
      
      // Lip inner ring at top
      const lipInnerTopStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getOuterRadius(theta) - lipWall;
        vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
      }
      
      // Lip top face
      for (let i = 0; i < segments; i++) {
        indices.push(lipOuterStart + i, lipInnerTopStart + i, lipOuterStart + i + 1);
        indices.push(lipOuterStart + i + 1, lipInnerTopStart + i, lipInnerTopStart + i + 1);
      }
      
      // Lip inner wall
      const lipInnerBottomStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getOuterRadius(theta) - lipWall;
        vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
      
      for (let i = 0; i < segments; i++) {
        indices.push(lipInnerTopStart + i, lipInnerBottomStart + i, lipInnerTopStart + i + 1);
        indices.push(lipInnerTopStart + i + 1, lipInnerBottomStart + i, lipInnerBottomStart + i + 1);
      }
      
      topFaceOuterStart = lipInnerBottomStart;
      
      // Adjust top center to y=0 for the main surface
      vertices[topCenterIdx * 3 + 1] = 0;
    } else {
      topFaceOuterStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = getOuterRadius(theta);
        vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      }
    }
    
    // Top face (solid disc)
    for (let i = 0; i < segments; i++) {
      indices.push(topCenterIdx, topFaceOuterStart + i + 1, topFaceOuterStart + i);
    }
    
    // 3. Bottom center
    const bottomCenterIdx = vertices.length / 3;
    vertices.push(0, -thickness, 0);
    
    // 4. Bottom outer ring (with taper!)
    const bottomOuterStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getBottomRadius(theta);
      vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
    }
    
    // Bottom face (solid disc)
    for (let i = 0; i < segments; i++) {
      indices.push(bottomCenterIdx, bottomOuterStart + i, bottomOuterStart + i + 1);
    }
    
    // Get the outer ring for side wall
    const sideWallTopStart = edgeLip > 0 ? topFaceOuterStart - (segments + 1) : topFaceOuterStart;
    
    // Side wall with edge profile
    if (edgeStyle === 'chamfer' && chamferSize > 0) {
      const chamferStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const topR = getOuterRadius(theta);
        vertices.push(Math.cos(theta) * (topR - chamferSize * 0.5), -chamferSize, Math.sin(theta) * (topR - chamferSize * 0.5));
      }
      
      // Need to use the lip outer ring for wall connection if we have lip
      const wallTopStart = edgeLip > 0 ? topFaceOuterStart - (segments + 1) * 2 : topFaceOuterStart;
      
      for (let i = 0; i < segments; i++) {
        indices.push(wallTopStart + i, wallTopStart + i + 1, chamferStart + i);
        indices.push(chamferStart + i, wallTopStart + i + 1, chamferStart + i + 1);
      }
      
      for (let i = 0; i < segments; i++) {
        indices.push(chamferStart + i, chamferStart + i + 1, bottomOuterStart + i);
        indices.push(bottomOuterStart + i, chamferStart + i + 1, bottomOuterStart + i + 1);
      }
    } else if (edgeStyle === 'rounded' && roundedRadius > 0) {
      const wallTopStart = edgeLip > 0 ? topFaceOuterStart - (segments + 1) * 2 : topFaceOuterStart;
      let prevRingStart = wallTopStart;
      
      for (let r = 1; r <= roundedSegments; r++) {
        const t = r / roundedSegments;
        const angle = t * Math.PI / 2;
        const yOffset = -roundedRadius * (1 - Math.cos(angle));
        const rOffset = roundedRadius * (1 - Math.sin(angle));
        
        const ringStart = vertices.length / 3;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const topR = getOuterRadius(theta);
          const botR = getBottomRadius(theta);
          const blendT = Math.min(1, (-yOffset) / thickness);
          const baseR = topR + (botR - topR) * blendT;
          vertices.push(Math.cos(theta) * (baseR - rOffset), yOffset, Math.sin(theta) * (baseR - rOffset));
        }
        
        for (let i = 0; i < segments; i++) {
          indices.push(prevRingStart + i, prevRingStart + i + 1, ringStart + i);
          indices.push(ringStart + i, prevRingStart + i + 1, ringStart + i + 1);
        }
        prevRingStart = ringStart;
      }
      
      for (let i = 0; i < segments; i++) {
        indices.push(prevRingStart + i, prevRingStart + i + 1, bottomOuterStart + i);
        indices.push(bottomOuterStart + i, prevRingStart + i + 1, bottomOuterStart + i + 1);
      }
    } else {
      // Flat edge with taper
      const wallTopStart = edgeLip > 0 ? topFaceOuterStart - (segments + 1) * 2 : topFaceOuterStart;
      for (let i = 0; i < segments; i++) {
        indices.push(wallTopStart + i, wallTopStart + i + 1, bottomOuterStart + i);
        indices.push(bottomOuterStart + i, wallTopStart + i + 1, bottomOuterStart + i + 1);
      }
    }
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  
  // Note: For screw/bayonet attachments, the holes are visual indicators only
  // Actual holes should be done in slicer or post-processing
  // This keeps the geometry manifold and printable
  
  return geo;
}

/**
 * Generate screw clearance holes through the base disc
 * Creates ring geometry around each hole position
 */
function generateScrewHoles(
  baseRadius: number,
  count: 3 | 4,
  holeRadius: number,
  thickness: number
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const holeSegments = 16;
  const holePositionRadius = baseRadius * 0.7; // Position holes at 70% from center
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const holeX = Math.cos(angle) * holePositionRadius;
    const holeZ = Math.sin(angle) * holePositionRadius;
    
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Create hole wall (cylinder going through disc)
    const topRingStart = 0;
    for (let j = 0; j <= holeSegments; j++) {
      const segAngle = (j / holeSegments) * Math.PI * 2;
      const x = holeX + Math.cos(segAngle) * holeRadius;
      const z = holeZ + Math.sin(segAngle) * holeRadius;
      vertices.push(x, 0, z);
    }
    
    const bottomRingStart = vertices.length / 3;
    for (let j = 0; j <= holeSegments; j++) {
      const segAngle = (j / holeSegments) * Math.PI * 2;
      const x = holeX + Math.cos(segAngle) * holeRadius;
      const z = holeZ + Math.sin(segAngle) * holeRadius;
      vertices.push(x, -thickness, z);
    }
    
    // Hole wall faces (inverted normals - pointing inward)
    for (let j = 0; j < holeSegments; j++) {
      const topA = topRingStart + j;
      const topB = topRingStart + j + 1;
      const botA = bottomRingStart + j;
      const botB = bottomRingStart + j + 1;
      indices.push(topA, botA, topB);
      indices.push(topB, botA, botB);
    }
    
    const holeGeo = new THREE.BufferGeometry();
    holeGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    holeGeo.setIndex(indices);
    holeGeo.computeVertexNormals();
    geometries.push(holeGeo);
  }
  
  return geometries;
}

/**
 * Generate bayonet L-slot geometry on the base disc
 * Creates L-shaped slots that tabs slide into and lock
 */
function generateBayonetSlots(
  baseRadius: number,
  count: 3 | 4,
  thickness: number
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const slotPositionRadius = baseRadius * 0.75;
  const { slotWidth, slotLength, rotationAngle } = BAYONET_SPECS;
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const slotX = Math.cos(angle) * slotPositionRadius;
    const slotZ = Math.sin(angle) * slotPositionRadius;
    
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Create L-shaped slot as a simplified box cutout
    // Entry slot (vertical portion)
    const slotHalfWidth = slotWidth / 2;
    const slotDepth = thickness;
    
    // Rotate slot tangentially
    const tangentAngle = angle + Math.PI / 2;
    const cosT = Math.cos(tangentAngle);
    const sinT = Math.sin(tangentAngle);
    
    // Slot entry vertices (top)
    vertices.push(
      slotX - cosT * slotHalfWidth, 0, slotZ - sinT * slotHalfWidth,
      slotX + cosT * slotHalfWidth, 0, slotZ + sinT * slotHalfWidth,
      slotX + cosT * slotHalfWidth, -slotDepth, slotZ + sinT * slotHalfWidth,
      slotX - cosT * slotHalfWidth, -slotDepth, slotZ - sinT * slotHalfWidth
    );
    
    // Slot walls
    indices.push(0, 1, 2);
    indices.push(0, 2, 3);
    
    const slotGeo = new THREE.BufferGeometry();
    slotGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    slotGeo.setIndex(indices);
    slotGeo.computeVertexNormals();
    geometries.push(slotGeo);
  }
  
  return geometries;
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

/**
 * Generate a simple flat base plate with keyhole slots for wall mounting
 * This is a SIMPLE flat plate - no socket, no centering lip, just flat with keyholes
 */
export function generateBaseMountPlate(
  baseRadius: number,      // mm - radius of the base disc
  baseThickness: number = 5, // mm - thickness of the base disc
  holeCount: 2 | 3 | 4 = 2,  // number of keyholes
  organicParams?: OrganicParams,
  _socketParams?: SocketParams,    // Ignored - base mount doesn't use socket features
  _attachmentParams?: AttachmentParams,  // Ignored
  pedestalParams?: PedestalParams
): THREE.BufferGeometry {
  const segments = 64;
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Use pedestal thickness if provided, minimum 5mm for structural integrity
  const thickness = Math.max(pedestalParams?.thickness ?? baseThickness, 5);
  const taper = pedestalParams?.taper ?? 0;
  const edgeStyle = pedestalParams?.edgeStyle ?? 'flat';
  const edgeLip = pedestalParams?.lip ?? 0;
  
  // Calculate tapered radius at bottom
  const bottomRadius = baseRadius * (1 - taper);
  
  // Organic deformation functions
  const getOuterRadius = (theta: number) => calculateDeformedRadius(theta, baseRadius, organicParams);
  const getBottomRadius = (theta: number) => calculateDeformedRadius(theta, bottomRadius, organicParams);
  
  // Edge styling
  const chamferSize = edgeStyle === 'chamfer' ? Math.min(thickness * 0.3, 3) : 0;
  const roundedRadius = edgeStyle === 'rounded' ? Math.min(thickness * 0.4, 4) : 0;
  const roundedSegments = 6;
  
  // === TOP SURFACE ===
  const topY = edgeLip > 0 ? edgeLip : 0;
  
  // Top center
  const topCenterIdx = vertices.length / 3;
  vertices.push(0, topY, 0);
  
  if (edgeLip > 0) {
    const lipWall = 2;
    
    // Lip outer ring
    const lipOuterStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getOuterRadius(theta);
      vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
    }
    
    // Lip inner ring at top
    const lipInnerTopStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getOuterRadius(theta) - lipWall;
      vertices.push(Math.cos(theta) * r, topY, Math.sin(theta) * r);
    }
    
    // Lip top face
    for (let i = 0; i < segments; i++) {
      indices.push(lipOuterStart + i, lipInnerTopStart + i, lipOuterStart + i + 1);
      indices.push(lipOuterStart + i + 1, lipInnerTopStart + i, lipInnerTopStart + i + 1);
    }
    
    // Lip inner wall
    const lipInnerBottomStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getOuterRadius(theta) - lipWall;
      vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    }
    
    for (let i = 0; i < segments; i++) {
      indices.push(lipInnerTopStart + i, lipInnerBottomStart + i, lipInnerTopStart + i + 1);
      indices.push(lipInnerTopStart + i + 1, lipInnerBottomStart + i, lipInnerBottomStart + i + 1);
    }
    
    // Top face (from center to lip inner)
    vertices[topCenterIdx * 3 + 1] = 0; // Adjust center to y=0
    for (let i = 0; i < segments; i++) {
      indices.push(topCenterIdx, lipInnerBottomStart + i + 1, lipInnerBottomStart + i);
    }
    
    // Outer wall top reference
    var wallTopStart = lipOuterStart;
  } else {
    // No lip - simple top surface
    const topOuterStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = getOuterRadius(theta);
      vertices.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    }
    
    // Top face
    for (let i = 0; i < segments; i++) {
      indices.push(topCenterIdx, topOuterStart + i + 1, topOuterStart + i);
    }
    
    var wallTopStart = topOuterStart;
  }
  
  // === BOTTOM SURFACE ===
  const bottomCenterIdx = vertices.length / 3;
  vertices.push(0, -thickness, 0);
  
  const bottomOuterStart = vertices.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = getBottomRadius(theta);
    vertices.push(Math.cos(theta) * r, -thickness, Math.sin(theta) * r);
  }
  
  // Bottom face
  for (let i = 0; i < segments; i++) {
    indices.push(bottomCenterIdx, bottomOuterStart + i, bottomOuterStart + i + 1);
  }
  
  // === SIDE WALL WITH EDGE PROFILE ===
  if (edgeStyle === 'chamfer' && chamferSize > 0) {
    const chamferStart = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const topR = getOuterRadius(theta);
      vertices.push(Math.cos(theta) * (topR - chamferSize * 0.5), -chamferSize, Math.sin(theta) * (topR - chamferSize * 0.5));
    }
    
    for (let i = 0; i < segments; i++) {
      indices.push(wallTopStart + i, wallTopStart + i + 1, chamferStart + i);
      indices.push(chamferStart + i, wallTopStart + i + 1, chamferStart + i + 1);
    }
    
    for (let i = 0; i < segments; i++) {
      indices.push(chamferStart + i, chamferStart + i + 1, bottomOuterStart + i);
      indices.push(bottomOuterStart + i, chamferStart + i + 1, bottomOuterStart + i + 1);
    }
  } else if (edgeStyle === 'rounded' && roundedRadius > 0) {
    let prevRingStart = wallTopStart;
    
    for (let r = 1; r <= roundedSegments; r++) {
      const t = r / roundedSegments;
      const angle = t * Math.PI / 2;
      const yOffset = -roundedRadius * (1 - Math.cos(angle));
      const rOffset = roundedRadius * (1 - Math.sin(angle));
      
      const ringStart = vertices.length / 3;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const topR = getOuterRadius(theta);
        const botR = getBottomRadius(theta);
        const blendT = Math.min(1, (-yOffset) / thickness);
        const baseR = topR + (botR - topR) * blendT;
        vertices.push(Math.cos(theta) * (baseR - rOffset), yOffset, Math.sin(theta) * (baseR - rOffset));
      }
      
      for (let i = 0; i < segments; i++) {
        indices.push(prevRingStart + i, prevRingStart + i + 1, ringStart + i);
        indices.push(ringStart + i, prevRingStart + i + 1, ringStart + i + 1);
      }
      prevRingStart = ringStart;
    }
    
    for (let i = 0; i < segments; i++) {
      indices.push(prevRingStart + i, prevRingStart + i + 1, bottomOuterStart + i);
      indices.push(bottomOuterStart + i, prevRingStart + i + 1, bottomOuterStart + i + 1);
    }
  } else {
    // Flat edge with taper
    for (let i = 0; i < segments; i++) {
      indices.push(wallTopStart + i, wallTopStart + i + 1, bottomOuterStart + i);
      indices.push(bottomOuterStart + i, wallTopStart + i + 1, bottomOuterStart + i + 1);
    }
  }
  
  const baseGeo = new THREE.BufferGeometry();
  baseGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  baseGeo.setIndex(indices);
  baseGeo.computeVertexNormals();
  
  // Create keyhole slot geometries
  const keyholeGeo = createSimpleKeyholes(baseRadius, thickness, holeCount);
  
  if (keyholeGeo) {
    return mergeGeometries([baseGeo, keyholeGeo]);
  }
  
  return baseGeo;
}

/**
 * Create simple keyhole slot geometries on the bottom of base plate
 * These are dark visual indicators showing where to drill/route keyholes
 */
function createSimpleKeyholes(
  baseRadius: number,
  baseThickness: number,
  holeCount: 2 | 3 | 4
): THREE.BufferGeometry | null {
  const segments = 32;
  const keyholeRadius = 4;     // 8mm diameter head hole
  const slotWidth = 2;         // 4mm wide slot
  const slotLength = 8;        // 8mm slot length
  
  const geometries: THREE.BufferGeometry[] = [];
  
  // Position keyholes based on count
  const holePositions: { x: number; z: number; angle: number }[] = [];
  const mountRadius = baseRadius * 0.6;
  
  if (holeCount === 2) {
    holePositions.push({ x: -mountRadius, z: 0, angle: Math.PI });
    holePositions.push({ x: mountRadius, z: 0, angle: 0 });
  } else if (holeCount === 3) {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
      holePositions.push({
        x: Math.cos(angle) * mountRadius,
        z: Math.sin(angle) * mountRadius,
        angle: angle + Math.PI / 2
      });
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      holePositions.push({
        x: Math.cos(angle) * mountRadius,
        z: Math.sin(angle) * mountRadius,
        angle: angle + Math.PI / 2
      });
    }
  }
  
  // Create each keyhole as a dark visual indicator on the bottom
  for (const pos of holePositions) {
    // Combine circle + slot into one shape
    const combinedShape = new THREE.Shape();
    combinedShape.moveTo(slotWidth, keyholeRadius * 0.3);
    combinedShape.lineTo(slotWidth, slotLength);
    for (let i = 0; i <= segments / 4; i++) {
      const a = (i / (segments / 4)) * Math.PI;
      combinedShape.lineTo(Math.cos(a) * slotWidth, slotLength + Math.sin(a) * slotWidth);
    }
    combinedShape.lineTo(-slotWidth, keyholeRadius * 0.3);
    // Around the circle
    for (let i = 0; i <= segments * 0.75; i++) {
      const a = Math.PI / 2 + (i / (segments * 0.75)) * (Math.PI * 1.5);
      combinedShape.lineTo(Math.cos(a) * keyholeRadius, Math.sin(a) * keyholeRadius);
    }
    combinedShape.closePath();
    
    const geo = new THREE.ExtrudeGeometry(combinedShape, {
      depth: 2, // Just 2mm deep visual indicator
      bevelEnabled: false,
    });
    
    // Rotate to face downward (-Y) and position
    geo.rotateX(Math.PI / 2);
    geo.rotateY(pos.angle);
    geo.translate(pos.x, -baseThickness, pos.z);
    
    geometries.push(geo);
  }
  
  if (geometries.length === 0) return null;
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
