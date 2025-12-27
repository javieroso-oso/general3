import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { 
  TotemStack, 
  TotemModuleConfig, 
  calculateStackHeight,
  SPINDLE_SPECS,
  SpindleSize,
  ShadeModuleConfig,
  ExtensionModuleConfig,
  SpacerModuleConfig,
  BaseModuleConfig,
  CapModuleConfig,
  PendantModuleConfig,
} from '@/types/totem';
import { generateModuleGeometry } from '@/lib/totem/module-generators';
import { calculateModuleYPosition } from '@/lib/totem/spindle-geometry';

interface TotemStackPreviewProps {
  stack: TotemStack;
  selectedModuleId?: string;
  onSelectModule?: (moduleId: string) => void;
  showSpindle?: boolean;
}

const SCALE = 0.01; // mm to scene units

// Get module height based on type
function getModuleHeight(module: TotemModuleConfig): number {
  switch (module.type) {
    case 'shade':
    case 'extension':
      const shapeModule = module as ShadeModuleConfig | ExtensionModuleConfig;
      return shapeModule.shapeParams.height || 100;
    case 'spacer':
      return (module as SpacerModuleConfig).height;
    case 'base':
      return (module as BaseModuleConfig).height;
    case 'cap':
      const capModule = module as CapModuleConfig;
      return capModule.domeHeight + capModule.bottomInterface.ring.height;
    case 'pendant':
      return (module as PendantModuleConfig).canopyHeight;
    default:
      return 50;
  }
}

// Individual module mesh component
interface ModuleMeshProps {
  config: TotemModuleConfig;
  yPosition: number;
  isSelected: boolean;
  onClick: () => void;
}

const ModuleMesh = ({ config, yPosition, isSelected, onClick }: ModuleMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    try {
      return generateModuleGeometry(config, true); // scale = true for mm to scene units
    } catch (error) {
      console.error('Error generating module geometry:', error);
      // Return a placeholder cylinder on error
      return new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    }
  }, [config]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[0, yPosition * SCALE, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <meshStandardMaterial
        color={isSelected ? '#ff6b35' : '#f5f0e8'}
        roughness={0.4}
        metalness={0.1}
        emissive={isSelected ? '#ff6b35' : '#000000'}
        emissiveIntensity={isSelected ? 0.2 : 0}
      />
    </mesh>
  );
};

// Ghost spindle visualization
interface SpindleMeshProps {
  spindleSize: SpindleSize;
  length: number;
}

const SpindleMesh = ({ spindleSize, length }: SpindleMeshProps) => {
  const spec = SPINDLE_SPECS[spindleSize];
  
  // Use a simple cylinder geometry directly to avoid any translation issues
  const geometry = useMemo(() => {
    const radius = spec.diameter / 2;
    return new THREE.CylinderGeometry(radius * SCALE, radius * SCALE, length * SCALE, 16);
  }, [spec.diameter, length]);

  return (
    <mesh geometry={geometry} position={[0, (length / 2) * SCALE, 0]}>
      <meshStandardMaterial
        color="#8B7355"
        roughness={0.7}
        metalness={0.0}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
};

// Stack scene content
interface StackSceneProps {
  stack: TotemStack;
  selectedModuleId?: string;
  onSelectModule?: (moduleId: string) => void;
  showSpindle: boolean;
}

const StackScene = ({ stack, selectedModuleId, onSelectModule, showSpindle }: StackSceneProps) => {
  const { modules, spindleSize } = stack;
  
  // Calculate Y positions for each module
  const moduleHeights = modules.map(m => getModuleHeight(m));
  
  // Calculate total stack height for spindle
  const totalHeight = calculateStackHeight(modules);
  
  return (
    <>
      {/* Render each module */}
      {modules.map((module, index) => {
        const yPosition = calculateModuleYPosition(index, moduleHeights);
        return (
          <ModuleMesh
            key={module.id}
            config={module}
            yPosition={yPosition}
            isSelected={selectedModuleId === module.id}
            onClick={() => onSelectModule?.(module.id)}
          />
        );
      })}
      
      {/* Ghost spindle */}
      {showSpindle && modules.length > 0 && (
        <SpindleMesh 
          spindleSize={spindleSize} 
          length={totalHeight + 10} // Add extra for clearance
        />
      )}
    </>
  );
};

const TotemStackPreview = ({
  stack,
  selectedModuleId,
  onSelectModule,
  showSpindle = true,
}: TotemStackPreviewProps) => {
  const totalHeight = calculateStackHeight(stack.modules);
  const cameraDistance = Math.max(4, totalHeight * SCALE * 2);
  
  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-gradient-to-b from-secondary/30 to-secondary/60">
      <Canvas shadows>
        <PerspectiveCamera 
          makeDefault 
          position={[cameraDistance * 0.7, cameraDistance * 0.5, cameraDistance]} 
          fov={45} 
        />
        
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
        
        <StackScene
          stack={stack}
          selectedModuleId={selectedModuleId}
          onSelectModule={onSelectModule}
          showSpindle={showSpindle}
        />
        
        <OrbitControls
          enablePan={true}
          minDistance={1}
          maxDistance={15}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          target={[0, totalHeight * SCALE * 0.5, 0]}
        />
      </Canvas>
    </div>
  );
};

export default TotemStackPreview;
