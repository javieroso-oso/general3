import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParametricParams, ObjectType } from '@/types/parametric';

interface ParametricMeshProps {
  params: ParametricParams;
  type: ObjectType;
}

// Simple seeded random for consistent noise
const seededRandom = (x: number, y: number, z: number) => {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719;
  return (Math.sin(dot) * 43758.5453) % 1;
};

// 3D Simplex-like noise approximation
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
  
  // Smooth interpolation
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  
  // Sample corners
  const n000 = seededRandom(ix, iy, iz);
  const n100 = seededRandom(ix + 1, iy, iz);
  const n010 = seededRandom(ix, iy + 1, iz);
  const n110 = seededRandom(ix + 1, iy + 1, iz);
  const n001 = seededRandom(ix, iy, iz + 1);
  const n101 = seededRandom(ix + 1, iy, iz + 1);
  const n011 = seededRandom(ix, iy + 1, iz + 1);
  const n111 = seededRandom(ix + 1, iy + 1, iz + 1);
  
  // Trilinear interpolation
  const nx00 = n000 * (1 - ux) + n100 * ux;
  const nx10 = n010 * (1 - ux) + n110 * ux;
  const nx01 = n001 * (1 - ux) + n101 * ux;
  const nx11 = n011 * (1 - ux) + n111 * ux;
  
  const nxy0 = nx00 * (1 - uy) + nx10 * uy;
  const nxy1 = nx01 * (1 - uy) + nx11 * uy;
  
  return (nxy0 * (1 - uz) + nxy1 * uz) * 2 - 1;
};

const ParametricMesh = ({ params, type }: ParametricMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const {
      height,
      baseRadius,
      topRadius,
      wobbleFrequency,
      wobbleAmplitude,
      twistAngle,
      bulgePosition,
      bulgeAmount,
      pinchAmount,
      asymmetry,
      rippleCount,
      rippleDepth,
      lipFlare,
      lipHeight,
      organicNoise,
      noiseScale,
    } = params;

    const segments = 72;
    const heightSegments = 80;

    const vertices: number[] = [];
    const indices: number[] = [];

    // Generate parametric surface with organic clay-like deformations
    for (let i = 0; i <= heightSegments; i++) {
      const t = i / heightSegments; // 0 to 1 from bottom to top
      const y = (t - 0.5) * height;

      // Base radius interpolation with smooth easing
      let radius: number;
      
      if (type === 'lamp') {
        // Lamp: exponential curve from narrow base to wide top
        const eased = Math.pow(t, 0.6);
        radius = baseRadius + (topRadius - baseRadius) * eased;
      } else if (type === 'sculpture') {
        // Sculpture: more dramatic organic shape
        const sculptCurve = Math.sin(t * Math.PI);
        radius = baseRadius * (1 - t * 0.3) + topRadius * t * 0.7 + sculptCurve * 0.25;
      } else {
        // Vase: elegant curve
        const vaseCurve = Math.sin(t * Math.PI * 0.8 + 0.2);
        radius = baseRadius * (1 - t * 0.4) + topRadius * t * 0.6 + vaseCurve * 0.15;
      }

      // Apply organic bulge (clay belly)
      const bulgeDist = Math.abs(t - bulgePosition);
      const bulgeEffect = Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;
      radius += bulgeEffect;

      // Apply pinch effect (narrowing at extremes)
      const pinchTop = Math.pow(t, 3) * pinchAmount * 0.5;
      const pinchBottom = Math.pow(1 - t, 3) * pinchAmount * 0.3;
      radius *= (1 - pinchTop - pinchBottom);

      // Apply lip flare at top
      const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
      const lipEffect = lipT * lipT * lipFlare * baseRadius;
      radius += lipEffect;

      // Ensure minimum radius for printability
      radius = Math.max(radius, 0.1);

      // Twist angle at this height
      const twistRad = (twistAngle * Math.PI / 180) * t;

      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2 + twistRad;

        // Start with base radius
        let r = radius;

        // Apply wobble (like finger impressions in clay)
        if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
          const wobblePhase = t * Math.PI * 2 * wobbleFrequency;
          r += Math.sin(wobblePhase + theta * 2) * wobbleAmplitude * baseRadius;
        }

        // Apply vertical ripples (like wheel-thrown pottery)
        if (rippleCount > 0 && rippleDepth > 0) {
          r += Math.sin(theta * rippleCount) * rippleDepth * baseRadius;
        }

        // Apply asymmetry (organic imperfection)
        if (asymmetry > 0) {
          const asymOffset = Math.sin(theta) * Math.cos(t * Math.PI * 2) * asymmetry * baseRadius;
          r += asymOffset;
        }

        // Apply organic noise (clay texture)
        if (organicNoise > 0) {
          const nx = Math.cos(theta) * r;
          const nz = Math.sin(theta) * r;
          const noiseVal = noise3D(nx, y, nz, noiseScale);
          r += noiseVal * organicNoise * baseRadius;
        }

        // Ensure minimum radius for print integrity
        r = Math.max(r, 0.08);

        // Calculate position
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;

        vertices.push(x, y, z);
      }
    }

    // Generate indices for triangles
    for (let i = 0; i < heightSegments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;

        // Two triangles per quad
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [params, type]);

  // Gentle rotation animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#a8a29e"
        roughness={0.55}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default ParametricMesh;
