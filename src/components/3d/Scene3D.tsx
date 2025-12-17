import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Grid } from '@react-three/drei';
import { Suspense } from 'react';
import ParametricMesh from './ParametricMesh';
import StandMesh from './StandMesh';
import GCodePreview from './GCodePreview';
import SocketMesh from './SocketMesh';
import BulbMesh from './BulbMesh';
import { ParametricParams, ObjectType, PrintSettings } from '@/types/parametric';
import { ParametricStandParams } from '@/types/stand';

interface Scene3DProps {
  params: ParametricParams;
  type: ObjectType;
  settings?: PrintSettings;
  showWireframe?: boolean;
  viewMode?: 'model' | 'gcode';
  gcodeLayer?: number;
  gcodeShowAll?: boolean;
  gcodeAnimate?: boolean;
  standParams?: ParametricStandParams;
}

const defaultSettings: PrintSettings = {
  layerHeight: 0.2,
  nozzleDiameter: 0.4,
  infillPercent: 15,
  printSpeed: 50,
  material: 'PLA',
  supportEnabled: false,
  brimWidth: 5,
  printMode: 'standard',
  spiralVase: false,
  nonPlanar: {
    maxZAngle: 30,
    curvedLayers: false,
    topSurfaceOptimized: false,
    adaptiveLayerHeight: false,
    minLayerHeight: 0.1,
    maxLayerHeight: 0.3,
  },
};

const SCALE = 0.01; // mm to scene units

const Scene3D = ({ 
  params, 
  type, 
  settings = defaultSettings,
  showWireframe = false,
  viewMode = 'model',
  gcodeLayer = 0,
  gcodeShowAll = true,
  gcodeAnimate = false,
  standParams,
}: Scene3DProps) => {
  const standVisible = standParams?.enabled;
  
  // Position calculations:
  // - Stand base sits at y=0 (ground)
  // - Stand socket cradle top is at y=standHeight
  // - Object's collar (y=0 to y=-collarHeight) needs to sit IN the cradle
  // - Object position: collar bottom at (standHeight - cradleDepth)
  
  const standHeight = standParams?.height ?? 120;
  const cradleDepth = standParams?.socketCradleDepth ?? 5;
  const collarHeight = params.hasRimCollar ? params.rimHeight : 0;
  
  // When stand enabled: position object so its collar sits into the cradle
  // Collar goes from y=0 to y=-collarHeight relative to object origin
  // We want collar bottom (y=-collarHeight) to be at (standHeight - cradleDepth)
  // So object origin should be at: standHeight - cradleDepth + collarHeight
  const objectYOffset = standVisible 
    ? (standHeight - cradleDepth + collarHeight) * SCALE
    : collarHeight * SCALE; // Without stand, collar bottom at y=0
  
  // Hardware positioning (socket sits at top of stand, inside cradle)
  const showHardware = type === 'lamp' && standVisible && standParams?.showHardwarePreview;
  const socketMountingHeight = standHeight; // Top of stand
  
  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-gradient-to-b from-secondary/30 to-secondary/60">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={45} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-3, 5, -3]} intensity={0.4} />
        
        <Environment preset="studio" />
        
        {/* Print bed grid */}
        <Grid
          position={[0, -0.01, 0]}
          args={[4, 4]}
          cellSize={0.2}
          cellThickness={0.5}
          cellColor="#a1a1aa"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#71717a"
          fadeDistance={10}
          fadeStrength={1}
          followCamera={false}
        />
        
        <Suspense fallback={null}>
          {viewMode === 'model' ? (
            <group>
              {/* Stand (base at y=0) */}
              {standVisible && standParams && (
                <StandMesh
                  params={standParams}
                  showWireframe={showWireframe}
                />
              )}
              
              {/* Lamp hardware (socket and bulb) */}
              {showHardware && standParams && (
                <>
                  <SocketMesh
                    socketType={standParams.socketType}
                    mountingHeight={socketMountingHeight}
                    visible={true}
                  />
                  <BulbMesh
                    bulbShape={standParams.bulbShape}
                    socketType={standParams.socketType}
                    mountingHeight={socketMountingHeight}
                    wattage={standParams.bulbWattage}
                    showHeatZone={standParams.showHeatZone}
                    visible={true}
                  />
                </>
              )}
              
              {/* Parametric object - collar nestles into stand's socket cradle */}
              <group position={[0, objectYOffset, 0]}>
                <ParametricMesh params={params} type={type} showWireframe={showWireframe} />
              </group>
            </group>
          ) : (
            <GCodePreview 
              params={params} 
              type={type} 
              settings={settings}
              currentLayer={gcodeLayer}
              showAllLayers={gcodeShowAll}
              animate={gcodeAnimate}
            />
          )}
        </Suspense>
        
        <OrbitControls
          enablePan={true}
          minDistance={1}
          maxDistance={15}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          target={[0, 0.5, 0]}
        />
      </Canvas>
    </div>
  );
};

export default Scene3D;
