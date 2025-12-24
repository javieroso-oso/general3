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

      // Lip flare - guard against division by zero when lipHeight is 0
      if (lipHeight > 0 && lipFlare !== 0) {
        const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
        radius += lipT * lipT * lipFlare * bRad;
      }

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

    // Build body geometry
    const vertices: number[] = [];
    const indices: number[] = [];

    if (isWallMount) {
      // Wall mount: clip at z = cutOffset, create flat back wall with actual holes
      
      // Screw hole positions for triangle exclusion
      const screwCount = params.wallMountScrewCount || 2;
      const screwDiameter = (params.wallMountScrewDiameter || 5) * SCALE;
      const screwRadius = screwDiameter / 2;
      const marginY = h * 0.15;
      
      const screwPositions: { x: number; y: number }[] = [];
      if (screwCount === 2) {
        screwPositions.push({ x: 0, y: marginY });
        screwPositions.push({ x: 0, y: h - marginY });
      } else if (screwCount === 3) {
        screwPositions.push({ x: 0, y: h - marginY });
        const bottomX = bRad * 0.3;
        screwPositions.push({ x: -bottomX, y: marginY });
        screwPositions.push({ x: bottomX, y: marginY });
      } else {
        const topX = tRad * 0.3;
        const bottomX = bRad * 0.3;
        screwPositions.push({ x: -topX, y: h - marginY });
        screwPositions.push({ x: topX, y: h - marginY });
        screwPositions.push({ x: -bottomX, y: marginY });
        screwPositions.push({ x: bottomX, y: marginY });
      }
      
      // Cord hole position
      const cordHoleEnabled = params.wallMountCordHoleEnabled;
      const cordRadius = (params.cordHoleDiameter || 8) * SCALE / 2;
      const cordY = h * 0.5;
      
      // Helper to check if a point is inside any hole
      const isInsideHole = (x: number, y: number): boolean => {
        // Check screw holes
        for (const pos of screwPositions) {
          if (Math.hypot(x - pos.x, y - pos.y) < screwRadius) {
            return true;
          }
        }
        // Check cord hole
        if (cordHoleEnabled && Math.hypot(x, y - cordY) < cordRadius) {
          return true;
        }
        return false;
      };
      
      // Clip vertices at cut plane
      const clippedVerts: number[] = [];
      
      for (let i = 0; i < outerVerts.length; i += 3) {
        const x = outerVerts[i];
        const y = outerVerts[i + 1];
        let z = outerVerts[i + 2];
        
        if (z < cutOffset) {
          z = cutOffset;
        }
        
        clippedVerts.push(x, y, z);
      }
      
      // Copy clipped vertices to main array
      for (let i = 0; i < clippedVerts.length; i++) {
        vertices.push(clippedVerts[i]);
      }
      
      // Build shell surface faces
      for (let i = 0; i < heightSegments; i++) {
        for (let j = 0; j < segments; j++) {
          const a = i * (segments + 1) + j;
          const b = a + 1;
          const c = a + (segments + 1);
          const d = c + 1;
          
          const za = clippedVerts[a * 3 + 2];
          const zb = clippedVerts[b * 3 + 2];
          const zc = clippedVerts[c * 3 + 2];
          const zd = clippedVerts[d * 3 + 2];
          
          const aFront = za > cutOffset + 0.0001;
          const bFront = zb > cutOffset + 0.0001;
          const cFront = zc > cutOffset + 0.0001;
          const dFront = zd > cutOffset + 0.0001;
          
          if (aFront || bFront || cFront || dFront) {
            indices.push(a, c, b);
            indices.push(b, c, d);
          }
        }
      }
      
      // Create flat back wall with ACTUAL HOLES by excluding triangles
      const boundaryByHeight: Map<number, { x: number; y: number; idx: number }[]> = new Map();
      
      for (let i = 0; i <= heightSegments; i++) {
        const heightVerts: { x: number; y: number; idx: number }[] = [];
        
        for (let j = 0; j <= segments; j++) {
          const idx = i * (segments + 1) + j;
          const z = clippedVerts[idx * 3 + 2];
          
          if (Math.abs(z - cutOffset) < 0.0001) {
            heightVerts.push({
              x: clippedVerts[idx * 3],
              y: clippedVerts[idx * 3 + 1],
              idx: idx
            });
          }
        }
        
        if (heightVerts.length > 0) {
          boundaryByHeight.set(i, heightVerts);
        }
      }
      
      const heightLevels = Array.from(boundaryByHeight.keys()).sort((a, b) => a - b);
      
      // Triangulate back wall, excluding triangles that overlap holes
      for (let hi = 0; hi < heightLevels.length - 1; hi++) {
        const currentLevel = boundaryByHeight.get(heightLevels[hi])!;
        const nextLevel = boundaryByHeight.get(heightLevels[hi + 1])!;
        
        currentLevel.sort((a, b) => a.x - b.x);
        nextLevel.sort((a, b) => a.x - b.x);
        
        if (currentLevel.length >= 2 && nextLevel.length >= 2) {
          const currentLeft = currentLevel[0];
          const currentRight = currentLevel[currentLevel.length - 1];
          const nextLeft = nextLevel[0];
          const nextRight = nextLevel[nextLevel.length - 1];
          
          // Calculate triangle centers and check if they're inside any hole
          const tri1CenterX = (currentLeft.x + nextLeft.x + currentRight.x) / 3;
          const tri1CenterY = (currentLeft.y + nextLeft.y + currentRight.y) / 3;
          
          const tri2CenterX = (currentRight.x + nextLeft.x + nextRight.x) / 3;
          const tri2CenterY = (currentRight.y + nextLeft.y + nextRight.y) / 3;
          
          // Only add triangle if its center is NOT inside a hole
          if (!isInsideHole(tri1CenterX, tri1CenterY)) {
            indices.push(currentLeft.idx, nextLeft.idx, currentRight.idx);
          }
          if (!isInsideHole(tri2CenterX, tri2CenterY)) {
            indices.push(currentRight.idx, nextLeft.idx, nextRight.idx);
          }
        }
      }
      
      // NO BOTTOM CAP for wall mount - it should be open at bottom
      
      // L-BRACKET for bulb socket: extends from back wall
      const bracketY = h * 0.65; // Position of bracket
      const bracketArmLength = bRad * 0.7; // How far it extends from wall
      const bracketWidth = 30 * SCALE; // ~30mm wide
      const bracketThickness = wall * 2;
      const socketRingInner = 13 * SCALE; // Inner radius for E26/E27 socket
      const socketRingOuter = 16 * SCALE;
      const socketRingHeight = wall * 1.5;
      
      const bracketStartIdx = vertices.length / 3;
      
      // L-bracket: vertical plate against wall + horizontal arm
      // Vertical plate (against back wall at z = cutOffset)
      const plateHeight = h * 0.3;
      const plateBottom = bracketY - plateHeight / 2;
      const plateTop = bracketY + plateHeight / 2;
      const halfWidth = bracketWidth / 2;
      
      // Vertical plate vertices (4 corners front, 4 corners back)
      // Front face (at z = cutOffset)
      vertices.push(-halfWidth, plateBottom, cutOffset); // 0
      vertices.push(halfWidth, plateBottom, cutOffset);  // 1
      vertices.push(halfWidth, plateTop, cutOffset);     // 2
      vertices.push(-halfWidth, plateTop, cutOffset);    // 3
      // Back face (at z = cutOffset - bracketThickness)
      vertices.push(-halfWidth, plateBottom, cutOffset - bracketThickness); // 4
      vertices.push(halfWidth, plateBottom, cutOffset - bracketThickness);  // 5
      vertices.push(halfWidth, plateTop, cutOffset - bracketThickness);     // 6
      vertices.push(-halfWidth, plateTop, cutOffset - bracketThickness);    // 7
      
      // Horizontal arm vertices (extends from wall toward center)
      const armZ = cutOffset + bracketArmLength;
      // Top face of arm
      vertices.push(-halfWidth, bracketY, cutOffset);     // 8
      vertices.push(halfWidth, bracketY, cutOffset);      // 9
      vertices.push(halfWidth, bracketY, armZ);           // 10
      vertices.push(-halfWidth, bracketY, armZ);          // 11
      // Bottom face of arm
      vertices.push(-halfWidth, bracketY - bracketThickness, cutOffset);  // 12
      vertices.push(halfWidth, bracketY - bracketThickness, cutOffset);   // 13
      vertices.push(halfWidth, bracketY - bracketThickness, armZ);        // 14
      vertices.push(-halfWidth, bracketY - bracketThickness, armZ);       // 15
      
      // Vertical plate faces
      // Front
      indices.push(bracketStartIdx + 0, bracketStartIdx + 1, bracketStartIdx + 2);
      indices.push(bracketStartIdx + 0, bracketStartIdx + 2, bracketStartIdx + 3);
      // Back
      indices.push(bracketStartIdx + 4, bracketStartIdx + 6, bracketStartIdx + 5);
      indices.push(bracketStartIdx + 4, bracketStartIdx + 7, bracketStartIdx + 6);
      // Top
      indices.push(bracketStartIdx + 3, bracketStartIdx + 2, bracketStartIdx + 6);
      indices.push(bracketStartIdx + 3, bracketStartIdx + 6, bracketStartIdx + 7);
      // Bottom
      indices.push(bracketStartIdx + 0, bracketStartIdx + 5, bracketStartIdx + 1);
      indices.push(bracketStartIdx + 0, bracketStartIdx + 4, bracketStartIdx + 5);
      // Left
      indices.push(bracketStartIdx + 0, bracketStartIdx + 3, bracketStartIdx + 7);
      indices.push(bracketStartIdx + 0, bracketStartIdx + 7, bracketStartIdx + 4);
      // Right
      indices.push(bracketStartIdx + 1, bracketStartIdx + 5, bracketStartIdx + 6);
      indices.push(bracketStartIdx + 1, bracketStartIdx + 6, bracketStartIdx + 2);
      
      // Horizontal arm faces
      // Top
      indices.push(bracketStartIdx + 8, bracketStartIdx + 9, bracketStartIdx + 10);
      indices.push(bracketStartIdx + 8, bracketStartIdx + 10, bracketStartIdx + 11);
      // Bottom
      indices.push(bracketStartIdx + 12, bracketStartIdx + 14, bracketStartIdx + 13);
      indices.push(bracketStartIdx + 12, bracketStartIdx + 15, bracketStartIdx + 14);
      // Front (at z = armZ)
      indices.push(bracketStartIdx + 11, bracketStartIdx + 10, bracketStartIdx + 14);
      indices.push(bracketStartIdx + 11, bracketStartIdx + 14, bracketStartIdx + 15);
      // Left side
      indices.push(bracketStartIdx + 8, bracketStartIdx + 11, bracketStartIdx + 15);
      indices.push(bracketStartIdx + 8, bracketStartIdx + 15, bracketStartIdx + 12);
      // Right side
      indices.push(bracketStartIdx + 9, bracketStartIdx + 13, bracketStartIdx + 14);
      indices.push(bracketStartIdx + 9, bracketStartIdx + 14, bracketStartIdx + 10);
      
      // Socket ring at end of arm
      const ringSegs = 16;
      const ringCenterZ = armZ - socketRingOuter;
      const ringStartIdx = vertices.length / 3;
      
      // Top ring (outer and inner)
      for (let s = 0; s <= ringSegs; s++) {
        const angle = (s / ringSegs) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * socketRingOuter,
          bracketY,
          ringCenterZ + Math.sin(angle) * socketRingOuter
        );
      }
      for (let s = 0; s <= ringSegs; s++) {
        const angle = (s / ringSegs) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * socketRingInner,
          bracketY,
          ringCenterZ + Math.sin(angle) * socketRingInner
        );
      }
      // Bottom ring (outer and inner)
      for (let s = 0; s <= ringSegs; s++) {
        const angle = (s / ringSegs) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * socketRingOuter,
          bracketY - socketRingHeight,
          ringCenterZ + Math.sin(angle) * socketRingOuter
        );
      }
      for (let s = 0; s <= ringSegs; s++) {
        const angle = (s / ringSegs) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * socketRingInner,
          bracketY - socketRingHeight,
          ringCenterZ + Math.sin(angle) * socketRingInner
        );
      }
      
      const topOuter = ringStartIdx;
      const topInner = ringStartIdx + (ringSegs + 1);
      const botOuter = ringStartIdx + (ringSegs + 1) * 2;
      const botInner = ringStartIdx + (ringSegs + 1) * 3;
      
      // Ring faces
      for (let s = 0; s < ringSegs; s++) {
        // Top surface
        indices.push(topOuter + s, topOuter + s + 1, topInner + s);
        indices.push(topInner + s, topOuter + s + 1, topInner + s + 1);
        // Bottom surface
        indices.push(botOuter + s, botInner + s, botOuter + s + 1);
        indices.push(botOuter + s + 1, botInner + s, botInner + s + 1);
        // Outer wall
        indices.push(topOuter + s, botOuter + s, topOuter + s + 1);
        indices.push(topOuter + s + 1, botOuter + s, botOuter + s + 1);
        // Inner wall
        indices.push(topInner + s, topInner + s + 1, botInner + s);
        indices.push(botInner + s, topInner + s + 1, botInner + s + 1);
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
