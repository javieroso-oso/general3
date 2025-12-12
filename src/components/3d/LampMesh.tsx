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
    } = params;
    
    const cordHoleRadius = hardware.cordDiameter / 2 + 2;
    
    // Style-specific geometry adjustments
    const isTableOrFloor = lampStyle === 'table' || lampStyle === 'floor';
    const isPendant = lampStyle === 'pendant';
    const isClipOn = lampStyle === 'clip_on';
    const isWallSconce = lampStyle === 'wall_sconce';
    
    // Apply organic deformations to a radius at given height and angle
    const getOrganicRadius = (
      baseR: number, 
      t: number, 
      theta: number, 
      applyDeformations: boolean = true
    ): number => {
      let r = baseR;
      
      if (!applyDeformations) return r;
      
      // Wobble
      if (wobbleFrequency > 0) {
        r += Math.sin(theta * wobbleFrequency + t * Math.PI * 2) * wobbleAmplitude * baseRadius * 0.5;
      }
      
      // Asymmetry (stronger at bottom)
      if (asymmetry > 0) {
        r += Math.cos(theta) * asymmetry * baseRadius * 0.3 * (1 - t);
      }
      
      // Ripples
      if (rippleCount > 0) {
        r += Math.sin(t * rippleCount * Math.PI) * rippleDepth * baseRadius * 0.3;
      }
      
      // Organic noise
      if (organicNoise > 0) {
        const nx = Math.cos(theta) * noiseScale;
        const ny = t * noiseScale * 3;
        const nz = Math.sin(theta) * noiseScale;
        r += (noise3D(nx, ny, nz) - 0.5) * organicNoise * baseRadius * 0.5;
      }
      
      // Wall sconce: flatten the back side (theta near PI)
      if (isWallSconce) {
        const backFlatten = Math.cos(theta); // -1 at back, +1 at front
        if (backFlatten < 0) {
          // Flatten back side proportionally
          r *= 1 + backFlatten * 0.4; // Reduce radius at back by up to 40%
        }
      }
      
      return Math.max(r, 5);
    };
    
    // Helper to get shade profile radius at normalized t (0-1 along shade height)
    const getShadeRadius = (t: number, theta?: number): number => {
      let radiusAtHeight = baseRadius + (topRadius - baseRadius) * t;
      
      // Style-specific profile modifications
      if (isTableOrFloor) {
        // Table/floor: wider, more stable base with gentle taper
        const baseFlare = 1 + 0.15 * (1 - t) * (1 - t);
        radiusAtHeight *= baseFlare;
      } else if (isPendant) {
        // Pendant: narrower at top where it hangs, wider bottom
        const pendantTaper = 1 - 0.1 * t * t;
        radiusAtHeight *= pendantTaper;
      } else if (isClipOn) {
        // Clip-on: uniform cylinder-ish shape with slight taper
        radiusAtHeight = baseRadius * 0.9 + (topRadius - baseRadius * 0.9) * t * 0.7;
      } else if (isWallSconce) {
        // Wall sconce: slightly smaller overall, dome-like profile
        const domeShape = Math.sin(t * Math.PI * 0.9); // Dome curve
        radiusAtHeight = baseRadius * 0.7 * (1 + domeShape * 0.3);
      }
      
      // Bulge
      const bulgeT = 1 - Math.abs(t - bulgePosition) * 2;
      if (bulgeT > 0) {
        radiusAtHeight *= 1 + bulgeAmount * Math.pow(bulgeT, 2);
      }
      
      // Pinch at bottom
      if (t < 0.3) {
        radiusAtHeight *= 1 - pinchAmount * (1 - t / 0.3);
      }
      
      // Lip flare at top
      if (t > 1 - lipHeight) {
        const lipT = (t - (1 - lipHeight)) / lipHeight;
        radiusAtHeight *= 1 + lipFlare * Math.pow(lipT, 0.5);
      }
      
      return radiusAtHeight;
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
    
    // Determine bottom style based on lamp type
    const hasClosedBottom = isTableOrFloor;
    const bottomThickness = hasClosedBottom ? Math.max(baseThickness, 12) : baseThickness;
    
    // For clip-on, add clip geometry at top
    const clipExtension = isClipOn ? 20 : 0;
    const totalHeight = height + clipExtension;
    
    // Main shade body
    for (let i = 0; i <= heightSegments; i++) {
      const t = i / heightSegments;
      const y = t * height;
      
      const shadeR = getShadeRadius(t);
      
      // Calculate inner radius based on position
      let innerR = shadeR - wallThickness;
      
      // Socket accommodation at top - internal lip for socket to rest on
      const socketLipStart = params.socketMountingHeight - socket.collarHeight;
      const socketLipEnd = params.socketMountingHeight;
      
      if (y >= socketLipStart && y <= socketLipEnd) {
        const lipProgress = (y - socketLipStart) / (socketLipEnd - socketLipStart);
        const lipThickness = 3;
        innerR = Math.min(innerR, socketHoleDiameter / 2 + lipThickness * (1 - smoothstep(0.3, 0.8, lipProgress)));
      } else if (y > socketLipEnd) {
        innerR = Math.min(innerR, socketHoleDiameter / 2);
      }
      
      // Bottom closure for table/floor lamps with cord channel
      if (hasClosedBottom && y < bottomThickness) {
        const bottomProgress = y / bottomThickness;
        innerR = cordHoleRadius + (innerR - cordHoleRadius) * smoothstep(0, 0.8, bottomProgress);
      }
      
      profile.push({
        y,
        outerR: shadeR,
        innerR: Math.max(innerR, hasClosedBottom && t < 0.08 ? cordHoleRadius : 0),
        applyDeformations: true,
      });
    }
    
    // Add clip-on extension at top with spring tension geometry
    if (isClipOn) {
      const topShadeR = getShadeRadius(1);
      const bulbGripRadius = socketHoleDiameter / 2 + 5; // Slightly larger than socket
      
      // Main clip body
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const y = height + t * clipExtension * 0.6;
        // Clip curves inward
        const clipR = topShadeR * (1 - t * 0.5) + bulbGripRadius * t * 0.3;
        
        profile.push({
          y,
          outerR: clipR + wallThickness,
          innerR: clipR,
          applyDeformations: false,
        });
      }
      
      // Inner grip lip - curves back out slightly for spring tension
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        const y = height + clipExtension * 0.6 + t * clipExtension * 0.4;
        // Spring back outward then grip inward
        const springCurve = Math.sin(t * Math.PI);
        const gripR = bulbGripRadius * (1 + springCurve * 0.15) * (1 - t * 0.3);
        
        profile.push({
          y,
          outerR: gripR + wallThickness * 0.8,
          innerR: Math.max(gripR, 8),
          applyDeformations: false,
        });
      }
    }
    
    // Add wall sconce backplate at bottom
    if (isWallSconce) {
      const backplateThickness = 8;
      const backplateRadius = baseRadius * 0.8;
      
      // Transition from shade to backplate
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        const y = -t * backplateThickness;
        const plateR = getShadeRadius(0) * (1 - t * 0.3) + backplateRadius * t * 0.3;
        
        profile.unshift({
          y,
          outerR: plateR,
          innerR: 0, // Solid backplate
          applyDeformations: false,
        });
      }
    }
    
    // Add pendant collar at top
    if (isPendant) {
      const topShadeR = getShadeRadius(1);
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const y = height + t * 15;
        // Collar tapers to cord hole
        const collarR = topShadeR * (1 - t * 0.7) + cordHoleRadius * t;
        
        profile.push({
          y,
          outerR: collarR + wallThickness,
          innerR: collarR,
          applyDeformations: false,
        });
      }
    }
    
    // Build vertices from profile
    const twistRate = (twistAngle * Math.PI / 180) / height;
    const actualTotalHeight = profile[profile.length - 1].y;
    
    for (let layer = 0; layer <= 1; layer++) {
      const isInner = layer === 1;
      
      for (let p = 0; p < profile.length; p++) {
        const point = profile[p];
        const t = point.y / height;
        const twistAtHeight = twistRate * Math.min(point.y, height);
        
        for (let x = 0; x <= radialSegments; x++) {
          const theta = (x / radialSegments) * Math.PI * 2 + twistAtHeight;
          
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
    
    // Bottom cap (closed for table/floor, or if baseThickness > 0)
    if (bottomThickness > 0) {
      const bottomY = profile[0].y;
      const baseCenterIdx = positions.length / 3;
      positions.push(0, bottomY * scale, 0);
      normals.push(0, -1, 0);
      uvs.push(0.5, 0.5);
      
      const bottomR = profile[0].outerR;
      for (let x = 0; x <= radialSegments; x++) {
        const theta = (x / radialSegments) * Math.PI * 2;
        let r = bottomR;
        if (profile[0].applyDeformations) {
          r = getOrganicRadius(r, 0, theta, true);
        }
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
