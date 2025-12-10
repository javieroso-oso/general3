import { useMemo } from 'react';
import * as THREE from 'three';
import { ProfilePoint, ProfileSettings } from '@/types/custom-profile';
import { generateLatheMesh } from '@/lib/profile-to-mesh';

interface ProfileMeshProps {
  profile: ProfilePoint[];
  settings: ProfileSettings;
  wireframe?: boolean;
}

const ProfileMesh = ({ profile, settings, wireframe = false }: ProfileMeshProps) => {
  const geometry = useMemo(() => {
    if (profile.length < 2) return null;
    
    try {
      return generateLatheMesh(profile, settings);
    } catch (error) {
      console.error('Error generating mesh:', error);
      return null;
    }
  }, [profile, settings]);

  if (!geometry) {
    // Show placeholder when no valid profile
    return (
      <mesh>
        <cylinderGeometry args={[20, 25, 50, 32]} />
        <meshStandardMaterial 
          color="hsl(var(--muted))" 
          transparent 
          opacity={0.3}
          wireframe
        />
      </mesh>
    );
  }

  return (
    <mesh geometry={geometry} scale={[0.01, 0.01, 0.01]}>
      <meshStandardMaterial
        color="hsl(217, 91%, 60%)"
        metalness={0.1}
        roughness={0.4}
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default ProfileMesh;
