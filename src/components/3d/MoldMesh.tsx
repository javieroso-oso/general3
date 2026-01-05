import { useMemo } from 'react';
import * as THREE from 'three';
import { generateMoldGeometry } from '@/lib/mold-generator';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { getBodyRadius, getMaxBodyRadius } from '@/lib/body-profile-generator';

const SCALE = 0.01;

interface MoldMeshProps {
  params: ParametricParams;
  type: ObjectType;
  showWireframe?: boolean;
}

const MoldMesh = ({ params, type, showWireframe = false }: MoldMeshProps) => {
  const { halfA, halfB, gap, showGhostBody } = useMemo(() => {
    const { halfA, halfB } = generateMoldGeometry(params, type);
    return { 
      halfA, 
      halfB, 
      gap: params.moldGap * SCALE,
      showGhostBody: params.moldShowGhostBody ?? true
    };
  }, [params, type]);

  // Generate ghost body geometry
  const ghostBodyGeometry = useMemo(() => {
    if (!showGhostBody) return null;
    
    const segments = 32;
    const rings = 48;
    const height = params.height * SCALE;
    
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const y = t * height;
      
      for (let j = 0; j <= segments; j++) {
        const u = j / segments;
        const theta = u * Math.PI * 2;
        
        const radius = getBodyRadius(params, t, theta, {
          scale: SCALE,
          objectType: type,
          includeTwist: true
        });
        
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        
        vertices.push(x, y, z);
        uvs.push(u, t);
      }
    }
    
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j;
        const b = a + segments + 1;
        const c = a + 1;
        const d = b + 1;
        
        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
  }, [params, type, showGhostBody]);

  // Material for mold halves - semi-transparent
  const moldMaterialA = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8B7355'),
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
  }, []);

  const moldMaterialB = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#A0917B'),
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
  }, []);

  // Ghost body material - wireframe with subtle fill
  const ghostMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4A90D9'),
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  const ghostWireframeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#2E5B8C'),
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
  }, []);

  const wireframeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#000000'),
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
  }, []);

  // Feature highlight material for registration keys
  const keyHighlightMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#D4A574'),
      roughness: 0.7,
      metalness: 0.1,
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

      {/* Ghost body preview - shows the body shape inside the mold */}
      {showGhostBody && ghostBodyGeometry && (
        <group>
          <mesh geometry={ghostBodyGeometry} material={ghostMaterial} />
          <mesh geometry={ghostBodyGeometry} material={ghostWireframeMaterial} />
        </group>
      )}

      {/* Pour hole indicator ring at top */}
      <mesh position={[0, bodyHeight + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          (params.moldPourHoleDiameter / 2 - 2) * SCALE,
          (params.moldPourHoleDiameter / 2) * SCALE,
          24
        ]} />
        <meshBasicMaterial color="#E67E22" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

export default MoldMesh;
