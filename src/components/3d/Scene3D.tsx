import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Grid } from '@react-three/drei';
import { Suspense } from 'react';
import ParametricMesh from './ParametricMesh';
import StandMesh from './StandMesh';
import GCodePreview from './GCodePreview';
import { ParametricParams, ObjectType, PrintSettings, StandParams } from '@/types/parametric';

interface Scene3DProps {
  params: ParametricParams;
  type: ObjectType;
  settings?: PrintSettings;
  showWireframe?: boolean;
  viewMode?: 'model' | 'gcode';
  gcodeLayer?: number;
  gcodeShowAll?: boolean;
  gcodeAnimate?: boolean;
  standParams?: StandParams;
}

const defaultSettings: PrintSettings = {
  layerHeight: 0.2,
  nozzleDiameter: 0.4,
  infillPercent: 15,
  printSpeed: 50,
  material: 'PLA',
  supportEnabled: false,
  brimWidth: 5,
};

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
  const scale = 0.01;
  const standVisible = standParams?.enabled && standParams?.type !== 'none';
  
  // Calculate stand rim from object base radius
  const standRimDiameter = standParams ? params.baseRadius * 2 : 0;
  
  // Position object on top of stand if stand is enabled
  const objectYOffset = standVisible && standParams ? standParams.height * scale : 0;
  
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
              {/* Stand (if enabled) */}
              {standVisible && standParams && (
                <StandMesh
                  params={{
                    ...standParams,
                    rimDiameter: standRimDiameter,
                  }}
                  showWireframe={showWireframe}
                />
              )}
              
              {/* Parametric object */}
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
          minDistance={2}
          maxDistance={10}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
};

export default Scene3D;
