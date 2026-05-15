import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { BookParams } from '@/types/pages';
import { generateBookGeometry } from '@/lib/pages/book-generator';
import { onImageDecoded, ensureImageDecoded } from '@/lib/pages/page-height-field';

interface BookMeshProps {
  book: BookParams;
  color?: string;
  wireframe?: boolean;
}

const BookMesh = ({ book, color = '#dadce8', wireframe = false }: BookMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    return generateBookGeometry(book, { scale: 0.01 });
  }, [book]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} wireframe={wireframe} metalness={0.05} roughness={0.6} />
    </mesh>
  );
};

interface BookPreviewProps {
  book: BookParams;
  color?: string;
  wireframe?: boolean;
  autoRotate?: boolean;
}

const BookPreview = ({ book, color, wireframe, autoRotate = true }: BookPreviewProps) => {
  return (
    <Canvas
      shadows
      camera={{ position: [3, 2, 3], fov: 40 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />
      <Environment preset="studio" />
      <BookMesh book={book} color={color} wireframe={wireframe} />
      <gridHelper args={[10, 20, '#bbb', '#eee']} position={[0, -0.001, 0]} />
      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        enablePan
        enableZoom
        target={[0, Math.max(0.4, (book.pageHeight * 0.5) * 0.01), 0]}
      />
    </Canvas>
  );
};

export default BookPreview;
