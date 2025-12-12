import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { generateStandGeometry } from '@/lib/stand-generators';
import { StandParams } from '@/types/lamp';

interface StandMeshProps {
  params: {
    type: 'tripod' | 'pendant_cord' | 'wall_arm';
    socketType?: 'E26' | 'E27' | 'E12' | 'GU10' | 'G9' | 'LED_Strip';
    rimDiameter: number;  // Allow any number, not just StandardRimSize
    height: number;
    legCount?: 3 | 4;
    legSpread?: number;
    cordLength?: number;
    canopyDiameter?: number;
    armLength?: number;
    armAngle?: number;
    backplateSize?: number;
  };
  showWireframe?: boolean;
  visible?: boolean;
}

/**
 * StandMesh - Renders the printable stand structure
 * Tripod legs, pendant bracket, or wall arm with socket holder
 */
const StandMesh = ({ params, showWireframe = false, visible = true }: StandMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const scale = 0.01;
  
  // Rotate slowly (sync with shade)
  useFrame(({ clock }) => {
    const rotation = clock.elapsedTime * 0.15;
    if (meshRef.current) meshRef.current.rotation.y = rotation;
    if (wireframeRef.current) wireframeRef.current.rotation.y = rotation;
  });
  
  const { geometry, wireframeGeometry } = useMemo(() => {
    // Convert to full StandParams for the generator
    const fullParams: StandParams = params.type === 'tripod' 
      ? {
          type: 'tripod',
          socketType: params.socketType || 'E26',
          rimDiameter: (Math.round(params.rimDiameter / 50) * 50 || 150) as 100 | 150 | 200 | 250,
          height: params.height,
          wallThickness: 3,
          legCount: params.legCount || 3,
          legSpread: params.legSpread || 35,
          legThickness: 8,
          socketHolderHeight: 80,
        }
      : params.type === 'pendant_cord'
      ? {
          type: 'pendant_cord',
          socketType: params.socketType || 'E26',
          rimDiameter: (Math.round(params.rimDiameter / 50) * 50 || 150) as 100 | 150 | 200 | 250,
          height: params.height,
          wallThickness: 3,
          canopyDiameter: params.canopyDiameter || 80,
          canopyHeight: 25,
          cordLength: params.cordLength || 500,
        }
      : {
          type: 'wall_arm',
          socketType: params.socketType || 'E26',
          rimDiameter: (Math.round(params.rimDiameter / 50) * 50 || 150) as 100 | 150 | 200 | 250,
          height: params.height,
          wallThickness: 3,
          armLength: params.armLength || 200,
          armAngle: params.armAngle || 15,
          backplateWidth: params.backplateSize || 100,
          backplateHeight: 140,
        };
    
    const standGeo = generateStandGeometry(fullParams);
    
    // Scale geometry
    standGeo.scale(scale, scale, scale);
    
    // Wireframe
    const wireGeo = new THREE.WireframeGeometry(standGeo);
    
    return { geometry: standGeo, wireframeGeometry: wireGeo };
  }, [params]);
  
  if (!visible) return null;
  
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
