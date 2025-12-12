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
  previewInstalled?: boolean;
}

// Get rotation for installed view based on lamp style
const getInstalledRotation = (lampStyle: string): [number, number, number] => {
  switch (lampStyle) {
    case 'pendant':
      return [Math.PI, 0, 0]; // Flip 180° - opening faces down
    case 'wall_sconce':
      return [-Math.PI / 2, 0, 0]; // Rotate 90° on X - opening faces outward
    case 'clip_on':
      return [Math.PI, 0, 0]; // Flip 180° - clips from above
    default:
      return [0, 0, 0]; // Table/floor stay as-is
  }
};

const LampScene3D = ({
  params,
  hardware,
  showWireframe = false,
  showSocket = true,
  showBulb = true,
  showHeatZone = true,
  previewInstalled = false,
}: LampScene3DProps) => {
  // Camera target at lamp center
  const cameraTarget: [number, number, number] = [0, params.height * 0.005, 0];
  
  // Get rotation based on preview mode and lamp style
  const installedRotation = previewInstalled 
    ? getInstalledRotation(hardware.lampStyle) 
    : [0, 0, 0] as [number, number, number];

  return (
    <Canvas
      camera={{ position: [4, 2.5, 4], fov: 40 }}
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
        
        {/* Lamp group with installed rotation */}
        <group rotation={installedRotation}>
          {/* Unified lamp mesh - shade with integrated hardware accommodation */}
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
        </group>
        
        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={10}
          target={cameraTarget}
        />
      </Suspense>
    </Canvas>
  );
};

export default LampScene3D;
