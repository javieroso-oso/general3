import { useMemo } from 'react';
import * as THREE from 'three';
import { LampParams, LampHardware, LampStyle, socketDimensions } from '@/types/lamp';

interface MountingMeshProps {
  params: LampParams;
  hardware: LampHardware;
}

const MountingMesh = ({ params, hardware }: MountingMeshProps) => {
  const scale = 0.01;
  const socket = socketDimensions[hardware.socketType];
  const { mounting } = params;
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    
    const segments = 32;
    
    const addCylinder = (
      bottomY: number, 
      topY: number, 
      bottomRadius: number, 
      topRadius: number,
      hollow: boolean = false,
      innerRadius: number = 0
    ) => {
      const baseIndex = positions.length / 3;
      
      // Outer surface
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        
        // Bottom vertex
        positions.push(cos * bottomRadius * scale, bottomY * scale, sin * bottomRadius * scale);
        normals.push(cos, 0, sin);
        
        // Top vertex
        positions.push(cos * topRadius * scale, topY * scale, sin * topRadius * scale);
        normals.push(cos, 0, sin);
      }
      
      // Create faces for outer
      for (let i = 0; i < segments; i++) {
        const a = baseIndex + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
      
      if (hollow && innerRadius > 0) {
        const innerBase = positions.length / 3;
        
        // Inner surface
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);
          
          positions.push(cos * innerRadius * scale, bottomY * scale, sin * innerRadius * scale);
          normals.push(-cos, 0, -sin);
          
          positions.push(cos * innerRadius * scale, topY * scale, sin * innerRadius * scale);
          normals.push(-cos, 0, -sin);
        }
        
        // Create faces for inner (reversed winding)
        for (let i = 0; i < segments; i++) {
          const a = innerBase + i * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
        
        // Top ring
        const topRingBase = positions.length / 3;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);
          
          positions.push(cos * topRadius * scale, topY * scale, sin * topRadius * scale);
          normals.push(0, 1, 0);
          positions.push(cos * innerRadius * scale, topY * scale, sin * innerRadius * scale);
          normals.push(0, 1, 0);
        }
        
        for (let i = 0; i < segments; i++) {
          const a = topRingBase + i * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      } else {
        // Solid top cap
        const capBase = positions.length / 3;
        positions.push(0, topY * scale, 0);
        normals.push(0, 1, 0);
        
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          positions.push(Math.cos(theta) * topRadius * scale, topY * scale, Math.sin(theta) * topRadius * scale);
          normals.push(0, 1, 0);
        }
        
        for (let i = 0; i < segments; i++) {
          indices.push(capBase, capBase + i + 1, capBase + i + 2);
        }
      }
    };
    
    const addDisk = (y: number, outerRadius: number, innerRadius: number = 0) => {
      const baseIndex = positions.length / 3;
      
      if (innerRadius > 0) {
        // Ring
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);
          
          positions.push(cos * outerRadius * scale, y * scale, sin * outerRadius * scale);
          normals.push(0, 1, 0);
          positions.push(cos * innerRadius * scale, y * scale, sin * innerRadius * scale);
          normals.push(0, 1, 0);
        }
        
        for (let i = 0; i < segments; i++) {
          const a = baseIndex + i * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      } else {
        // Solid disk
        positions.push(0, y * scale, 0);
        normals.push(0, 1, 0);
        
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          positions.push(Math.cos(theta) * outerRadius * scale, y * scale, Math.sin(theta) * outerRadius * scale);
          normals.push(0, 1, 0);
        }
        
        for (let i = 0; i < segments; i++) {
          indices.push(baseIndex, baseIndex + i + 1, baseIndex + i + 2);
        }
      }
    };
    
    // Generate mounting based on style
    switch (hardware.lampStyle) {
      case 'pendant': {
        // Canopy - decorative disc at top with cord hole
        const canopyY = params.height + 5;
        addCylinder(
          canopyY, 
          canopyY + mounting.canopyHeight, 
          mounting.canopyDiameter / 2, 
          mounting.canopyDiameter / 2 * 0.9,
          true,
          mounting.cordChannelDiameter / 2
        );
        
        // Socket collar that blends into shade
        const collarOuterR = params.socketHoleDiameter / 2 + params.wallThickness * 2;
        const collarInnerR = socket.outerDiameter / 2 + 1;
        addCylinder(
          params.height - 10,
          params.height + 5,
          collarOuterR,
          collarOuterR * 0.8,
          true,
          collarInnerR
        );
        break;
      }
      
      case 'table': {
        // Heavy base platform
        addCylinder(
          -mounting.baseHeight,
          0,
          mounting.baseWidth / 2,
          mounting.baseWidth / 2 * 0.95,
          false
        );
        
        // Central stem from base to shade
        const stemRadius = mounting.stemDiameter / 2;
        addCylinder(
          0,
          params.height * 0.3,
          stemRadius * 1.2,
          stemRadius,
          true,
          hardware.cordDiameter / 2 + 2
        );
        
        // Socket holder at connection point
        addCylinder(
          params.height * 0.3 - 5,
          params.height * 0.3 + 10,
          params.baseRadius * 0.5,
          params.baseRadius * 0.4,
          true,
          socket.outerDiameter / 2 + 1
        );
        break;
      }
      
      case 'wall_sconce': {
        // Backplate
        const bpW = mounting.backplateWidth / 2;
        const bpH = mounting.backplateHeight / 2;
        const bpDepth = 15;
        
        // Simple rectangular backplate approximated with cylinder
        addCylinder(
          params.height * 0.5 - bpH,
          params.height * 0.5 + bpH,
          bpW,
          bpW,
          false
        );
        
        // Arm extending from backplate
        const armStartY = params.height * 0.5;
        const armAngleRad = mounting.armAngle * Math.PI / 180;
        
        // Simplified arm as angled cylinder segment
        addCylinder(
          armStartY - 10,
          armStartY + 10,
          15,
          12,
          true,
          hardware.cordDiameter / 2 + 2
        );
        break;
      }
      
      case 'floor': {
        // Pole adapter - fits standard lamp poles
        const adapterR = mounting.poleAdapterDiameter / 2;
        addCylinder(
          -mounting.poleAdapterHeight,
          0,
          adapterR + 5,
          adapterR + 5,
          true,
          adapterR - 2
        );
        
        // Transition collar
        addCylinder(
          0,
          15,
          params.baseRadius * 0.6,
          params.baseRadius * 0.5,
          true,
          adapterR
        );
        break;
      }
      
      case 'clip_on': {
        // Rim clip mechanism
        const clipY = params.height * 0.95;
        const clipR = params.topRadius + mounting.clipDepth;
        
        // Outer clip ring
        addCylinder(
          clipY - mounting.clipWidth / 2,
          clipY + mounting.clipWidth / 2,
          clipR,
          clipR,
          true,
          params.topRadius - 5
        );
        
        // Inner grip
        addCylinder(
          clipY - 5,
          clipY + 5,
          params.topRadius - 3,
          params.topRadius - 3,
          true,
          params.topRadius - 8
        );
        break;
      }
    }
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    
    return geo;
  }, [params, hardware, mounting, socket, scale]);
  
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#e8e8e8"
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default MountingMesh;
