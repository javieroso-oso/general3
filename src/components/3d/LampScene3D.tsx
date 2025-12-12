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
  showMounting?: boolean;
}

const LampScene3D = ({
  params,
  hardware,
  showWireframe = false,
  showSocket = true,
  showBulb = true,
  showHeatZone = true,
  showMounting = true,
}: LampScene3DProps) => {
  // Calculate camera target based on lamp style
  const getCameraTarget = () => {
    const baseY = params.height * 0.005;
    switch (hardware.lampStyle) {
      case 'table':
        return [0, baseY - params.mounting.baseHeight * 0.003, 0] as [number, number, number];
      case 'floor':
        return [0, baseY - params.mounting.poleAdapterHeight * 0.003, 0] as [number, number, number];
      case 'pendant':
        return [0, baseY + params.mounting.canopyHeight * 0.003, 0] as [number, number, number];
      default:
        return [0, baseY, 0] as [number, number, number];
    }
  };

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
        
        {/* Unified lamp mesh with integrated mounting */}
        <LampMesh
          params={params}
          hardware={hardware}
          showWireframe={showWireframe}
          showMounting={showMounting}
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
        
        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={10}
          target={getCameraTarget()}
        />
      </Suspense>
    </Canvas>
  );
};

export default LampScene3D;
