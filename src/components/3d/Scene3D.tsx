import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei';
import { Suspense } from 'react';
import ParametricMesh from './ParametricMesh';
import GCodePreview from './GCodePreview';
import { ParametricParams, ObjectType, PrintSettings } from '@/types/parametric';
import { MaterialPreset } from '@/types/materials';

interface Scene3DProps {
  params: ParametricParams;
  type: ObjectType;
  settings?: PrintSettings;
  showWireframe?: boolean;
  viewMode?: 'model' | 'gcode';
  gcodeLayer?: number;
  gcodeShowAll?: boolean;
  gcodeAnimate?: boolean;
  materialPreset?: MaterialPreset;
  autoRotate?: boolean;
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
    fullSurfaceLayers: false,
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
  materialPreset = 'ceramic',
  autoRotate = true,
}: Scene3DProps) => {
  // When legs are enabled, lift the entire object so legs touch ground
  const legHeight = params.addLegs ? params.legHeight : 0;
  const objectYOffset = legHeight * SCALE;
  
  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-gradient-to-b from-secondary/30 to-secondary/60">
      <Canvas shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}>
        <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={45} />
        
        {/* Simple lighting setup */}
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
        />
        
        {/* Environment for reflections */}
        <Environment preset="studio" />
        
        <Suspense fallback={null}>
          {viewMode === 'model' ? (
            <group position={[0, objectYOffset, 0]}>
              <ParametricMesh 
                params={params} 
                type={type} 
                showWireframe={showWireframe}
                materialPreset={materialPreset}
                autoRotate={autoRotate}
              />
            </group>
          ) : (
            <GCodePreview 
              key={`gcode-${params.height}-${params.baseRadius}-${params.topRadius}-${params.profileCurve}-${type}-${JSON.stringify(settings.nonPlanar)}`}
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
          autoRotate={false}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
};

export default Scene3D;
