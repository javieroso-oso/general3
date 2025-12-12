import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { 
  LampParams, 
  LampHardware, 
  socketDimensions, 
  threadedRingSpecs,
  getMountingDimensions,
  MountingDimensions,
} from '@/types/lamp';

// Simple 3D noise function (same as LampMesh)
const seededRandom = (x: number, y: number, z: number): number => {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719;
  return (Math.sin(dot) * 43758.5453) % 1;
};

const noise3D = (x: number, y: number, z: number): number => {
  const floorX = Math.floor(x);
  const floorY = Math.floor(y);
  const floorZ = Math.floor(z);
  const fracX = x - floorX;
  const fracY = y - floorY;
  const fracZ = z - floorZ;

  const v000 = seededRandom(floorX, floorY, floorZ);
  const v100 = seededRandom(floorX + 1, floorY, floorZ);
  const v010 = seededRandom(floorX, floorY + 1, floorZ);
  const v110 = seededRandom(floorX + 1, floorY + 1, floorZ);
  const v001 = seededRandom(floorX, floorY, floorZ + 1);
  const v101 = seededRandom(floorX + 1, floorY, floorZ + 1);
  const v011 = seededRandom(floorX, floorY + 1, floorZ + 1);
  const v111 = seededRandom(floorX + 1, floorY + 1, floorZ + 1);

  const i1 = v000 * (1 - fracX) + v100 * fracX;
  const i2 = v010 * (1 - fracX) + v110 * fracX;
  const i3 = v001 * (1 - fracX) + v101 * fracX;
  const i4 = v011 * (1 - fracX) + v111 * fracX;
  const j1 = i1 * (1 - fracY) + i2 * fracY;
  const j2 = i3 * (1 - fracY) + i4 * fracY;

  return j1 * (1 - fracZ) + j2 * fracZ;
};

export interface LampExportParts {
  shade: THREE.BufferGeometry;
  backplate?: THREE.BufferGeometry;
}

export interface ExportOptions {
  format: 'single' | 'multi';
  includeBackplate: boolean;
}

// Generate shade geometry with functional mounting features
export function generateShadeGeometry(
  params: LampParams,
  hardware: LampHardware
): THREE.BufferGeometry {
  const radialSegments = 64;
  const positions: number[] = [];
  const indices: number[] = [];
  
  const {
    height, baseRadius, topRadius, wallThickness,
    wobbleFrequency, wobbleAmplitude, twistAngle,
    bulgePosition, bulgeAmount, pinchAmount,
    rippleCount, rippleDepth, lipFlare, lipHeight,
    organicNoise,
  } = params;
  
  const socket = socketDimensions[hardware.socketType];
  const mounting = getMountingDimensions(hardware.socketType, hardware.mountType, hardware.mountTolerance);
  const cordHoleRadius = hardware.cordDiameter / 2 + 2;
  
  const isStanding = hardware.lampStyle === 'standing';
  const isPendant = hardware.lampStyle === 'pendant';
  const isWallSconce = hardware.lampStyle === 'wall_sconce';
  
  // Apply organic deformations
  const getOrganicRadius = (baseR: number, t: number, theta: number): number => {
    let r = baseR;
    
    if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
      const maxWobble = Math.min(wobbleAmplitude, 0.15);
      r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * baseRadius;
    }
    
    if (rippleCount > 0 && rippleDepth > 0) {
      const maxRipple = Math.min(rippleDepth, 0.1);
      r += Math.sin(theta * rippleCount) * maxRipple * baseRadius;
    }
    
    if (organicNoise > 0) {
      const maxNoise = Math.min(organicNoise, 0.1);
      const nx = Math.cos(theta) * r * 10;
      const ny = t * 10;
      const nz = Math.sin(theta) * r * 10;
      r += noise3D(nx, ny, nz) * maxNoise * baseRadius;
    }
    
    return Math.max(r, 5);
  };
  
  // Get shade profile radius
  const getShadeRadius = (t: number): number => {
    const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
    let radiusAtHeight = baseRadius * (1 - t * 0.4) + topRadius * t * 0.6 + curve * baseRadius * 0.12;
    
    const bulgeDist = Math.abs(t - bulgePosition);
    radiusAtHeight += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;
    
    const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
    const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
    radiusAtHeight *= (1 - pinchTop - pinchBottom);
    
    const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
    radiusAtHeight += lipT * lipT * lipFlare * baseRadius;
    
    if (isStanding) {
      radiusAtHeight *= 1 + 0.08 * Math.pow(1 - t, 2);
    } else if (isPendant) {
      radiusAtHeight *= 1 - 0.05 * t * t;
    } else if (isWallSconce) {
      const domeShape = Math.sin(t * Math.PI * 0.9);
      radiusAtHeight = radiusAtHeight * (0.5 + domeShape * 0.5);
    }
    
    return Math.max(radiusAtHeight, 10);
  };
  
  // Get inner radius with mounting features
  const getInnerRadius = (t: number, shadeR: number): number => {
    let innerR = shadeR - wallThickness;
    
    // Create mounting lip near top based on mount type
    const mountZoneStart = 0.85;
    if (t > mountZoneStart) {
      const lipProgress = (t - mountZoneStart) / (1 - mountZoneStart);
      
      if (hardware.mountType === 'threaded_ring') {
        // Create a ledge for threaded ring to sit on
        const ledgeR = mounting.holeDiameter / 2;
        const lipInnerR = mounting.lipInnerDiameter / 2;
        
        if (lipProgress < 0.5) {
          // Transition to ledge
          innerR = Math.min(innerR, ledgeR + (innerR - ledgeR) * (1 - lipProgress * 2));
        } else {
          // Inner opening for socket
          innerR = lipInnerR;
        }
      } else if (hardware.mountType === 'press_fit') {
        // Slightly undersized collar for friction fit
        const collarR = mounting.lipInnerDiameter / 2;
        innerR = Math.min(innerR, collarR);
      } else if (hardware.mountType === 'snap_ring') {
        // Create groove for snap ring
        const grooveR = mounting.holeDiameter / 2;
        const grooveDepth = 2;
        
        if (lipProgress > 0.3 && lipProgress < 0.5) {
          // Groove section
          innerR = Math.min(innerR, grooveR + grooveDepth);
        } else {
          innerR = Math.min(innerR, grooveR);
        }
      }
    }
    
    return Math.max(innerR, cordHoleRadius);
  };
  
  // Build profile
  interface ProfilePoint {
    y: number;
    outerR: number;
    innerR: number;
  }
  
  const profile: ProfilePoint[] = [];
  const heightSegments = 64;
  
  // Build shade profile
  if (isStanding) {
    // Closed bottom with cord hole
    profile.push({ y: 0, outerR: getShadeRadius(0), innerR: cordHoleRadius });
  }
  
  for (let i = isStanding ? 1 : 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = isWallSconce ? t * height * 0.8 : t * height;
    const shadeR = getShadeRadius(t);
    const innerR = getInnerRadius(t, shadeR);
    
    profile.push({ y, outerR: shadeR, innerR });
  }
  
  // Pendant collar
  if (isPendant) {
    const topR = getShadeRadius(1);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const y = height + t * 12;
      const narrowFactor = 1 - Math.pow(t, 0.7) * 0.8;
      const collarR = topR * narrowFactor + cordHoleRadius * (1 - narrowFactor);
      
      profile.push({
        y,
        outerR: collarR + wallThickness * (1 - t * 0.5),
        innerR: collarR,
      });
    }
  }
  
  // Generate vertices
  const twistRate = (twistAngle * Math.PI / 180) / height;
  const thetaStart = isWallSconce ? -Math.PI / 2 : 0;
  const thetaEnd = isWallSconce ? Math.PI / 2 : Math.PI * 2;
  const thetaRange = thetaEnd - thetaStart;
  
  for (let layer = 0; layer <= 1; layer++) {
    const isInner = layer === 1;
    
    for (let p = 0; p < profile.length; p++) {
      const point = profile[p];
      const t = point.y / Math.max(height, 1);
      const twistAtHeight = twistRate * Math.min(point.y, height);
      
      for (let x = 0; x <= radialSegments; x++) {
        const theta = thetaStart + (x / radialSegments) * thetaRange + twistAtHeight;
        let r = isInner ? point.innerR : point.outerR;
        
        if (point.y <= height) {
          r = getOrganicRadius(r, t, theta);
        }
        
        r = Math.max(r, 3);
        positions.push(Math.cos(theta) * r, point.y, Math.sin(theta) * r);
      }
    }
  }
  
  // Build indices
  const verticesPerRing = radialSegments + 1;
  const profileCount = profile.length;
  
  // Outer shell
  for (let p = 0; p < profileCount - 1; p++) {
    for (let x = 0; x < radialSegments; x++) {
      const a = p * verticesPerRing + x;
      const b = a + 1;
      const c = (p + 1) * verticesPerRing + x;
      const d = c + 1;
      
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  // Inner shell (reversed winding)
  const innerOffset = profileCount * verticesPerRing;
  for (let p = 0; p < profileCount - 1; p++) {
    for (let x = 0; x < radialSegments; x++) {
      const a = innerOffset + p * verticesPerRing + x;
      const b = a + 1;
      const c = innerOffset + (p + 1) * verticesPerRing + x;
      const d = c + 1;
      
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  
  // Connect top rim
  const outerTopStart = (profileCount - 1) * verticesPerRing;
  const innerTopStart = innerOffset + (profileCount - 1) * verticesPerRing;
  for (let x = 0; x < radialSegments; x++) {
    const a = outerTopStart + x;
    const b = outerTopStart + x + 1;
    const c = innerTopStart + x;
    const d = innerTopStart + x + 1;
    
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  // Connect bottom rim (open shades)
  if (!isStanding && profile[0].innerR > 0) {
    const outerBottomStart = 0;
    const innerBottomStart = innerOffset;
    for (let x = 0; x < radialSegments; x++) {
      const a = outerBottomStart + x;
      const b = outerBottomStart + x + 1;
      const c = innerBottomStart + x;
      const d = innerBottomStart + x + 1;
      
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  // Bottom cap for standing lamps
  if (isStanding) {
    const bottomY = 0;
    const baseCenterIdx = positions.length / 3;
    positions.push(0, bottomY, 0);
    
    const bottomOuterR = profile[0].outerR;
    const bottomInnerR = profile[0].innerR;
    
    // Outer ring vertices
    for (let x = 0; x <= radialSegments; x++) {
      const theta = (x / radialSegments) * Math.PI * 2;
      positions.push(Math.cos(theta) * bottomOuterR, bottomY, Math.sin(theta) * bottomOuterR);
    }
    
    // Inner ring vertices (cord hole)
    const innerRingStart = baseCenterIdx + 1 + radialSegments + 1;
    for (let x = 0; x <= radialSegments; x++) {
      const theta = (x / radialSegments) * Math.PI * 2;
      positions.push(Math.cos(theta) * bottomInnerR, bottomY, Math.sin(theta) * bottomInnerR);
    }
    
    // Create bottom face with hole (ring of triangles)
    for (let x = 0; x < radialSegments; x++) {
      const outerA = baseCenterIdx + 1 + x;
      const outerB = baseCenterIdx + 1 + x + 1;
      const innerA = innerRingStart + x;
      const innerB = innerRingStart + x + 1;
      
      indices.push(outerA, outerB, innerB);
      indices.push(outerA, innerB, innerA);
    }
  }
  
  // Wall sconce flat back
  if (isWallSconce) {
    for (let p = 0; p < profileCount - 1; p++) {
      const outerLeft1 = p * verticesPerRing;
      const outerLeft2 = (p + 1) * verticesPerRing;
      const innerLeft1 = innerOffset + p * verticesPerRing;
      const innerLeft2 = innerOffset + (p + 1) * verticesPerRing;
      
      indices.push(outerLeft1, innerLeft1, outerLeft2);
      indices.push(innerLeft1, innerLeft2, outerLeft2);
      
      const outerRight1 = p * verticesPerRing + radialSegments;
      const outerRight2 = (p + 1) * verticesPerRing + radialSegments;
      const innerRight1 = innerOffset + p * verticesPerRing + radialSegments;
      const innerRight2 = innerOffset + (p + 1) * verticesPerRing + radialSegments;
      
      indices.push(outerRight1, outerRight2, innerRight1);
      indices.push(innerRight1, outerRight2, innerRight2);
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

// Generate backplate for wall sconce
export function generateBackplateGeometry(
  params: LampParams
): THREE.BufferGeometry {
  const width = params.mounting.backplateWidth;
  const height = params.mounting.backplateHeight;
  const thickness = 4; // mm
  const holeRadius = 3; // mm for mounting screws
  const holeOffset = 15; // mm from edge
  
  const geometry = new THREE.BoxGeometry(width, height, thickness);
  
  // Note: For a proper implementation, we'd subtract holes
  // This is a simplified version - holes would be added via CSG
  
  return geometry;
}

// Generate all lamp parts
export function generateLampParts(
  params: LampParams,
  hardware: LampHardware
): LampExportParts {
  const parts: LampExportParts = {
    shade: generateShadeGeometry(params, hardware),
  };
  
  if (hardware.lampStyle === 'wall_sconce') {
    parts.backplate = generateBackplateGeometry(params);
  }
  
  return parts;
}

// Export single STL
export function exportShadeSTL(
  params: LampParams,
  hardware: LampHardware
): Blob {
  const geometry = generateShadeGeometry(params, hardware);
  const exporter = new STLExporter();
  const mesh = new THREE.Mesh(geometry);
  const stlString = exporter.parse(mesh, { binary: false });
  return new Blob([stlString], { type: 'model/stl' });
}

// Download shade STL
export function downloadShadeSTL(
  params: LampParams,
  hardware: LampHardware,
  filename: string = 'lamp-shade.stl'
): void {
  const blob = exportShadeSTL(params, hardware);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Download all parts as separate files
export function downloadLampParts(
  params: LampParams,
  hardware: LampHardware,
  baseName: string = 'lamp'
): void {
  const parts = generateLampParts(params, hardware);
  const exporter = new STLExporter();
  
  // Download shade
  const shadeMesh = new THREE.Mesh(parts.shade);
  const shadeSTL = exporter.parse(shadeMesh, { binary: false });
  const shadeBlob = new Blob([shadeSTL], { type: 'model/stl' });
  const shadeUrl = URL.createObjectURL(shadeBlob);
  const shadeLink = document.createElement('a');
  shadeLink.href = shadeUrl;
  shadeLink.download = `${baseName}-shade.stl`;
  shadeLink.click();
  URL.revokeObjectURL(shadeUrl);
  
  // Download backplate if exists
  if (parts.backplate) {
    const backplateMesh = new THREE.Mesh(parts.backplate);
    const backplateSTL = exporter.parse(backplateMesh, { binary: false });
    const backplateBlob = new Blob([backplateSTL], { type: 'model/stl' });
    const backplateUrl = URL.createObjectURL(backplateBlob);
    const backplateLink = document.createElement('a');
    backplateLink.href = backplateUrl;
    backplateLink.download = `${baseName}-backplate.stl`;
    backplateLink.click();
    URL.revokeObjectURL(backplateUrl);
  }
}
