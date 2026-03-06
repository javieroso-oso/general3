import { useMemo } from 'react';
import * as THREE from 'three';
import { generateMultiPartMoldGeometry } from '@/lib/mold-generator';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { getBodyRadius } from '@/lib/body-profile-generator';

const SCALE = 0.01;

// Default mold colors palette
const DEFAULT_MOLD_COLORS = [
  '#C97B5D',  // Part A - Terracotta
  '#7B9E87',  // Part B - Sage Green  
  '#8B7EC7',  // Part C - Lavender
  '#CBA670',  // Part D - Mustard
];

interface MoldMeshProps {
  params: ParametricParams;
  type: ObjectType;
  showWireframe?: boolean;
}

const MoldMesh = ({ params, type, showWireframe = false }: MoldMeshProps) => {
  const { parts, gap, showGhostBody, partCount, colors } = useMemo(() => {
    const partCount = params.moldPartCount || 2;
    const moldGeometry = generateMultiPartMoldGeometry(params);
    const colors = params.moldColors?.length >= partCount 
      ? params.moldColors 
      : DEFAULT_MOLD_COLORS;
    
    return { 
      parts: moldGeometry.parts,
      gap: params.moldGap * SCALE,
      showGhostBody: params.moldShowGhostBody ?? true,
      partCount,
      colors
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
          objectType: 'vase',
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

  // Create materials for each mold part
  const moldMaterials = useMemo(() => {
    return colors.slice(0, partCount).map((color, index) => {
      // Alternate opacity slightly for visual distinction
      const opacity = 0.85 - (index % 2) * 0.05;
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
      });
    });
  }, [colors, partCount]);

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

  // Calculate body center for positioning
  const bodyHeight = params.height * SCALE;
  const centerY = bodyHeight / 2;

  // Calculate part positions for preview gap
  // Parts are spread radially outward based on their angular position
  const getPartOffset = (partIndex: number): [number, number, number] => {
    const anglePerPart = (Math.PI * 2) / partCount;
    const partCenterAngle = anglePerPart * partIndex + anglePerPart / 2 + (params.moldSplitAngle * Math.PI / 180);
    
    // Offset each part outward from center
    const offsetX = Math.cos(partCenterAngle) * (gap / 2);
    const offsetZ = Math.sin(partCenterAngle) * (gap / 2);
    
    return [offsetX, 0, offsetZ];
  };

  return (
    <group position={[0, -centerY, 0]}>
      {/* Render each mold part */}
      {parts.map((partGeometry, index) => {
        const [offsetX, offsetY, offsetZ] = getPartOffset(index);
        const material = moldMaterials[index] || moldMaterials[0];
        
        return (
          <group key={index} position={[offsetX, offsetY, offsetZ]}>
            <mesh geometry={partGeometry} material={material} />
            {showWireframe && <mesh geometry={partGeometry} material={wireframeMaterial} />}
          </group>
        );
      })}

      {/* Ghost body preview - shows the body shape inside the mold */}
      {showGhostBody && ghostBodyGeometry && (
        <group>
          <mesh geometry={ghostBodyGeometry} material={ghostMaterial} />
          <mesh geometry={ghostBodyGeometry} material={ghostWireframeMaterial} />
        </group>
      )}

      {/* Pour hole indicator - 3D tapered cylinder showing actual hole */}
      {(() => {
        const topWallThickness = params.moldWallThickness * SCALE;
        const moldTopY = bodyHeight + topWallThickness;
        const pourHoleDepth = (params.moldWallThickness + 10) * SCALE;
        const topRadius = (params.moldPourHoleDiameter / 2) * SCALE * 1.3;
        const bottomRadius = (params.moldPourHoleDiameter / 2) * SCALE;
        return (
          <mesh position={[0, moldTopY - pourHoleDepth / 2 + 0.01, 0]}>
            <cylinderGeometry args={[topRadius, bottomRadius, pourHoleDepth, 24]} />
            <meshBasicMaterial 
              color="#E67E22" 
              transparent 
              opacity={0.4} 
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })()}
    </group>
  );
};

export default MoldMesh;
