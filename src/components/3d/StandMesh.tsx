import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { generateParametricStandGeometry } from '@/lib/parametric-stand-generators';
import { ParametricStandParams } from '@/types/stand';

interface StandMeshProps {
  params: ParametricStandParams;
  showWireframe?: boolean;
}

/**
 * StandMesh - Renders the parametric stand with customizable leg shapes
 */
const StandMesh = ({ params, showWireframe = false }: StandMeshProps) => {
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
    if (!params.enabled) {
      return { geometry: new THREE.BufferGeometry(), wireframeGeometry: new THREE.BufferGeometry() };
    }
    
    const standGeo = generateParametricStandGeometry(params);
    
    // Scale geometry
    standGeo.scale(scale, scale, scale);
    
    // Wireframe
    const wireGeo = new THREE.WireframeGeometry(standGeo);
    
    return { geometry: standGeo, wireframeGeometry: wireGeo };
  }, [params]);
  
  if (!params.enabled) {
    return null;
  }
  
  return (
    <group>
      {/* Solid mesh */}
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial 
          color="#2a2a2a"
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      
      {/* Wireframe overlay */}
      {showWireframe && (
        <lineSegments ref={wireframeRef} geometry={wireframeGeometry}>
          <lineBasicMaterial color="#ff0080" opacity={0.6} transparent />
        </lineSegments>
      )}
    </group>
  );
};

export default StandMesh;
