import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LampParams, LampHardware, socketDimensions } from '@/types/lamp';

interface LampMeshProps {
  params: LampParams;
  hardware: LampHardware;
  showWireframe?: boolean;
  showMounting?: boolean;
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

const LampMesh = ({ params, hardware, showWireframe = false, showMounting = true }: LampMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const scale = 0.01;
  
  const socket = socketDimensions[hardware.socketType];
  
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
    
    const lampStyle = hardware.lampStyle;
    
    // Calculate total geometry height based on lamp style
    let bottomY = 0;
    let topY = height;
    
    if (showMounting) {
      switch (lampStyle) {
        case 'table':
          bottomY = -mounting.baseHeight;
          break;
        case 'floor':
          bottomY = -mounting.poleAdapterHeight;
          break;
        case 'pendant':
          topY = height + mounting.canopyHeight + 10;
          break;
        case 'clip_on':
          topY = height + 15;
          break;
      }
    }
    
    // Calculate the total height for segments
    const totalHeight = topY - bottomY;
    const heightSegments = Math.max(64, Math.ceil(totalHeight / 2));
    
    // Apply organic deformations to a radius at given height and angle
    const getOrganicRadius = (
      baseR: number, 
      t: number, 
      theta: number, 
      yPos: number,
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
      
      return Math.max(r, 5);
    };
    
    // Helper to get shade profile radius at normalized t (0-1 along shade height)
    const getShadeRadius = (t: number): number => {
      let radiusAtHeight = baseRadius + (topRadius - baseRadius) * t;
      
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
      isShade: boolean;
    }
    
    const profile: ProfilePoint[] = [];
    
    // Add mounting geometry to profile based on lamp style
    if (showMounting) {
      switch (lampStyle) {
        case 'table': {
          // Heavy organic base that mirrors shade profile
          const baseWidth = mounting.baseWidth / 2;
          const stemR = mounting.stemDiameter / 2;
          const cordHole = hardware.cordDiameter / 2 + 3;
          
          // Base bottom (inverted shade profile for organic feel)
          for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            const invertedT = 1 - t;
            // Use inverted shade profile for organic base
            let r = baseWidth * (0.9 + 0.1 * getShadeRadius(invertedT * 0.5) / baseRadius);
            // Smooth transition curve
            r *= smoothstep(0, 0.3, t) * 0.1 + 0.9;
            
            profile.push({
              y: -mounting.baseHeight + t * mounting.baseHeight * 0.6,
              outerR: r,
              innerR: cordHole,
              applyDeformations: true,
              isShade: false,
            });
          }
          
          // Stem transition - organic taper from base to shade
          for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            const stemY = -mounting.baseHeight * 0.4 + t * (mounting.baseHeight * 0.4 + 5);
            // Smooth organic taper
            const taperT = smoothstep(0, 1, t);
            const r = baseWidth * 0.4 * (1 - taperT) + stemR * 1.5 * taperT;
            
            profile.push({
              y: stemY,
              outerR: r,
              innerR: cordHole,
              applyDeformations: true,
              isShade: false,
            });
          }
          
          // Collar blending into shade base
          for (let i = 0; i <= 8; i++) {
            const t = i / 8;
            const collarY = 5 + t * 15;
            // Blend from stem to shade base radius
            const shadeBaseR = getShadeRadius(collarY / height);
            const blendT = smoothstep(0, 1, t);
            const r = stemR * 1.5 * (1 - blendT) + shadeBaseR * blendT;
            
            profile.push({
              y: collarY,
              outerR: r,
              innerR: t < 0.5 ? cordHole : 0,
              applyDeformations: true,
              isShade: t > 0.5,
            });
          }
          break;
        }
        
        case 'floor': {
          // Pole adapter with organic transition
          const adapterR = mounting.poleAdapterDiameter / 2;
          const poleHole = adapterR - 3;
          
          // Pole socket at bottom
          for (let i = 0; i <= 8; i++) {
            const t = i / 8;
            const y = -mounting.poleAdapterHeight + t * mounting.poleAdapterHeight * 0.7;
            const r = adapterR + 8 - t * 3;
            
            profile.push({
              y,
              outerR: r,
              innerR: poleHole,
              applyDeformations: false,
              isShade: false,
            });
          }
          
          // Organic transition collar
          for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            const y = -mounting.poleAdapterHeight * 0.3 + t * (mounting.poleAdapterHeight * 0.3 + 10);
            const transitionR = (adapterR + 5) * (1 - smoothstep(0, 1, t)) + 
                               getShadeRadius(0) * 0.6 * smoothstep(0, 1, t);
            
            profile.push({
              y,
              outerR: transitionR,
              innerR: t < 0.7 ? poleHole : 0,
              applyDeformations: true,
              isShade: false,
            });
          }
          break;
        }
        
        case 'pendant':
        case 'clip_on':
          // These add geometry at the top, handled after shade
          break;
      }
    }
    
    // Main shade body
    const shadeStartIdx = profile.length;
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const y = t * height;
      
      // Skip if we already have profile points below shade
      if (profile.length > 0 && y < profile[profile.length - 1].y + 1) continue;
      
      const shadeR = getShadeRadius(t);
      const isInSocketHole = y > params.socketMountingHeight - 5;
      
      let innerR = shadeR - wallThickness;
      if (isInSocketHole) {
        innerR = Math.min(innerR, socketHoleDiameter / 2);
      }
      
      profile.push({
        y,
        outerR: shadeR,
        innerR: innerR,
        applyDeformations: true,
        isShade: true,
      });
    }
    
    // Add top mounting geometry
    if (showMounting) {
      switch (lampStyle) {
        case 'pendant': {
          const cordHole = mounting.cordChannelDiameter / 2;
          const canopyR = mounting.canopyDiameter / 2;
          
          // Socket collar extending from top
          const topShadeR = getShadeRadius(1);
          for (let i = 1; i <= 8; i++) {
            const t = i / 8;
            const y = height + t * 8;
            // Organic collar that tapers
            const collarR = topShadeR * (1 - t * 0.3);
            
            profile.push({
              y,
              outerR: collarR,
              innerR: socket.outerDiameter / 2 + 2,
              applyDeformations: true,
              isShade: false,
            });
          }
          
          // Cord channel stem
          for (let i = 1; i <= 6; i++) {
            const t = i / 6;
            const y = height + 8 + t * 5;
            
            profile.push({
              y,
              outerR: cordHole + 4,
              innerR: cordHole,
              applyDeformations: false,
              isShade: false,
            });
          }
          
          // Canopy disc with organic profile
          for (let i = 1; i <= 10; i++) {
            const t = i / 10;
            const y = height + 13 + t * mounting.canopyHeight;
            // Canopy has inverted organic curve
            const canopyT = Math.sin(t * Math.PI);
            const r = (cordHole + 4) * (1 - t * 0.3) + canopyR * canopyT * 0.8;
            
            profile.push({
              y,
              outerR: Math.max(r, cordHole + 5),
              innerR: cordHole,
              applyDeformations: true,
              isShade: false,
            });
          }
          break;
        }
        
        case 'clip_on': {
          const topShadeR = getShadeRadius(1);
          
          // Clip rim that follows shade curve
          for (let i = 1; i <= 10; i++) {
            const t = i / 10;
            const y = height + t * 15;
            // Clip curves inward then has a lip
            const clipT = t < 0.6 ? t / 0.6 : 1 - (t - 0.6) / 0.4;
            const r = topShadeR * (1 + lipFlare * 0.5) - t * 5 + 
                     mounting.clipDepth * Math.sin(clipT * Math.PI);
            
            profile.push({
              y,
              outerR: r,
              innerR: r - mounting.clipWidth * 0.3,
              applyDeformations: true,
              isShade: false,
            });
          }
          break;
        }
      }
    }
    
    // Build vertices from profile
    const twistRate = (twistAngle * Math.PI / 180) / height;
    
    for (let layer = 0; layer <= 1; layer++) {
      const isInner = layer === 1;
      
      for (let p = 0; p < profile.length; p++) {
        const point = profile[p];
        const t = point.y / height;
        const twistAtHeight = twistRate * point.y;
        
        for (let x = 0; x <= radialSegments; x++) {
          const theta = (x / radialSegments) * Math.PI * 2 + twistAtHeight;
          
          let r = isInner ? point.innerR : point.outerR;
          
          // Apply organic deformations
          if (point.applyDeformations) {
            r = getOrganicRadius(r, t, theta, point.y, true);
          }
          
          // Handle ventilation slots on shade
          if (point.isShade && ventilationSlots && t > 0.7) {
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
          
          uvs.push(x / radialSegments, point.y / totalHeight);
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
      // Only create inner faces where there's actual inner radius
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
    
    // Bottom cap
    if (profile[0].innerR <= 0 || baseThickness > 0) {
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
          r = getOrganicRadius(r, 0, theta, bottomY, true);
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
  }, [params, hardware, socket, scale, showMounting]);
  
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
