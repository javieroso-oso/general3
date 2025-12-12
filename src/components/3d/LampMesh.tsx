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
    const isTable = lampStyle === 'table';
    const isFloor = lampStyle === 'floor';
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
      
      return Math.max(r, 5);
    };
    
    // Helper to get shade profile radius at normalized t (0-1 along shade height)
    const getShadeRadius = (t: number): number => {
      let radiusAtHeight = baseRadius + (topRadius - baseRadius) * t;
      
      // Style-specific profile modifications
      if (isTableOrFloor) {
        // Table/floor: classic empire shade shape - wider at bottom, narrower at top
        const empireShape = 1 + 0.15 * Math.pow(1 - t, 2);
        radiusAtHeight *= empireShape;
      } else if (isPendant) {
        // Pendant: narrower at top where it hangs, wider bottom
        const pendantTaper = 1 - 0.1 * t * t;
        radiusAtHeight *= pendantTaper;
      } else if (isClipOn) {
        // Clip-on: small conical shade
        radiusAtHeight = baseRadius * 0.7 * (1 - t * 0.3);
      } else if (isWallSconce) {
        // Wall sconce: dome shape
        const domeShape = Math.sin(t * Math.PI * 0.8 + 0.2);
        radiusAtHeight = baseRadius * 0.9 * (0.4 + domeShape * 0.6);
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
      
      // Lip flare at top (not for wall sconce)
      if (!isWallSconce && t > 1 - lipHeight) {
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
    
    // ============================================
    // TABLE/FLOOR LAMP: Add base and stem FIRST
    // ============================================
    if (isTable) {
      // Table lamp base platform
      const baseHeight = mounting.baseHeight;
      const baseWidth = mounting.baseWidth / 2; // radius
      const stemDiameter = mounting.stemDiameter;
      const stemHeight = mounting.stemHeight;
      
      // Base platform - bottom
      profile.push({
        y: 0,
        outerR: baseWidth,
        innerR: 0, // Solid base
        applyDeformations: false,
      });
      
      // Base platform - top edge
      profile.push({
        y: baseHeight * 0.8,
        outerR: baseWidth,
        innerR: 0,
        applyDeformations: false,
      });
      
      // Transition to stem
      profile.push({
        y: baseHeight,
        outerR: stemDiameter / 2 + 10,
        innerR: 0,
        applyDeformations: false,
      });
      
      // Stem - runs up to shade
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const y = baseHeight + t * stemHeight;
        profile.push({
          y,
          outerR: stemDiameter / 2,
          innerR: cordHoleRadius, // Hollow for cord
          applyDeformations: false,
        });
      }
      
      // Socket mounting collar at top of stem
      const collarBottom = baseHeight + stemHeight;
      const collarHeight = socket.collarHeight + 5;
      
      profile.push({
        y: collarBottom,
        outerR: socket.outerDiameter / 2 + 8,
        innerR: socket.threadDiameter / 2,
        applyDeformations: false,
      });
      profile.push({
        y: collarBottom + collarHeight * 0.5,
        outerR: socket.outerDiameter / 2 + 10,
        innerR: socket.threadDiameter / 2,
        applyDeformations: false,
      });
      profile.push({
        y: collarBottom + collarHeight,
        outerR: socket.outerDiameter / 2 + 6,
        innerR: socket.outerDiameter / 2,
        applyDeformations: false,
      });
      
      // Shade attached above collar - shade starts here
      const shadeStart = collarBottom + collarHeight + 5;
      
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = shadeStart + t * height;
        const shadeR = getShadeRadius(t);
        const innerR = shadeR - wallThickness;
        
        profile.push({
          y,
          outerR: shadeR,
          innerR: Math.max(innerR, 5),
          applyDeformations: true,
        });
      }
    }
    // ============================================
    // FLOOR LAMP: Pole adapter at bottom
    // ============================================
    else if (isFloor) {
      const adapterHeight = mounting.poleAdapterHeight;
      const adapterDiameter = mounting.poleAdapterDiameter;
      
      // Pole adapter bottom
      profile.push({
        y: 0,
        outerR: adapterDiameter / 2 + 5,
        innerR: adapterDiameter / 2, // Fits over pole
        applyDeformations: false,
      });
      
      // Adapter body
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        profile.push({
          y: t * adapterHeight * 0.8,
          outerR: adapterDiameter / 2 + 5,
          innerR: adapterDiameter / 2,
          applyDeformations: false,
        });
      }
      
      // Transition flare
      profile.push({
        y: adapterHeight,
        outerR: adapterDiameter / 2 + 15,
        innerR: adapterDiameter / 2,
        applyDeformations: false,
      });
      
      // Socket collar
      const collarStart = adapterHeight + 5;
      profile.push({
        y: collarStart,
        outerR: socket.outerDiameter / 2 + 10,
        innerR: socket.threadDiameter / 2,
        applyDeformations: false,
      });
      profile.push({
        y: collarStart + socket.collarHeight,
        outerR: socket.outerDiameter / 2 + 8,
        innerR: socket.outerDiameter / 2,
        applyDeformations: false,
      });
      
      // Shade
      const shadeStart = collarStart + socket.collarHeight + 5;
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = shadeStart + t * height;
        const shadeR = getShadeRadius(t);
        const innerR = shadeR - wallThickness;
        
        profile.push({
          y,
          outerR: shadeR,
          innerR: Math.max(innerR, 5),
          applyDeformations: true,
        });
      }
    }
    // ============================================
    // WALL SCONCE: Half-dome with backplate
    // ============================================
    else if (isWallSconce) {
      const backplateWidth = mounting.backplateWidth / 2;
      const backplateHeight = mounting.backplateHeight;
      const armLength = mounting.armLength;
      const backplateThickness = 8;
      
      // Backplate - flat against wall (Z will be constrained in vertex generation)
      profile.push({
        y: 0,
        outerR: backplateWidth,
        innerR: 0,
        applyDeformations: false,
      });
      profile.push({
        y: backplateThickness,
        outerR: backplateWidth,
        innerR: 0,
        applyDeformations: false,
      });
      
      // Transition arm from backplate to shade
      const armStart = backplateHeight * 0.3;
      profile.push({
        y: armStart,
        outerR: 20,
        innerR: cordHoleRadius,
        applyDeformations: false,
      });
      profile.push({
        y: armStart + armLength * 0.5,
        outerR: 18,
        innerR: cordHoleRadius,
        applyDeformations: false,
      });
      profile.push({
        y: armStart + armLength,
        outerR: 20,
        innerR: cordHoleRadius,
        applyDeformations: false,
      });
      
      // Socket collar
      const collarStart = armStart + armLength + 5;
      profile.push({
        y: collarStart,
        outerR: socket.outerDiameter / 2 + 8,
        innerR: socket.threadDiameter / 2,
        applyDeformations: false,
      });
      
      // Half-dome shade (only front hemisphere rendered later)
      const shadeStart = collarStart + socket.collarHeight;
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = shadeStart + t * height * 0.7; // Shorter dome
        const shadeR = getShadeRadius(t);
        const innerR = shadeR - wallThickness;
        
        profile.push({
          y,
          outerR: shadeR,
          innerR: Math.max(innerR, 5),
          applyDeformations: true,
        });
      }
    }
    // ============================================
    // CLIP-ON: Shade + separate spring arms
    // ============================================
    else if (isClipOn) {
      // Small conical shade first
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * height * 0.6; // Shorter shade
        const shadeR = getShadeRadius(t);
        const innerR = shadeR - wallThickness;
        
        profile.push({
          y,
          outerR: shadeR,
          innerR: Math.max(innerR, socketHoleDiameter / 2),
          applyDeformations: true,
        });
      }
      
      // Rim at top of shade
      const shadeTopY = height * 0.6;
      const shadeTopR = getShadeRadius(1);
      profile.push({
        y: shadeTopY + 2,
        outerR: shadeTopR + 3,
        innerR: shadeTopR - wallThickness,
        applyDeformations: false,
      });
      
      // Socket collar integrated at top
      profile.push({
        y: shadeTopY + 5,
        outerR: socket.outerDiameter / 2 + 12,
        innerR: socket.threadDiameter / 2,
        applyDeformations: false,
      });
      profile.push({
        y: shadeTopY + 5 + socket.collarHeight,
        outerR: socket.outerDiameter / 2 + 8,
        innerR: socket.outerDiameter / 2,
        applyDeformations: false,
      });
      
      // Spring arm base (ring around socket)
      const armBaseY = shadeTopY + 5 + socket.collarHeight + 3;
      profile.push({
        y: armBaseY,
        outerR: socket.outerDiameter / 2 + 15,
        innerR: socket.outerDiameter / 2 + 2,
        applyDeformations: false,
      });
      
      // Spring arms going UP and curving inward
      const clipArmLength = 50;
      const bulbGripRadius = 15; // Where arms grip the bulb
      
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        const y = armBaseY + t * clipArmLength;
        // Curve inward toward bulb
        const inwardCurve = Math.pow(t, 1.5);
        const armR = (socket.outerDiameter / 2 + 15) * (1 - inwardCurve * 0.6) + bulbGripRadius * inwardCurve;
        
        profile.push({
          y,
          outerR: armR + 4, // Thick arms
          innerR: Math.max(armR - 2, 8),
          applyDeformations: false,
        });
      }
      
      // Spring tip - curves in to grip
      for (let i = 1; i <= 5; i++) {
        const t = i / 5;
        const y = armBaseY + clipArmLength + t * 15;
        const tipR = bulbGripRadius * (1 - t * 0.4);
        
        profile.push({
          y,
          outerR: tipR + 5,
          innerR: Math.max(tipR, 5),
          applyDeformations: false,
        });
      }
    }
    // ============================================
    // PENDANT: Standard shade with collar
    // ============================================
    else {
      // Main shade body
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * height;
        
        const shadeR = getShadeRadius(t);
        let innerR = shadeR - wallThickness;
        
        // Socket lip near top
        const socketLipStart = params.socketMountingHeight - socket.collarHeight;
        const socketLipEnd = params.socketMountingHeight;
        
        if (y >= socketLipStart && y <= socketLipEnd) {
          const lipProgress = (y - socketLipStart) / (socketLipEnd - socketLipStart);
          const lipThickness = 3;
          innerR = Math.min(innerR, socketHoleDiameter / 2 + lipThickness * (1 - smoothstep(0.3, 0.8, lipProgress)));
        } else if (y > socketLipEnd) {
          innerR = Math.min(innerR, socketHoleDiameter / 2);
        }
        
        profile.push({
          y,
          outerR: shadeR,
          innerR: Math.max(innerR, 3),
          applyDeformations: true,
        });
      }
      
      // Pendant collar at top
      const topShadeR = getShadeRadius(1);
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const y = height + t * 15;
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