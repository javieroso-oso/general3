import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import ShadeMesh from './ShadeMesh';
import StandMesh from './StandMesh';
import SocketMesh from './SocketMesh';
import BulbMesh from './BulbMesh';
import { LampParams, LampHardware, StandParams, getSocketHolderDimensions } from '@/types/lamp';

interface LampScene3DProps {
  params: LampParams;
  hardware: LampHardware;
  standParams: StandParams;
  showWireframe?: boolean;
  showSocket?: boolean;
  showBulb?: boolean;
  showHeatZone?: boolean;
  showStand?: boolean;
  showShade?: boolean;
  previewInstalled?: boolean;
}

// Get rotation for installed view based on stand type
const getInstalledRotation = (standType: string): [number, number, number] => {
  switch (standType) {
    case 'pendant_cord':
      return [Math.PI, 0, 0]; // Flip 180° - shade hangs below
    case 'wall_arm':
      return [0, 0, 0]; // Wall mount - no rotation needed
    case 'tripod':
    default:
      return [0, 0, 0]; // Table lamp stays upright
  }
};

// Calculate shade position relative to stand
const getShadePosition = (standParams: StandParams, shadeHeight: number): [number, number, number] => {
  const scale = 0.01;
  
  switch (standParams.type) {
    case 'tripod':
      // Shade sits on top of tripod rim ring
      return [0, standParams.height * scale, 0];
    case 'pendant_cord':
      // Shade hangs from pendant bracket
      const socketHolder = getSocketHolderDimensions(standParams.socketType);
      return [0, (standParams.height - socketHolder.height - 5) * scale, 0];
    case 'wall_arm':
      // Shade sits on wall arm socket holder
      const armAngleRad = (standParams.armAngle * Math.PI) / 180;
      const armEndZ = standParams.armLength * Math.cos(armAngleRad);
      const armEndY = standParams.backplateHeight / 2 + standParams.armLength * Math.sin(armAngleRad);
      const wallSocketHolder = getSocketHolderDimensions(standParams.socketType);
      return [0, (armEndY - wallSocketHolder.height - 5) * scale, armEndZ * scale];
    default:
      return [0, 0, 0];
  }
};

// Calculate socket/bulb position in stand
const getSocketPosition = (standParams: StandParams): number => {
  switch (standParams.type) {
    case 'tripod':
      return standParams.height - 20;
    case 'pendant_cord':
      return standParams.height - 30;
    case 'wall_arm':
      const armAngleRad = (standParams.armAngle * Math.PI) / 180;
      return standParams.backplateHeight / 2 + standParams.armLength * Math.sin(armAngleRad) - 30;
    default:
      return 100;
  }
};

const LampScene3D = ({
  params,
  hardware,
  standParams,
  showWireframe = false,
  showSocket = true,
  showBulb = true,
  showHeatZone = true,
  showStand = true,
  showShade = true,
  previewInstalled = false,
}: LampScene3DProps) => {
  // Camera target at lamp center
  const cameraTarget: [number, number, number] = [0, params.height * 0.005, 0];
  
  // Get rotation based on preview mode and stand type
  const installedRotation = previewInstalled 
    ? getInstalledRotation(hardware.standType) 
    : [0, 0, 0] as [number, number, number];
  
  // Calculate shade position on stand
  const shadePosition = getShadePosition(standParams, params.height);
  const socketMountingHeight = getSocketPosition(standParams);

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
        
        {/* Lamp assembly with installed rotation */}
        <group rotation={installedRotation}>
          {/* Stand (structural frame with socket holder) */}
          <StandMesh
            params={standParams}
            showWireframe={showWireframe}
            visible={showStand}
          />
          
          {/* Shade (purely decorative, rests on stand) */}
          {showShade && (
            <group position={shadePosition}>
              <ShadeMesh
                params={params}
                showWireframe={showWireframe}
              />
            </group>
          )}
          
          {/* Socket ghost visualization (in stand) */}
          <SocketMesh
            socketType={hardware.socketType}
            mountingHeight={socketMountingHeight}
            visible={showSocket}
          />
          
          {/* Bulb ghost visualization */}
          <BulbMesh
            bulbShape={hardware.bulbShape}
            socketType={hardware.socketType}
            mountingHeight={socketMountingHeight}
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
