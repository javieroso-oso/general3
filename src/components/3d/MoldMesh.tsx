import { useMemo } from 'react';
import * as THREE from 'three';
import { generateMoldGeometry } from '@/lib/mold-generator';
import { ParametricParams, ObjectType } from '@/types/parametric';

const SCALE = 0.01;

interface MoldMeshProps {
  params: ParametricParams;
  type: ObjectType;
  showWireframe?: boolean;
}

const MoldMesh = ({ params, type, showWireframe = false }: MoldMeshProps) => {
  const { halfA, halfB, gap } = useMemo(() => {
    const { halfA, halfB } = generateMoldGeometry(params, type);
    return { halfA, halfB, gap: params.moldGap * SCALE };
  }, [params, type]);

  // Material for mold halves
  const moldMaterialA = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8B7355'), // Plaster-like brown
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
  }, []);

  const moldMaterialB = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#A0917B'), // Slightly lighter brown
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
  }, []);

  const wireframeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#000000'),
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
  }, []);

  // Calculate body center for positioning
  const bodyHeight = params.height * SCALE;
  const centerY = bodyHeight / 2;

  return (
    <group position={[0, -centerY, 0]}>
      {/* Half A - offset to the left */}
      <group position={[-gap / 2, 0, 0]}>
        <mesh geometry={halfA} material={moldMaterialA} />
        {showWireframe && <mesh geometry={halfA} material={wireframeMaterial} />}
      </group>

      {/* Half B - offset to the right */}
      <group position={[gap / 2, 0, 0]}>
        <mesh geometry={halfB} material={moldMaterialB} />
        {showWireframe && <mesh geometry={halfB} material={wireframeMaterial} />}
      </group>
    </group>
  );
};

export default MoldMesh;
