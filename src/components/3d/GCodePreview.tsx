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

// Color gradient for tilt angles: green (0°) -> yellow (15°) -> red (45°)
function getTiltColor(tiltAngle: number, maxAngle: number): THREE.Color {
  const normalized = Math.min(tiltAngle / maxAngle, 1);
  if (normalized < 0.5) {
    // Green to Yellow
    return new THREE.Color().setHSL(0.33 - normalized * 0.22, 0.9, 0.5);
  } else {
    // Yellow to Red
    return new THREE.Color().setHSL(0.11 - (normalized - 0.5) * 0.22, 0.9, 0.5);
  }
}

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

  // Generate geometry for planar layers (gray)
  const planarGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    
    layersToShow.forEach((layer) => {
      if (!layer || layer.isNonPlanar) return;
      
      layer.paths.forEach((path) => {
        for (let i = 0; i < path.length - 1; i++) {
          points.push(
            new THREE.Vector3(path[i].x * SCALE, layer.z * SCALE, path[i].y * SCALE),
            new THREE.Vector3(path[i + 1].x * SCALE, layer.z * SCALE, path[i + 1].y * SCALE)
          );
        }
      });
    });
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [layersToShow]);

  // Generate geometry for non-planar layers with Z-varying paths and colors
  const nonPlanarData = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const colors: number[] = [];
    const maxAngle = settings.nonPlanar?.maxZAngle || 30;
    
    layersToShow.forEach((layer) => {
      if (!layer || !layer.isNonPlanar) return;
      
      layer.paths.forEach((path, pathIdx) => {
        for (let i = 0; i < path.length - 1; i++) {
          const z1 = path[i].z !== undefined ? path[i].z : layer.z;
          const z2 = path[i + 1].z !== undefined ? path[i + 1].z : layer.z;
          
          points.push(
            new THREE.Vector3(path[i].x * SCALE, z1 * SCALE, path[i].y * SCALE),
            new THREE.Vector3(path[i + 1].x * SCALE, z2 * SCALE, path[i + 1].y * SCALE)
          );
          
          // Color based on tilt angle
          const tiltAngle = layer.tiltAngles?.[i] || 0;
          const color = getTiltColor(tiltAngle, maxAngle);
          colors.push(color.r, color.g, color.b);
          colors.push(color.r, color.g, color.b);
        }
      });
    });
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    if (colors.length > 0) {
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    
    return geometry;
  }, [layersToShow, settings.nonPlanar?.maxZAngle]);

  // Current layer highlight
  const currentLayerGeo = useMemo(() => {
    const layer = layers[Math.min(displayLayer, layers.length - 1)];
    if (!layer) return null;
    
    const points: THREE.Vector3[] = [];
    layer.paths.forEach((path) => {
      for (let i = 0; i < path.length - 1; i++) {
        // Use per-point Z for non-planar layers
        const z1 = path[i].z !== undefined ? path[i].z : layer.z;
        const z2 = path[i + 1].z !== undefined ? path[i + 1].z : layer.z;
        
        points.push(
          new THREE.Vector3(path[i].x * SCALE, z1 * SCALE, path[i].y * SCALE),
          new THREE.Vector3(path[i + 1].x * SCALE, z2 * SCALE, path[i + 1].y * SCALE)
        );
      }
    });
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [layers, displayLayer]);

  // Check if current layer is non-planar for styling
  const isCurrentLayerNonPlanar = layers[Math.min(displayLayer, layers.length - 1)]?.isNonPlanar;

  return (
    <group ref={groupRef} position={[0, -params.height * SCALE * 0.5, 0]}>
      {/* Previous planar layers (gray) */}
      {showAllLayers && (
        <lineSegments geometry={planarGeometry}>
          <lineBasicMaterial color="#94a3b8" opacity={0.4} transparent linewidth={1} />
        </lineSegments>
      )}
      
      {/* Non-planar layers with color gradient */}
      {showAllLayers && (
        <lineSegments geometry={nonPlanarData}>
          <lineBasicMaterial vertexColors opacity={0.7} transparent linewidth={1} />
        </lineSegments>
      )}
      
      {/* Current layer highlight */}
      {currentLayerGeo && (
        <lineSegments geometry={currentLayerGeo}>
          <lineBasicMaterial 
            color={isCurrentLayerNonPlanar ? "#22c55e" : "#3b82f6"} 
            linewidth={2} 
          />
        </lineSegments>
      )}
      
      {/* Nozzle indicator */}
      {animate && layers[displayLayer] && (
        <mesh position={[
          layers[displayLayer].paths[0]?.[0]?.x * SCALE || 0,
          (layers[displayLayer].paths[0]?.[0]?.z || layers[displayLayer].z) * SCALE + 0.02,
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
