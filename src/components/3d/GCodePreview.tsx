import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParametricParams, ObjectType, PrintSettings } from '@/types/parametric';
import { generateGCodeLayers, GCodeLayer } from '@/lib/stl-export';

interface GCodePreviewProps {
  params: ParametricParams;
  type: ObjectType;
  settings: PrintSettings;
  currentLayer: number;
  showAllLayers: boolean;
  animate: boolean;
}

const SCALE = 0.01; // mm to scene units

const GCodePreview = ({ 
  params, 
  type, 
  settings, 
  currentLayer, 
  showAllLayers,
  animate 
}: GCodePreviewProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [animationLayer, setAnimationLayer] = useState(0);
  
  const layers = useMemo(() => 
    generateGCodeLayers(params, type, settings),
    [params, type, settings]
  );

  // Animation
  useFrame((state) => {
    if (animate && layers.length > 0) {
      const cycleTime = 10; // seconds for full print
      const progress = (state.clock.elapsedTime % cycleTime) / cycleTime;
      setAnimationLayer(Math.floor(progress * layers.length));
    }
    
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  const displayLayer = animate ? animationLayer : currentLayer;
  const layersToShow = showAllLayers 
    ? layers.slice(0, displayLayer + 1) 
    : [layers[Math.min(displayLayer, layers.length - 1)]];

  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    
    layersToShow.forEach((layer, layerIdx) => {
      if (!layer) return;
      
      layer.paths.forEach((path) => {
        for (let i = 0; i < path.length - 1; i++) {
          points.push(
            new THREE.Vector3(path[i].x * SCALE, layer.z * SCALE, path[i].y * SCALE),
            new THREE.Vector3(path[i + 1].x * SCALE, layer.z * SCALE, path[i + 1].y * SCALE)
          );
        }
      });
    });
    
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [layersToShow]);

  // Current layer highlight
  const currentLayerGeo = useMemo(() => {
    const layer = layers[Math.min(displayLayer, layers.length - 1)];
    if (!layer) return null;
    
    const points: THREE.Vector3[] = [];
    layer.paths.forEach((path) => {
      for (let i = 0; i < path.length - 1; i++) {
        points.push(
          new THREE.Vector3(path[i].x * SCALE, layer.z * SCALE, path[i].y * SCALE),
          new THREE.Vector3(path[i + 1].x * SCALE, layer.z * SCALE, path[i + 1].y * SCALE)
        );
      }
    });
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [layers, displayLayer]);

  return (
    <group ref={groupRef} position={[0, -params.height * SCALE * 0.5, 0]}>
      {/* Previous layers */}
      {showAllLayers && (
        <lineSegments geometry={geometry}>
          <lineBasicMaterial color="#94a3b8" opacity={0.4} transparent linewidth={1} />
        </lineSegments>
      )}
      
      {/* Current layer highlight */}
      {currentLayerGeo && (
        <lineSegments geometry={currentLayerGeo}>
          <lineBasicMaterial color="#3b82f6" linewidth={2} />
        </lineSegments>
      )}
      
      {/* Nozzle indicator */}
      {animate && layers[displayLayer] && (
        <mesh position={[
          layers[displayLayer].paths[0]?.[0]?.x * SCALE || 0,
          layers[displayLayer].z * SCALE + 0.02,
          layers[displayLayer].paths[0]?.[0]?.y * SCALE || 0
        ]}>
          <coneGeometry args={[0.03, 0.08, 8]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
};

export default GCodePreview;
