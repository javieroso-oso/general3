import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera, Grid } from '@react-three/drei';
import { Suspense } from 'react';
import ParametricMesh from './ParametricMesh';
import { ParametricParams, ObjectType } from '@/types/parametric';

interface Scene3DProps {
  params: ParametricParams;
  type: ObjectType;
  showWireframe?: boolean;
}

const Scene3D = ({ params, type, showWireframe = false }: Scene3DProps) => {
  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-gradient-to-b from-secondary/30 to-secondary/60">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={45} />
        
        {/* Lighting for accurate preview */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-3, 5, -3]} intensity={0.4} />
        
        <Environment preset="studio" />
        
        {/* Print bed grid */}
        <Grid
          position={[0, -params.height * 0.01 * 0.5 - 0.01, 0]}
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
          <ParametricMesh params={params} type={type} showWireframe={showWireframe} />
        </Suspense>
        
        <ContactShadows
          position={[0, -params.height * 0.01 * 0.5 - 0.01, 0]}
          opacity={0.5}
          scale={8}
          blur={2}
          far={4}
        />
        
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
