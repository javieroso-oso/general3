import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LampParams, LampHardware, socketDimensions } from '@/types/lamp';

interface LampMeshProps {
  params: LampParams;
  hardware: LampHardware;
  showWireframe?: boolean;
}

// Simple 3D noise function
const seededRandom = (x: number, y: number, z: number): number => {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719;
  return (Math.sin(dot) * 43758.5453) % 1;
};

const noise3D = (x: number, y: number, z: number): number => {
  const floorX = Math.floor(x);
  const floorY = Math.floor(y);
  const floorZ = Math.floor(z);
  const fracX = x - floorX;
  const fracY = y - floorY;
  const fracZ = z - floorZ;

  const v000 = seededRandom(floorX, floorY, floorZ);
  const v100 = seededRandom(floorX + 1, floorY, floorZ);
  const v010 = seededRandom(floorX, floorY + 1, floorZ);
  const v110 = seededRandom(floorX + 1, floorY + 1, floorZ);
  const v001 = seededRandom(floorX, floorY, floorZ + 1);
  const v101 = seededRandom(floorX + 1, floorY, floorZ + 1);
  const v011 = seededRandom(floorX, floorY + 1, floorZ + 1);
  const v111 = seededRandom(floorX + 1, floorY + 1, floorZ + 1);

  const i1 = v000 * (1 - fracX) + v100 * fracX;
  const i2 = v010 * (1 - fracX) + v110 * fracX;
  const i3 = v001 * (1 - fracX) + v101 * fracX;
  const i4 = v011 * (1 - fracX) + v111 * fracX;
  const j1 = i1 * (1 - fracY) + i2 * fracY;
  const j2 = i3 * (1 - fracY) + i4 * fracY;

  return j1 * (1 - fracZ) + j2 * fracZ;
};

const LampMesh = ({ params, hardware, showWireframe = false }: LampMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const scale = 0.01;
  
  const socket = socketDimensions[hardware.socketType];
  
  // Rotate slowly
  useFrame(({ clock }) => {
    const rotation = clock.elapsedTime * 0.15;
    if (meshRef.current) meshRef.current.rotation.y = rotation;
    if (wireframeRef.current) wireframeRef.current.rotation.y = rotation;
  });
  
  const { geometry, wireframeGeometry } = useMemo(() => {
    const heightSegments = 64;
    const radialSegments = 48;
    
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    const {
      height, baseRadius, topRadius, wallThickness,
      wobbleFrequency, wobbleAmplitude, twistAngle,
      bulgePosition, bulgeAmount, pinchAmount, asymmetry,
      rippleCount, rippleDepth, lipFlare, lipHeight,
      organicNoise, noiseScale, baseThickness, socketHoleDiameter,
      ventilationSlots, ventSlotCount, ventSlotWidth, ventSlotHeight,
    } = params;
    
    // Build vertices for outer and inner shells
    for (let layer = 0; layer <= 1; layer++) {
      const isInner = layer === 1;
      const wallOffset = isInner ? -wallThickness : 0;
      
      for (let y = 0; y <= heightSegments; y++) {
        const t = y / heightSegments;
        const yPos = t * height;
        
        // Check if we're in the top socket hole area
        const isInSocketHole = yPos > params.socketMountingHeight - 5;
        
        // Base radius interpolation
        let radiusAtHeight = baseRadius + (topRadius - baseRadius) * t;
        
        // Bulge
        const bulgeT = 1 - Math.abs(t - bulgePosition) * 2;
        if (bulgeT > 0) {
          radiusAtHeight *= 1 + bulgeAmount * Math.pow(bulgeT, 2);
        }
        
        // Pinch
        if (t < 0.3) {
          radiusAtHeight *= 1 - pinchAmount * (1 - t / 0.3);
        }
        
        // Lip flare at top
        if (t > 1 - lipHeight) {
          const lipT = (t - (1 - lipHeight)) / lipHeight;
          radiusAtHeight *= 1 + lipFlare * Math.pow(lipT, 0.5);
        }
        
        // Twist
        const twistAtHeight = (twistAngle * Math.PI / 180) * t;
        
        for (let x = 0; x <= radialSegments; x++) {
          const theta = (x / radialSegments) * Math.PI * 2 + twistAtHeight;
          
          let r = radiusAtHeight + wallOffset;
          
          // Socket hole cutout at top
          if (isInSocketHole && !isInner) {
            const holeRadius = socketHoleDiameter / 2;
            if (r > holeRadius) {
              r = Math.max(r, holeRadius + wallThickness);
            }
          }
          
          // Wobble
          if (wobbleFrequency > 0) {
            r += Math.sin(theta * wobbleFrequency + t * Math.PI * 2) * wobbleAmplitude * baseRadius;
          }
          
          // Asymmetry
          if (asymmetry > 0) {
            r += Math.cos(theta) * asymmetry * baseRadius * (1 - t);
          }
          
          // Ripples
          if (rippleCount > 0) {
            r += Math.sin(t * rippleCount * Math.PI) * rippleDepth * baseRadius;
          }
          
          // Organic noise
          if (organicNoise > 0) {
            const nx = Math.cos(theta) * noiseScale;
            const ny = t * noiseScale * 3;
            const nz = Math.sin(theta) * noiseScale;
            r += (noise3D(nx, ny, nz) - 0.5) * organicNoise * baseRadius;
          }
          
          // Ventilation slots
          if (ventilationSlots && t > 0.7) {
            const slotAngle = (Math.PI * 2) / ventSlotCount;
            const nearSlot = Math.abs(((theta % slotAngle) - slotAngle / 2)) < (ventSlotWidth / radiusAtHeight / 2);
            if (nearSlot && yPos > height - ventSlotHeight - 10) {
              // Cut through for ventilation
              if (!isInner) {
                r = radiusAtHeight - wallThickness * 0.8;
              }
            }
          }
          
          // Ensure minimum radius
          r = Math.max(r, 5);
          
          const posX = Math.cos(theta) * r;
          const posZ = Math.sin(theta) * r;
          
          positions.push(posX * scale, yPos * scale, posZ * scale);
          
          // Simple normal calculation
          const nx = Math.cos(theta);
          const nz = Math.sin(theta);
          normals.push(isInner ? -nx : nx, 0, isInner ? -nz : nz);
          
          uvs.push(x / radialSegments, t);
        }
      }
    }
    
    // Build indices for outer shell
    const verticesPerRing = radialSegments + 1;
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < radialSegments; x++) {
        const a = y * verticesPerRing + x;
        const b = a + 1;
        const c = (y + 1) * verticesPerRing + x;
        const d = c + 1;
        
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    
    // Inner shell indices (reversed winding)
    const innerOffset = (heightSegments + 1) * verticesPerRing;
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < radialSegments; x++) {
        const a = innerOffset + y * verticesPerRing + x;
        const b = a + 1;
        const c = innerOffset + (y + 1) * verticesPerRing + x;
        const d = c + 1;
        
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
    
    // Connect top rim
    const outerTopStart = heightSegments * verticesPerRing;
    const innerTopStart = innerOffset + heightSegments * verticesPerRing;
    for (let x = 0; x < radialSegments; x++) {
      const a = outerTopStart + x;
      const b = outerTopStart + x + 1;
      const c = innerTopStart + x;
      const d = innerTopStart + x + 1;
      
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
    
    // Base (if has thickness)
    if (baseThickness > 0) {
      const baseY = 0;
      const baseCenterIdx = positions.length / 3;
      positions.push(0, baseY, 0);
      normals.push(0, -1, 0);
      uvs.push(0.5, 0.5);
      
      for (let x = 0; x <= radialSegments; x++) {
        const theta = (x / radialSegments) * Math.PI * 2;
        const r = baseRadius * scale;
        positions.push(Math.cos(theta) * r, baseY, Math.sin(theta) * r);
        normals.push(0, -1, 0);
        uvs.push(Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5);
      }
      
      for (let x = 0; x < radialSegments; x++) {
        indices.push(baseCenterIdx, baseCenterIdx + x + 2, baseCenterIdx + x + 1);
      }
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    
    const wireGeo = new THREE.WireframeGeometry(geo);
    
    return { geometry: geo, wireframeGeometry: wireGeo };
  }, [params, hardware, socket, scale]);
  
  return (
    <group>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#f0f0f0"
          roughness={0.3}
          metalness={0.1}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {showWireframe && (
        <lineSegments ref={wireframeRef} geometry={wireframeGeometry}>
          <lineBasicMaterial color="#0066ff" transparent opacity={0.3} />
        </lineSegments>
      )}
    </group>
  );
};

export default LampMesh;
