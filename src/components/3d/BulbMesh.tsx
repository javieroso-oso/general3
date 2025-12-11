import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BulbShape, SocketType, bulbDimensions, socketDimensions } from '@/types/lamp';

interface BulbMeshProps {
  bulbShape: BulbShape;
  socketType: SocketType;
  mountingHeight: number;
  wattage: number;
  showHeatZone?: boolean;
  visible?: boolean;
}

const BulbMesh = ({ 
  bulbShape, 
  socketType, 
  mountingHeight, 
  wattage,
  showHeatZone = true,
  visible = true 
}: BulbMeshProps) => {
  const bulb = bulbDimensions[bulbShape];
  const socket = socketDimensions[socketType];
  const scale = 0.01;
  const glowRef = useRef<THREE.PointLight>(null);
  const heatZoneRef = useRef<THREE.Mesh>(null);
  
  // Pulsing glow animation
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const pulse = Math.sin(clock.elapsedTime * 2) * 0.1 + 0.9;
      glowRef.current.intensity = wattage * 0.05 * pulse;
    }
    if (heatZoneRef.current) {
      const pulse = Math.sin(clock.elapsedTime * 1.5) * 0.1 + 0.2;
      (heatZoneRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  });
  
  const bulbGeometry = useMemo(() => {
    // Create bulb shape based on type
    const points: THREE.Vector2[] = [];
    const r = bulb.diameter / 2;
    const h = bulb.height;
    const neckR = bulb.neckDiameter / 2;
    
    switch (bulbShape) {
      case 'Globe':
        // Spherical bulb
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const angle = t * Math.PI;
          const x = Math.sin(angle) * r;
          const y = h * 0.2 + (1 - Math.cos(angle)) * r * 0.5;
          points.push(new THREE.Vector2(x, y));
        }
        // Neck
        points.push(new THREE.Vector2(neckR, h * 0.1));
        points.push(new THREE.Vector2(neckR * 0.8, 0));
        break;
        
      case 'Candle':
        // Flame-shaped
        points.push(new THREE.Vector2(0, h));
        points.push(new THREE.Vector2(r * 0.3, h * 0.85));
        points.push(new THREE.Vector2(r, h * 0.5));
        points.push(new THREE.Vector2(r * 0.8, h * 0.25));
        points.push(new THREE.Vector2(neckR, h * 0.15));
        points.push(new THREE.Vector2(neckR * 0.8, 0));
        break;
        
      case 'Edison':
        // Elongated vintage style
        points.push(new THREE.Vector2(0, h));
        points.push(new THREE.Vector2(r * 0.5, h * 0.9));
        points.push(new THREE.Vector2(r, h * 0.6));
        points.push(new THREE.Vector2(r, h * 0.35));
        points.push(new THREE.Vector2(r * 0.6, h * 0.2));
        points.push(new THREE.Vector2(neckR, h * 0.1));
        points.push(new THREE.Vector2(neckR * 0.8, 0));
        break;
        
      case 'Tube':
        // Cylindrical
        points.push(new THREE.Vector2(0, h));
        points.push(new THREE.Vector2(r * 0.8, h * 0.95));
        points.push(new THREE.Vector2(r, h * 0.85));
        points.push(new THREE.Vector2(r, h * 0.15));
        points.push(new THREE.Vector2(r * 0.8, h * 0.05));
        points.push(new THREE.Vector2(neckR, 0));
        break;
        
      case 'PAR30':
        // Parabolic reflector
        points.push(new THREE.Vector2(0, h));
        points.push(new THREE.Vector2(r, h * 0.95));
        points.push(new THREE.Vector2(r, h * 0.4));
        points.push(new THREE.Vector2(r * 0.5, h * 0.2));
        points.push(new THREE.Vector2(neckR, h * 0.1));
        points.push(new THREE.Vector2(neckR * 0.8, 0));
        break;
        
      case 'A19':
      case 'A21':
      default:
        // Classic A-shape
        points.push(new THREE.Vector2(0, h));
        points.push(new THREE.Vector2(r * 0.4, h * 0.92));
        points.push(new THREE.Vector2(r, h * 0.65));
        points.push(new THREE.Vector2(r * 0.95, h * 0.4));
        points.push(new THREE.Vector2(r * 0.6, h * 0.2));
        points.push(new THREE.Vector2(neckR, h * 0.1));
        points.push(new THREE.Vector2(neckR * 0.8, 0));
    }
    
    const latheGeometry = new THREE.LatheGeometry(points, 24);
    latheGeometry.scale(scale, scale, scale);
    
    return latheGeometry;
  }, [bulb, bulbShape, scale]);
  
  if (!visible) return null;
  
  // Position: socket mounting height - socket height - bulb hangs down
  const bulbY = mountingHeight * scale - socket.height * scale - bulb.height * scale;
  const bulbCenterY = bulbY + bulb.height * scale * 0.5;
  
  return (
    <group position={[0, bulbY, 0]}>
      {/* Bulb glass */}
      <mesh geometry={bulbGeometry}>
        <meshPhysicalMaterial
          color="#fff8e7"
          transparent
          opacity={0.4}
          roughness={0.1}
          transmission={0.6}
          thickness={0.5}
        />
      </mesh>
      
      {/* Inner glow */}
      <pointLight
        ref={glowRef}
        position={[0, bulb.height * scale * 0.5, 0]}
        color="#ffcc66"
        intensity={wattage * 0.05}
        distance={3}
        decay={2}
      />
      
      {/* Heat zone indicator */}
      {showHeatZone && wattage > 5 && (
        <mesh
          ref={heatZoneRef}
          position={[0, bulb.height * scale * 0.5, 0]}
        >
          <sphereGeometry args={[bulb.heatZoneRadius * scale, 16, 16]} />
          <meshBasicMaterial
            color={wattage > 15 ? '#ff4444' : '#ff8844'}
            transparent
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
};

export default BulbMesh;
