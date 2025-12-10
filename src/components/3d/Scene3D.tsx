import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { Suspense } from 'react';
import ParametricMesh from './ParametricMesh';
import { ParametricParams, ObjectType } from '@/types/parametric';

interface Scene3DProps {
  params: ParametricParams;
  type: ObjectType;
}

const Scene3D = ({ params, type }: Scene3DProps) => {
  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-gradient-to-b from-secondary/50 to-secondary">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 2, 6]} fov={45} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={20}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        <directionalLight position={[-3, 5, -3]} intensity={0.3} />
        
        {/* Environment */}
        <Environment preset="studio" />
        
        {/* Main Object */}
        <Suspense fallback={null}>
          <ParametricMesh params={params} type={type} />
        </Suspense>
        
        {/* Ground shadow */}
        <ContactShadows
          position={[0, -params.height / 2 - 0.01, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
        />
        
        {/* Controls */}
        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={12}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
};

export default Scene3D;
