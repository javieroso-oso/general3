import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LampParams } from '@/types/lamp';

interface ShadeMeshProps {
  params: LampParams;
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

/**
 * ShadeMesh - Akari-style purely decorative shade
 * No mounting hardware geometry - just the organic shell with a simple rim
 */
const ShadeMesh = ({ params, showWireframe = false }: ShadeMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const scale = 0.01;
  
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
      organicNoise,
      shade,
    } = params;
    
    const rimRadius = shade.rimDiameter / 2;
    const rimLipHeight = shade.rimLipHeight;
    const rimThickness = shade.rimThickness;
    
    // Apply organic deformations
    const getOrganicRadius = (baseR: number, t: number, theta: number): number => {
      let r = baseR;
      
      // Wobble
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
        const nx = Math.cos(theta) * r * 10;
        const ny = t * 10;
        const nz = Math.sin(theta) * r * 10;
        r += noise3D(nx, ny, nz) * maxNoise * baseRadius;
      }
      
      return Math.max(r, 5);
    };
    
    // Get shade profile radius at normalized t (0-1)
    const getShadeRadius = (t: number): number => {
      // Base interpolation with organic curve
      const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
      let radiusAtHeight = baseRadius * (1 - t * 0.4) + topRadius * t * 0.6 + curve * baseRadius * 0.12;
      
      // Organic bulge
      const bulgeDist = Math.abs(t - bulgePosition);
      radiusAtHeight += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;
      
      // Pinch effect
      const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
      const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
      radiusAtHeight *= (1 - pinchTop - pinchBottom);
      
      // Lip flare at top
      const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
      radiusAtHeight += lipT * lipT * lipFlare * baseRadius;
      
      return Math.max(radiusAtHeight, 10);
    };
    
    // Build profile for shade
    interface ProfilePoint {
      y: number;
      outerR: number;
      innerR: number;
      applyDeformations: boolean;
    }
    
    const profile: ProfilePoint[] = [];
    const heightSegments = 64;
    
    // ============================================
    // SHADE BODY (organic decorative shell)
    // ============================================
    
    // Main shade body
    for (let i = 0; i <= heightSegments; i++) {
      const t = i / heightSegments;
      const y = t * height;
      const shadeR = getShadeRadius(t);
      const innerR = shadeR - wallThickness;
      
      profile.push({
        y,
        outerR: shadeR,
        innerR: Math.max(innerR, 5),
        applyDeformations: true,
      });
    }
    
    // ============================================
    // RIM LIP (for resting on stand)
    // Simple inward lip at bottom opening
    // ============================================
    if (rimLipHeight > 0) {
      const lipSteps = 4;
      const bottomR = getShadeRadius(0);
      
      for (let i = 1; i <= lipSteps; i++) {
        const t = i / lipSteps;
        const y = -rimLipHeight * t;
        
        // Lip curves inward toward rim diameter
        const lipProgress = t;
        const outerR = bottomR * (1 - lipProgress * 0.1);
        const targetInnerR = rimRadius - rimThickness;
        const innerR = (bottomR - wallThickness) * (1 - lipProgress) + targetInnerR * lipProgress;
        
        profile.unshift({
          y,
          outerR: Math.max(outerR, innerR + rimThickness),
          innerR: Math.max(innerR, rimRadius - rimThickness),
          applyDeformations: false,
        });
      }
    }
    
    // Build vertices from profile
    const twistRate = (twistAngle * Math.PI / 180) / height;
    const minY = profile[0].y;
    const maxY = profile[profile.length - 1].y;
    const totalHeight = maxY - minY;
    
    for (let layer = 0; layer <= 1; layer++) {
      const isInner = layer === 1;
      
      for (let p = 0; p < profile.length; p++) {
        const point = profile[p];
        const t = (point.y - minY) / totalHeight;
        const twistAtHeight = point.y > 0 ? twistRate * point.y : 0;
        
        for (let x = 0; x <= radialSegments; x++) {
          const theta = (x / radialSegments) * Math.PI * 2 + twistAtHeight;
          
          let r = isInner ? point.innerR : point.outerR;
          
          // Apply organic deformations only where flagged
          if (point.applyDeformations) {
            r = getOrganicRadius(r, t, theta);
          }
          
          r = Math.max(r, 3);
          
          const posX = Math.cos(theta) * r;
          const posZ = Math.sin(theta) * r;
          
          positions.push(posX * scale, point.y * scale, posZ * scale);
          
          const nx = Math.cos(theta);
          const nz = Math.sin(theta);
          normals.push(isInner ? -nx : nx, 0, isInner ? -nz : nz);
          
          uvs.push(x / radialSegments, t);
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
    
    // Connect top rim (top opening of shade)
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
    
    // Connect bottom rim (where shade rests on stand)
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
    
    // Create geometry
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    
    // Wireframe
    const wireGeo = new THREE.WireframeGeometry(geo);
    
    return { geometry: geo, wireframeGeometry: wireGeo };
  }, [params]);
  
  return (
    <group>
      {/* Solid mesh */}
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial 
          color="#f5f5f5"
          roughness={0.4}
          metalness={0.1}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Wireframe overlay */}
      {showWireframe && (
        <lineSegments ref={wireframeRef} geometry={wireframeGeometry}>
          <lineBasicMaterial color="#0066ff" opacity={0.6} transparent />
        </lineSegments>
      )}
    </group>
  );
};

export default ShadeMesh;
