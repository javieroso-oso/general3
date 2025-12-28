import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { Suspense } from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
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
        
        {/* Professional 3-point lighting setup */}
        <ambientLight intensity={0.3} />
        
        {/* Key light - main light source */}
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={1.8} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        />
        
        {/* Fill light - softer, opposite side */}
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        
        {/* Rim/back light - creates edge definition */}
        <directionalLight position={[0, 3, -8]} intensity={0.6} />
        
        {/* Under-fill for product shot feel */}
        <directionalLight position={[0, -3, 0]} intensity={0.15} />
        
        {/* Better HDRI environment for reflections */}
        <Environment preset="warehouse" />
        
        {/* Soft contact shadows for grounding */}
        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.4}
          scale={8}
          blur={2.5}
          far={4}
          resolution={512}
          color="#000000"
        />
        
        {/* Subtle ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <circleGeometry args={[3, 64]} />
          <meshStandardMaterial 
            color="#1a1a1a" 
            transparent 
            opacity={0.05}
            roughness={0.9}
          />
        </mesh>
        
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
        
        {/* Post-processing effects */}
        <EffectComposer>
          <Bloom 
            luminanceThreshold={0.85}
            luminanceSmoothing={0.025}
            intensity={0.2}
            mipmapBlur
          />
          <Vignette
            offset={0.35}
            darkness={0.25}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default Scene3D;
