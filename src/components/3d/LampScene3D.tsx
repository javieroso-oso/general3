import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import LampMesh from './LampMesh';
import SocketMesh from './SocketMesh';
import BulbMesh from './BulbMesh';
import { LampParams, LampHardware } from '@/types/lamp';

interface LampScene3DProps {
  params: LampParams;
  hardware: LampHardware;
  showWireframe?: boolean;
  showSocket?: boolean;
  showBulb?: boolean;
  showHeatZone?: boolean;
}

const LampScene3D = ({
  params,
  hardware,
  showWireframe = false,
  showSocket = true,
  showBulb = true,
  showHeatZone = true,
}: LampScene3DProps) => {
  return (
    <Canvas
      camera={{ position: [3, 2, 3], fov: 45 }}
      className="w-full h-full"
      style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' }}
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />
        
        {/* Environment for reflections */}
        <Environment preset="studio" />
        
        {/* Print bed grid */}
        <Grid
          position={[0, 0, 0]}
          args={[4, 4]}
          cellSize={0.1}
          cellThickness={0.5}
          cellColor="#334155"
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor="#475569"
          fadeDistance={10}
          fadeStrength={1}
          followCamera={false}
        />
        
        {/* Lamp shade */}
        <LampMesh
          params={params}
          hardware={hardware}
          showWireframe={showWireframe}
        />
        
        {/* Socket ghost visualization */}
        <SocketMesh
          socketType={hardware.socketType}
          mountingHeight={params.socketMountingHeight}
          visible={showSocket}
        />
        
        {/* Bulb ghost visualization */}
        <BulbMesh
          bulbShape={hardware.bulbShape}
          socketType={hardware.socketType}
          mountingHeight={params.socketMountingHeight}
          wattage={hardware.bulbWattage}
          showHeatZone={showHeatZone}
          visible={showBulb}
        />
        
        {/* Cord path indicator */}
        {hardware.cordExit === 'top_hidden' && (
          <mesh position={[0, params.socketMountingHeight * 0.01 + 0.1, 0]}>
            <cylinderGeometry args={[hardware.cordDiameter * 0.005, hardware.cordDiameter * 0.005, 0.3, 8]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        )}
        
        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={10}
          target={[0, params.height * 0.005, 0]}
        />
      </Suspense>
    </Canvas>
  );
};

export default LampScene3D;
