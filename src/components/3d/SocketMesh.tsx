import { useMemo } from 'react';
import * as THREE from 'three';
import { SocketType, socketDimensions } from '@/types/lamp';

interface SocketMeshProps {
  socketType: SocketType;
  mountingHeight: number;
  visible?: boolean;
}

const SocketMesh = ({ socketType, mountingHeight, visible = true }: SocketMeshProps) => {
  const socket = socketDimensions[socketType];
  const scale = 0.01; // Convert mm to scene units
  
  const geometry = useMemo(() => {
    const points: THREE.Vector2[] = [];
    
    // Create socket profile (lathe geometry)
    const outerR = socket.outerDiameter / 2;
    const innerR = socket.threadDiameter / 2;
    const collarH = socket.collarHeight;
    const totalH = socket.height;
    
    // Bottom of socket (threaded part)
    points.push(new THREE.Vector2(0, 0));
    points.push(new THREE.Vector2(innerR * 0.8, 0));
    points.push(new THREE.Vector2(innerR * 0.8, totalH - collarH));
    
    // Collar (wider top part)
    points.push(new THREE.Vector2(outerR, totalH - collarH));
    points.push(new THREE.Vector2(outerR, totalH));
    points.push(new THREE.Vector2(innerR, totalH));
    points.push(new THREE.Vector2(innerR, totalH - collarH * 0.5));
    
    // Inner cavity
    points.push(new THREE.Vector2(innerR * 0.3, totalH - collarH * 0.5));
    points.push(new THREE.Vector2(innerR * 0.3, collarH));
    points.push(new THREE.Vector2(0, collarH));
    
    const latheGeometry = new THREE.LatheGeometry(points, 24);
    latheGeometry.scale(scale, scale, scale);
    
    return latheGeometry;
  }, [socket, scale]);
  
  if (!visible) return null;
  
  return (
    <group position={[0, mountingHeight * scale - socket.height * scale, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#e67e22"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Socket base indicator ring */}
      <mesh position={[0, socket.height * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[socket.threadDiameter / 2 * scale * 0.8, socket.outerDiameter / 2 * scale, 24]} />
        <meshStandardMaterial color="#d35400" transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

export default SocketMesh;
