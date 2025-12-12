import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LampParams, LampHardware, socketDimensions } from '@/types/lamp';

interface LampMeshProps {
  params: LampParams;
  hardware: LampHardware;
  showWireframe?: boolean;
}

// Simple 3D noise function
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

// Smooth interpolation for organic transitions
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const LampMesh = ({ params, hardware, showWireframe = false }: LampMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const scale = 0.01;
  
  const socket = socketDimensions[hardware.socketType];
  const lampStyle = hardware.lampStyle;
  
  // Rotate slowly
  useFrame(({ clock }) => {
    const rotation = clock.elapsedTime * 0.15;
    if (meshRef.current) meshRef.current.rotation.y = rotation;
    if (wireframeRef.current) wireframeRef.current.rotation.y = rotation;
  });
  
  const { geometry, wireframeGeometry } = useMemo(() => {
    const radialSegments = 48;
    
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    const {
      height, baseRadius, topRadius, wallThickness,
      wobbleFrequency, wobbleAmplitude, twistAngle,
      bulgePosition, bulgeAmount, pinchAmount, asymmetry,
      rippleCount, rippleDepth, lipFlare, lipHeight,
      organicNoise, noiseScale, baseThickness, socketHoleDiameter,
      ventilationSlots, ventSlotCount, ventSlotWidth, ventSlotHeight,
      mounting,
    } = params;
    
    const cordHoleRadius = hardware.cordDiameter / 2 + 2;
    
    // Style-specific geometry adjustments
    const isTableOrFloor = lampStyle === 'table' || lampStyle === 'floor';
    const isPendant = lampStyle === 'pendant';
    const isWallSconce = lampStyle === 'wall_sconce';
    
    // Apply organic deformations to a radius at given height and angle
    // Matches the organic effects from ParametricMesh
    const getOrganicRadius = (
      baseR: number, 
      t: number, 
      theta: number, 
      applyDeformations: boolean = true
    ): number => {
      let r = baseR;
      
      if (!applyDeformations) return r;
      
      // Wobble - smooth wave deformation (same as ParametricMesh)
      if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
        const maxWobble = Math.min(wobbleAmplitude, 0.15);
        r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * baseRadius;
      }
      
      // Ripples - vertical sine pattern
      if (rippleCount > 0 && rippleDepth > 0) {
        const maxRipple = Math.min(rippleDepth, 0.1);
        r += Math.sin(theta * rippleCount) * maxRipple * baseRadius;
      }
      
      // Asymmetry - directional offset
      if (asymmetry > 0) {
        const maxAsym = Math.min(asymmetry, 0.1);
        r += Math.sin(theta) * Math.cos(t * Math.PI * 2) * maxAsym * baseRadius;
      }
      
      // Organic noise - 3D procedural variation
      if (organicNoise > 0) {
        const maxNoise = Math.min(organicNoise, 0.1);
        const nx = Math.cos(theta) * r * 10;
        const ny = t * 10;
        const nz = Math.sin(theta) * r * 10;
        r += noise3D(nx, ny, nz) * maxNoise * baseRadius;
      }
      
      return Math.max(r, 5);
    };
    
    // Helper to get shade profile radius at normalized t (0-1 along shade height)
    // Includes bulge, pinch, lip flare - same organic curves as ParametricMesh
    const getShadeRadius = (t: number): number => {
      // Base interpolation with organic curve (similar to ParametricMesh vase curve)
      const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
      let radiusAtHeight = baseRadius * (1 - t * 0.4) + topRadius * t * 0.6 + curve * baseRadius * 0.12;
      
      // Organic bulge - gaussian centered at bulgePosition
      const bulgeDist = Math.abs(t - bulgePosition);
      radiusAtHeight += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;
      
      // Pinch effect - squeeze at top and bottom
      const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
      const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
      radiusAtHeight *= (1 - pinchTop - pinchBottom);
      
      // Lip flare at top
      const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
      radiusAtHeight += lipT * lipT * lipFlare * baseRadius;
      
      // Style-specific subtle adjustments
      if (isTableOrFloor) {
        radiusAtHeight *= 1 + 0.08 * Math.pow(1 - t, 2); // Slightly wider at base
      } else if (isPendant) {
        radiusAtHeight *= 1 - 0.05 * t * t; // Slightly narrower at top
      } else if (isWallSconce) {
        // Dome profile
        const domeShape = Math.sin(t * Math.PI * 0.9);
        radiusAtHeight = radiusAtHeight * (0.5 + domeShape * 0.5);
      }
      
      return Math.max(radiusAtHeight, 10);
    };
    
    // Build unified geometry profile
    interface ProfilePoint {
      y: number;
      outerR: number;
      innerR: number;
      applyDeformations: boolean;
    }
    
    const profile: ProfilePoint[] = [];
    const heightSegments = 64;
    
    // ============================================
    // ALL LAMP STYLES: Simple organic shade only
    // Hardware is internal/invisible - just affects inner radius
    // ============================================
    
    // Socket internal clearance dimensions
    const socketClearanceRadius = socket.outerDiameter / 2 + 3;
    
    if (isWallSconce) {
      // Wall sconce: half-dome shade only
      // Flat back handled by theta range in vertex generation
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * height * 0.8; // Shorter dome
        const shadeR = getShadeRadius(t);
        const innerR = shadeR - wallThickness;
        
        profile.push({
          y,
          outerR: shadeR,
          innerR: Math.max(innerR, socketClearanceRadius),
          applyDeformations: true,
        });
      }
    } else {
      // Pendant, Table, Floor: Standard organic shade
      // Table/floor have closed bottom, pendant is open
      const hasClosedBottom = isTableOrFloor;
      
      if (hasClosedBottom) {
        // Closed base with cord hole
        profile.push({
          y: 0,
          outerR: getShadeRadius(0),
          innerR: cordHoleRadius,
          applyDeformations: true,
        });
      }
      
      for (let i = hasClosedBottom ? 1 : 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * height;
        const shadeR = getShadeRadius(t);
        let innerR = shadeR - wallThickness;
        
        // Internal socket mounting lip near top (invisible from outside)
        if (t > 0.85) {
          const lipProgress = (t - 0.85) / 0.15;
          innerR = Math.min(innerR, socketClearanceRadius + (innerR - socketClearanceRadius) * (1 - lipProgress * 0.5));
        }
        
        profile.push({
          y,
          outerR: shadeR,
          innerR: Math.max(innerR, 5),
          applyDeformations: true,
        });
      }
      
      // Pendant: collar at top (organic transition, not blocky)
      if (isPendant) {
        const topR = getShadeRadius(1);
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          const y = height + t * 12;
          // Smooth organic narrowing to cord
          const narrowFactor = 1 - Math.pow(t, 0.7) * 0.8;
          const collarR = topR * narrowFactor + cordHoleRadius * (1 - narrowFactor);
          
          profile.push({
            y,
            outerR: collarR + wallThickness * (1 - t * 0.5),
            innerR: collarR,
            applyDeformations: t < 0.5, // Organic at base, smooth at top
          });
        }
      }
    }
    
    
    // Build vertices from profile
    const twistRate = (twistAngle * Math.PI / 180) / height;
    const actualTotalHeight = profile[profile.length - 1].y;
    
    // For wall sconce, only generate front half (0 to PI)
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
          
          // Apply organic deformations
          if (point.applyDeformations) {
            r = getOrganicRadius(r, t, theta, true);
          }
          
          // Handle ventilation slots on shade
          if (ventilationSlots && t > 0.7 && point.y <= height) {
            const slotAngle = (Math.PI * 2) / ventSlotCount;
            const nearSlot = Math.abs(((theta % slotAngle) - slotAngle / 2)) < (ventSlotWidth / point.outerR / 2);
            if (nearSlot && point.y > height - ventSlotHeight - 10) {
              if (!isInner) {
                r = point.outerR - wallThickness * 0.8;
              }
            }
          }
          
          r = Math.max(r, 3);
          
          const posX = Math.cos(theta) * r;
          const posZ = Math.sin(theta) * r;
          
          positions.push(posX * scale, point.y * scale, posZ * scale);
          
          const nx = Math.cos(theta);
          const nz = Math.sin(theta);
          normals.push(isInner ? -nx : nx, 0, isInner ? -nz : nz);
          
          uvs.push(x / radialSegments, point.y / actualTotalHeight);
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
      if (profile[p].innerR > 0 && profile[p + 1].innerR > 0) {
        for (let x = 0; x < radialSegments; x++) {
          const a = innerOffset + p * verticesPerRing + x;
          const b = a + 1;
          const c = innerOffset + (p + 1) * verticesPerRing + x;
          const d = c + 1;
          
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
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
    
    // Wall sconce: close the flat back edges
    if (isWallSconce) {
      // Connect front edges with flat back faces
      for (let p = 0; p < profileCount - 1; p++) {
        // Left edge (theta = -PI/2)
        const outerLeft1 = p * verticesPerRing;
        const outerLeft2 = (p + 1) * verticesPerRing;
        const innerLeft1 = innerOffset + p * verticesPerRing;
        const innerLeft2 = innerOffset + (p + 1) * verticesPerRing;
        
        if (profile[p].innerR > 0 && profile[p + 1].innerR > 0) {
          indices.push(outerLeft1, innerLeft1, outerLeft2);
          indices.push(innerLeft1, innerLeft2, outerLeft2);
        }
        
        // Right edge (theta = PI/2)
        const outerRight1 = p * verticesPerRing + radialSegments;
        const outerRight2 = (p + 1) * verticesPerRing + radialSegments;
        const innerRight1 = innerOffset + p * verticesPerRing + radialSegments;
        const innerRight2 = innerOffset + (p + 1) * verticesPerRing + radialSegments;
        
        if (profile[p].innerR > 0 && profile[p + 1].innerR > 0) {
          indices.push(outerRight1, outerRight2, innerRight1);
          indices.push(innerRight1, outerRight2, innerRight2);
        }
      }
    }
    
    // Bottom cap
    if (profile[0].innerR === 0) {
      const bottomY = profile[0].y;
      const baseCenterIdx = positions.length / 3;
      positions.push(0, bottomY * scale, 0);
      normals.push(0, -1, 0);
      uvs.push(0.5, 0.5);
      
      const bottomR = profile[0].outerR;
      for (let x = 0; x <= radialSegments; x++) {
        const theta = thetaStart + (x / radialSegments) * thetaRange;
        const r = bottomR;
        positions.push(Math.cos(theta) * r * scale, bottomY * scale, Math.sin(theta) * r * scale);
        normals.push(0, -1, 0);
        uvs.push(Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5);
      }
      
      for (let x = 0; x < radialSegments; x++) {
        indices.push(baseCenterIdx, baseCenterIdx + x + 2, baseCenterIdx + x + 1);
      }
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    
    const wireGeo = new THREE.WireframeGeometry(geo);
    
    return { geometry: geo, wireframeGeometry: wireGeo };
  }, [params, hardware.lampStyle, hardware.cordDiameter, socket, scale]);
  
  return (
    <group>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#f0f0f0"
          roughness={0.3}
          metalness={0.1}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {showWireframe && (
        <lineSegments ref={wireframeRef} geometry={wireframeGeometry}>
          <lineBasicMaterial color="#0066ff" transparent opacity={0.3} />
        </lineSegments>
      )}
    </group>
  );
};

export default LampMesh;