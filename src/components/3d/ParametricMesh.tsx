import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParametricParams, ObjectType, printConstraints } from '@/types/parametric';
import { getOverhangVertexColors } from '@/lib/support-free-constraints';
import { generateLegsWithBase } from '@/lib/leg-generator';

interface ParametricMeshProps {
  params: ParametricParams;
  type: ObjectType;
  showWireframe?: boolean;
}

// Deterministic noise for consistent results
const seededRandom = (x: number, y: number, z: number) => {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719;
  return (Math.sin(dot) * 43758.5453) % 1;
};

const noise3D = (x: number, y: number, z: number, scale: number) => {
  const sx = x * scale;
  const sy = y * scale;
  const sz = z * scale;
  
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const iz = Math.floor(sz);
  
  const fx = sx - ix;
  const fy = sy - iy;
  const fz = sz - iz;
  
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  
  const n000 = seededRandom(ix, iy, iz);
  const n100 = seededRandom(ix + 1, iy, iz);
  const n010 = seededRandom(ix, iy + 1, iz);
  const n110 = seededRandom(ix + 1, iy + 1, iz);
  const n001 = seededRandom(ix, iy, iz + 1);
  const n101 = seededRandom(ix + 1, iy, iz + 1);
  const n011 = seededRandom(ix, iy + 1, iz + 1);
  const n111 = seededRandom(ix + 1, iy + 1, iz + 1);
  
  const nx00 = n000 * (1 - ux) + n100 * ux;
  const nx10 = n010 * (1 - ux) + n110 * ux;
  const nx01 = n001 * (1 - ux) + n101 * ux;
  const nx11 = n011 * (1 - ux) + n111 * ux;
  
  const nxy0 = nx00 * (1 - uy) + nx10 * uy;
  const nxy1 = nx01 * (1 - uy) + nx11 * uy;
  
  return (nxy0 * (1 - uz) + nxy1 * uz) * 2 - 1;
};

// Scale factor: convert mm to scene units (1 unit = 100mm for nice viewport)
const SCALE = 0.01;

const ParametricMesh = ({ params, type, showWireframe = false }: ParametricMeshProps) => {
  const groupRef = useRef<THREE.Group>(null);

  const { bodyGeometry, wireframeGeo, legGeometry, overhangColors } = useMemo(() => {
    const {
      height,
      baseRadius,
      topRadius,
      wallThickness,
      wobbleFrequency,
      wobbleAmplitude,
      twistAngle,
      bulgePosition,
      bulgeAmount,
      pinchAmount,
      asymmetry,
      rippleCount,
      rippleDepth,
      lipFlare,
      lipHeight,
      organicNoise,
      noiseScale,
      addLegs,
    } = params;

    // Scale to scene units
    const h = height * SCALE;
    const bRad = baseRadius * SCALE;
    const tRad = topRadius * SCALE;
    const wall = wallThickness * SCALE;

    const segments = 64;
    const heightSegments = 64;
    
    // For wall mount, we generate FULL 360° object then slice with a plane
    const isWallMount = addLegs && params.standType === 'wall_mount';
    const cutOffset = (params.wallMountCutOffset || 0) * SCALE; // Convert mm to scene units

    const outerVerts: number[] = [];
    // Store radii at each height for sizing calculations
    const radiiAtHeight: number[] = [];
    let maxRadius = 0;

    // Generate full 360° object regardless of wall mount
    for (let i = 0; i <= heightSegments; i++) {
      const t = i / heightSegments;
      const y = t * h;

      // Base profile interpolation
      let radius: number;
      if (type === 'lamp') {
        radius = bRad + (tRad - bRad) * Math.pow(t, 0.6);
      } else if (type === 'sculpture') {
        const curve = Math.sin(t * Math.PI);
        radius = bRad * (1 - t * 0.3) + tRad * t * 0.7 + curve * bRad * 0.2;
      } else {
        const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
        radius = bRad * (1 - t * 0.4) + tRad * t * 0.6 + curve * bRad * 0.12;
      }

      // Organic bulge
      const bulgeDist = Math.abs(t - bulgePosition);
      radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * bRad;

      // Pinch effect
      const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
      const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
      radius *= (1 - pinchTop - pinchBottom);

      // Lip flare
      const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
      radius += lipT * lipT * lipFlare * bRad;

      // Ensure minimum radius
      radius = Math.max(radius, printConstraints.minBaseRadius * SCALE * 0.5);
      
      // Store radius and track max for plate sizing
      radiiAtHeight.push(radius);
      if (radius > maxRadius) maxRadius = radius;

      const twistRad = (twistAngle * Math.PI / 180) * t;

      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2 + twistRad;
        let r = radius;

        // Wobble
        if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
          const maxWobble = Math.min(wobbleAmplitude, 0.15);
          r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * bRad;
        }

        // Ripples
        if (rippleCount > 0 && rippleDepth > 0) {
          const maxRipple = Math.min(rippleDepth, 0.1);
          r += Math.sin(theta * rippleCount) * maxRipple * bRad;
        }

        // Asymmetry
        if (asymmetry > 0) {
          const maxAsym = Math.min(asymmetry, 0.1);
          r += Math.sin(theta) * Math.cos(t * Math.PI * 2) * maxAsym * bRad;
        }

        // Organic noise
        if (organicNoise > 0) {
          const maxNoise = Math.min(organicNoise, 0.1);
          const nx = Math.cos(theta) * r;
          const nz = Math.sin(theta) * r;
          r += noise3D(nx * 10, y * 10, nz * 10, noiseScale) * maxNoise * bRad;
        }

        // Ensure minimum radius
        r = Math.max(r, wall * 2);

        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        
        outerVerts.push(x, y, z);
      }
    }

    // Build body geometry - for wall mount, we'll clip vertices and create flat back
    const vertices: number[] = [];
    const indices: number[] = [];

    if (isWallMount) {
      // PLANAR CUT APPROACH: Keep vertices where z > cutOffset, clip others to the plane
      // This creates a flat back exactly at z = cutOffset
      
      // First pass: process all vertices, clipping to the cut plane
      const clippedVerts: number[] = [];
      const vertexMask: boolean[] = []; // true = vertex is in front of cut plane
      
      for (let i = 0; i < outerVerts.length; i += 3) {
        const x = outerVerts[i];
        const y = outerVerts[i + 1];
        const z = outerVerts[i + 2];
        
        if (z >= cutOffset) {
          // Vertex is in front of cut plane - keep it
          clippedVerts.push(x, y, z);
          vertexMask.push(true);
        } else {
          // Vertex is behind cut plane - project to the plane
          clippedVerts.push(x, y, cutOffset);
          vertexMask.push(false);
        }
      }
      
      // Copy clipped vertices
      for (let i = 0; i < clippedVerts.length; i++) {
        vertices.push(clippedVerts[i]);
      }
      
      // Build indices for outer surface (same topology as before)
      for (let i = 0; i < heightSegments; i++) {
        for (let j = 0; j < segments; j++) {
          const a = i * (segments + 1) + j;
          const b = a + 1;
          const c = a + (segments + 1);
          const d = c + 1;
          
          // Only create face if at least one vertex is visible (in front of cut plane)
          const aVisible = vertexMask[a];
          const bVisible = vertexMask[b];
          const cVisible = vertexMask[c];
          const dVisible = vertexMask[d];
          
          // Skip faces that are entirely behind the cut plane (all 4 vertices clipped)
          // But keep faces that have at least some vertices in front
          if (aVisible || bVisible || cVisible || dVisible) {
            indices.push(a, c, b);
            indices.push(b, c, d);
          }
        }
      }
      
      // Create flat back face by collecting all vertices on the cut plane
      // These are vertices where z was clipped to cutOffset
      // We need to triangulate them to create a solid back
      
      // Find all unique (x, y) positions on the cut plane and their indices
      const backEdgeVerts: { idx: number; x: number; y: number }[] = [];
      
      for (let i = 0; i <= heightSegments; i++) {
        for (let j = 0; j <= segments; j++) {
          const idx = i * (segments + 1) + j;
          if (!vertexMask[idx]) {
            // This vertex is on the cut plane
            const x = vertices[idx * 3];
            const y = vertices[idx * 3 + 1];
            backEdgeVerts.push({ idx, x, y });
          }
        }
      }
      
      // Sort by height (y) then by x to help with triangulation
      backEdgeVerts.sort((a, b) => a.y - b.y || a.x - b.x);
      
      // Simple fan triangulation from center for the flat back
      if (backEdgeVerts.length >= 3) {
        // Add center point for flat back
        const centerX = backEdgeVerts.reduce((sum, v) => sum + v.x, 0) / backEdgeVerts.length;
        const centerY = backEdgeVerts.reduce((sum, v) => sum + v.y, 0) / backEdgeVerts.length;
        const centerIdx = vertices.length / 3;
        vertices.push(centerX, centerY, cutOffset);
        
        // Sort vertices by angle from center for proper triangulation
        const sortedByAngle = backEdgeVerts.map(v => ({
          ...v,
          angle: Math.atan2(v.y - centerY, v.x - centerX)
        })).sort((a, b) => a.angle - b.angle);
        
        // Create triangles (reversed winding for back face)
        for (let i = 0; i < sortedByAngle.length; i++) {
          const curr = sortedByAngle[i];
          const next = sortedByAngle[(i + 1) % sortedByAngle.length];
          indices.push(centerIdx, curr.idx, next.idx);
        }
      }
      
      // Add mounting screw holes directly through the flat back
      const screwCount = params.wallMountScrewCount || 2;
      const screwDiameter = (params.wallMountScrewDiameter || 5) * SCALE;
      const screwRadius = screwDiameter / 2;
      const holeDepth = 10 * SCALE; // 10mm deep through flat back
      
      // Calculate screw positions on the flat back
      const backHeight = h;
      const backWidth = maxRadius * 2;
      const marginY = backHeight * 0.15;
      const marginX = backWidth * 0.2;
      
      const screwPositions: { x: number; y: number }[] = [];
      if (screwCount === 2) {
        screwPositions.push({ x: 0, y: marginY });
        screwPositions.push({ x: 0, y: backHeight - marginY });
      } else if (screwCount === 3) {
        screwPositions.push({ x: 0, y: backHeight - marginY });
        screwPositions.push({ x: -backWidth / 4, y: marginY });
        screwPositions.push({ x: backWidth / 4, y: marginY });
      } else {
        screwPositions.push({ x: -backWidth / 4, y: backHeight - marginY });
        screwPositions.push({ x: backWidth / 4, y: backHeight - marginY });
        screwPositions.push({ x: -backWidth / 4, y: marginY });
        screwPositions.push({ x: backWidth / 4, y: marginY });
      }
      
      // Generate screw hole geometry
      const holeSegments = 12;
      for (const pos of screwPositions) {
        const holeStartIdx = vertices.length / 3;
        
        // Front ring (at cut plane)
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            cutOffset
          );
        }
        
        // Back ring (behind cut plane)
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            cutOffset - holeDepth
          );
        }
        
        // Hole wall indices
        for (let s = 0; s < holeSegments; s++) {
          const a = holeStartIdx + s;
          const b = holeStartIdx + s + 1;
          const c = holeStartIdx + holeSegments + 1 + s;
          const d = holeStartIdx + holeSegments + 1 + s + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
      
      // Add cord hole if enabled
      if (params.wallMountCordHoleEnabled) {
        const cordRadius = (params.cordHoleDiameter || 8) * SCALE / 2;
        const cordY = backHeight * 0.7; // Near top for pendant-style socket
        const cordHoleStartIdx = vertices.length / 3;
        
        // Front ring
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            0 + Math.cos(angle) * cordRadius,
            cordY + Math.sin(angle) * cordRadius,
            cutOffset
          );
        }
        
        // Back ring
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            0 + Math.cos(angle) * cordRadius,
            cordY + Math.sin(angle) * cordRadius,
            cutOffset - holeDepth
          );
        }
        
        // Hole wall indices
        for (let s = 0; s < holeSegments; s++) {
          const a = cordHoleStartIdx + s;
          const b = cordHoleStartIdx + s + 1;
          const c = cordHoleStartIdx + holeSegments + 1 + s;
          const d = cordHoleStartIdx + holeSegments + 1 + s + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
      
    } else {
      // Normal full 360° object (no wall mount)
      for (let i = 0; i < outerVerts.length; i++) {
        vertices.push(outerVerts[i]);
      }
      
      // Outer surface indices
      for (let i = 0; i < heightSegments; i++) {
        for (let j = 0; j < segments; j++) {
          const a = i * (segments + 1) + j;
          const b = a + 1;
          const c = a + (segments + 1);
          const d = c + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
    }

    // Add base cap for preview when legs are NOT enabled
    if (!addLegs) {
      const baseCenterIdx = vertices.length / 3;
      vertices.push(0, 0, 0); // Center point at base
      
      // Connect first ring of vertices to center to create base cap
      for (let j = 0; j < segments; j++) {
        const a = j;
        const b = j + 1;
        indices.push(baseCenterIdx, b, a);
      }
    }

    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bodyGeo.setIndex(indices);
    bodyGeo.computeVertexNormals();
    
    // Generate overhang colors if enabled
    let overhangColorArray: Float32Array | null = null;
    if (params.showOverhangMap && !isWallMount) {
      overhangColorArray = getOverhangVertexColors(params, heightSegments, segments);
      bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(overhangColorArray, 3));
    }

    // Wireframe geometry
    const wireGeo = new THREE.WireframeGeometry(bodyGeo);
    
    // Generate stand geometry based on standType (only for tripod now)
    let standGeo: THREE.BufferGeometry | null = null;
    if (addLegs && params.standType === 'tripod') {
      // Use existing tripod generator
      const legGeoMM = generateLegsWithBase(
        baseRadius,
        params.legCount,
        params.legHeight,
        params.legSpread,
        params.legThickness,
        params.legTaper,
        params.legInset,
        params.baseThickness || 3,
        {
          wobbleFrequency,
          wobbleAmplitude,
          rippleCount,
          rippleDepth,
          asymmetry,
          organicNoise,
          noiseScale,
        },
        {
          wallThickness: params.wallThickness,
          cordHoleEnabled: params.cordHoleEnabled,
          cordHoleDiameter: params.cordHoleDiameter,
          centeringLipEnabled: params.centeringLipEnabled,
          centeringLipHeight: params.centeringLipHeight,
          socketType: params.socketType,
        },
        {
          attachmentType: params.attachmentType,
          screwCount: params.screwCount,
          baseRadius: params.baseRadius,
        }
      );
      legGeoMM.scale(SCALE, SCALE, SCALE);
      standGeo = legGeoMM;
    }
    // Wall mount no longer needs separate stand geometry - mounting holes are integrated

    return { bodyGeometry: bodyGeo, wireframeGeo: wireGeo, legGeometry: standGeo, overhangColors: overhangColorArray };
  }, [params, type]);

  useFrame((state) => {
    const rotation = state.clock.elapsedTime * 0.05;
    if (groupRef.current) groupRef.current.rotation.y = rotation;
  });

  return (
    <group ref={groupRef}>
      {/* Legs (extend downward from base) */}
      {legGeometry && (
        <mesh geometry={legGeometry} castShadow receiveShadow>
          <meshStandardMaterial
            color="#d4d4d4"
            roughness={0.4}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* Organic body (starts at y=0, goes up) */}
      <mesh geometry={bodyGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={params.showOverhangMap ? "#ffffff" : "#e8e8e8"}
          vertexColors={params.showOverhangMap}
          roughness={0.55}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {showWireframe && (
        <lineSegments geometry={wireframeGeo}>
          <lineBasicMaterial color="#3b82f6" opacity={0.3} transparent />
        </lineSegments>
      )}
    </group>
  );
};

export default ParametricMesh;
