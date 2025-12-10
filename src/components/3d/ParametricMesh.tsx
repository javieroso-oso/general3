import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParametricParams, ObjectType } from '@/types/parametric';

interface ParametricMeshProps {
  params: ParametricParams;
  type: ObjectType;
}

const ParametricMesh = ({ params, type }: ParametricMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const { height, baseRadius, topRadius, wobbleFrequency, twistAngle } = params;
    const segments = 64;
    const heightSegments = 64;

    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Generate parametric surface
    for (let i = 0; i <= heightSegments; i++) {
      const t = i / heightSegments;
      const y = (t - 0.5) * height;
      
      // Interpolate radius based on object type
      let radius: number;
      if (type === 'lamp') {
        // Lamp: narrow base, wide top
        radius = baseRadius + (topRadius - baseRadius) * Math.pow(t, 0.5);
      } else if (type === 'sculpture') {
        // Sculpture: organic shape
        const bulge = Math.sin(t * Math.PI) * 0.3;
        radius = baseRadius * (1 - t) + topRadius * t + bulge;
      } else {
        // Vase: classic shape with slight bulge
        const bulge = Math.sin(t * Math.PI) * 0.2;
        radius = baseRadius * (1 - t) + topRadius * t + bulge * baseRadius;
      }

      // Apply wobble
      const wobblePhase = t * Math.PI * 2 * wobbleFrequency;
      
      // Apply twist
      const twistRad = (twistAngle * Math.PI / 180) * t;

      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2 + twistRad;
        
        // Apply wobble to radius
        const wobbledRadius = radius + Math.sin(wobblePhase + theta * 2) * 0.05 * wobbleFrequency;
        
        const x = Math.cos(theta) * wobbledRadius;
        const z = Math.sin(theta) * wobbledRadius;

        vertices.push(x, y, z);

        // Calculate normals
        const nx = Math.cos(theta);
        const nz = Math.sin(theta);
        normals.push(nx, 0, nz);
      }
    }

    // Generate indices
    for (let i = 0; i < heightSegments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;

        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [params, type]);

  // Gentle rotation animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#9ca3af"
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default ParametricMesh;
