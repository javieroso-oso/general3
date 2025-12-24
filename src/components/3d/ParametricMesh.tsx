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
      // Wall mount: clip at z = cutOffset, create flat back wall with keyhole mounting holes
      
      const holeCount = params.wallMountHoleCount || 2;
      const holeDiameter = (params.wallMountHoleDiameter || 5) * SCALE;
      const holeRadius = holeDiameter / 2;
      const holeMargin = params.wallMountHoleMargin || 0.15;
      
      // Calculate hole positions based on count
      const marginY = h * holeMargin;
      const holePositions: { x: number; y: number }[] = [];
      
      if (holeCount === 2) {
        holePositions.push({ x: 0, y: marginY });
        holePositions.push({ x: 0, y: h - marginY });
      } else if (holeCount === 3) {
        holePositions.push({ x: 0, y: h - marginY });
        const bottomSpread = bRad * 0.4;
        holePositions.push({ x: -bottomSpread, y: marginY });
        holePositions.push({ x: bottomSpread, y: marginY });
      } else {
        const topSpread = tRad * 0.35;
        const bottomSpread = bRad * 0.35;
        holePositions.push({ x: -topSpread, y: h - marginY });
        holePositions.push({ x: topSpread, y: h - marginY });
        holePositions.push({ x: -bottomSpread, y: marginY });
        holePositions.push({ x: bottomSpread, y: marginY });
      }
      
      // Cord hole
      const cordHoleEnabled = params.wallMountCordHoleEnabled;
      const cordRadius = (params.cordHoleDiameter || 8) * SCALE / 2;
      const cordY = h * 0.5;
      
      // Keyhole dimensions - large circle at bottom, narrow slot going UP
      const keyholeSlotLength = holeRadius * 2.5; // Slot extends upward
      const keyholeSlotWidth = holeRadius * 0.45; // Narrow slot for screw shank
      
      // Clip vertices at cut plane
      const clippedVerts: number[] = [];
      
      for (let i = 0; i < outerVerts.length; i += 3) {
        const x = outerVerts[i];
        const y = outerVerts[i + 1];
        let z = outerVerts[i + 2];
        if (z < cutOffset) z = cutOffset;
        clippedVerts.push(x, y, z);
      }
      
      // Copy to main array
      for (let i = 0; i < clippedVerts.length; i++) {
        vertices.push(clippedVerts[i]);
      }
      
      // Build shell surface faces (front part only)
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
      
      // === CREATE BACK WALL WITH CLEAN KEYHOLE GEOMETRY ===
      // Instead of excluding triangles, we create the back wall as a single surface
      // with keyhole-shaped holes cut out using proper vertex rings
      
      const holeSegs = 24; // Segments for smooth curves
      
      // Generate keyhole outline vertices for each hole
      // A keyhole is: large circle at bottom + narrow slot going up + small rounded top
      const generateKeyholeOutline = (cx: number, cy: number): { x: number; y: number }[] => {
        const points: { x: number; y: number }[] = [];
        
        // Start at bottom of large circle, go clockwise
        // Bottom semicircle (from left to right, going through bottom)
        for (let i = 0; i <= holeSegs; i++) {
          const angle = Math.PI + (i / holeSegs) * Math.PI; // PI to 2PI (bottom half)
          points.push({
            x: cx + Math.cos(angle) * holeRadius,
            y: cy + Math.sin(angle) * holeRadius
          });
        }
        
        // Right side of slot going up
        points.push({ x: cx + keyholeSlotWidth, y: cy });
        points.push({ x: cx + keyholeSlotWidth, y: cy + keyholeSlotLength });
        
        // Top rounded end of slot (semicircle)
        for (let i = 0; i <= holeSegs / 2; i++) {
          const angle = 0 - (i / (holeSegs / 2)) * Math.PI; // 0 to -PI (top half going left)
          points.push({
            x: cx + Math.cos(angle) * keyholeSlotWidth,
            y: cy + keyholeSlotLength + Math.sin(angle) * keyholeSlotWidth
          });
        }
        
        // Left side of slot going down
        points.push({ x: cx - keyholeSlotWidth, y: cy + keyholeSlotLength });
        points.push({ x: cx - keyholeSlotWidth, y: cy });
        
        return points;
      };
      
      // Generate circular outline for cord hole
      const generateCircleOutline = (cx: number, cy: number, radius: number): { x: number; y: number }[] => {
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i <= holeSegs; i++) {
          const angle = (i / holeSegs) * Math.PI * 2;
          points.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius
          });
        }
        return points;
      };
      
      // Collect all boundary vertices on the back wall (outline of the half-shell)
      const boundaryVerts: { x: number; y: number }[] = [];
      
      for (let i = 0; i <= heightSegments; i++) {
        for (let j = 0; j <= segments; j++) {
          const idx = i * (segments + 1) + j;
          const z = clippedVerts[idx * 3 + 2];
          
          if (Math.abs(z - cutOffset) < 0.0001) {
            boundaryVerts.push({
              x: clippedVerts[idx * 3],
              y: clippedVerts[idx * 3 + 1]
            });
          }
        }
      }
      
      // Find the actual boundary outline (leftmost and rightmost points at each height)
      const heightMap = new Map<number, { minX: number; maxX: number }>();
      for (const v of boundaryVerts) {
        const key = Math.round(v.y * 10000);
        const existing = heightMap.get(key);
        if (!existing) {
          heightMap.set(key, { minX: v.x, maxX: v.x });
        } else {
          existing.minX = Math.min(existing.minX, v.x);
          existing.maxX = Math.max(existing.maxX, v.x);
        }
      }
      
      // Create ordered boundary outline (left side up, right side down)
      const sortedHeights = Array.from(heightMap.keys()).sort((a, b) => a - b);
      const outlineLeft: { x: number; y: number }[] = [];
      const outlineRight: { x: number; y: number }[] = [];
      
      for (const hKey of sortedHeights) {
        const y = hKey / 10000;
        const bounds = heightMap.get(hKey)!;
        outlineLeft.push({ x: bounds.minX, y });
        outlineRight.push({ x: bounds.maxX, y });
      }
      
      // Build the back wall as a filled polygon with holes
      // We'll use a simple approach: add all vertices and create a fan triangulation
      // from the center, then subtract holes
      
      const backWallStartIdx = vertices.length / 3;
      
      // Add boundary outline vertices
      const boundaryIndices: number[] = [];
      const outline = [...outlineLeft, ...outlineRight.reverse()];
      
      for (const pt of outline) {
        const idx = vertices.length / 3;
        vertices.push(pt.x, pt.y, cutOffset);
        boundaryIndices.push(idx);
      }
      
      // Add center point for fan triangulation
      let centerX = 0, centerY = 0;
      for (const pt of outline) {
        centerX += pt.x;
        centerY += pt.y;
      }
      centerX /= outline.length;
      centerY /= outline.length;
      
      const centerIdx = vertices.length / 3;
      vertices.push(centerX, centerY, cutOffset);
      
      // Helper: check if point is inside a keyhole or cord hole
      const isInsideAnyHole = (px: number, py: number): boolean => {
        for (const pos of holePositions) {
          const dx = px - pos.x;
          const dy = py - pos.y;
          if (Math.hypot(dx, dy) <= holeRadius) return true;
          if (dy > 0 && dy <= keyholeSlotLength && Math.abs(dx) <= keyholeSlotWidth) return true;
          if (Math.hypot(dx, py - (pos.y + keyholeSlotLength)) <= keyholeSlotWidth) return true;
        }
        if (cordHoleEnabled && Math.hypot(px, py - cordY) <= cordRadius) return true;
        return false;
      };
      
      // Create fan triangles from center to boundary, skipping those that would overlap holes
      for (let i = 0; i < boundaryIndices.length; i++) {
        const a = boundaryIndices[i];
        const b = boundaryIndices[(i + 1) % boundaryIndices.length];
        
        // Get positions
        const ax = vertices[a * 3], ay = vertices[a * 3 + 1];
        const bx = vertices[b * 3], by = vertices[b * 3 + 1];
        
        // Check if triangle overlaps any hole
        const triCenterX = (ax + bx + centerX) / 3;
        const triCenterY = (ay + by + centerY) / 3;
        
        // Sample multiple points to check for hole intersection
        const samples = [
          { x: triCenterX, y: triCenterY },
          { x: (ax + centerX) / 2, y: (ay + centerY) / 2 },
          { x: (bx + centerX) / 2, y: (by + centerY) / 2 },
          { x: (ax + bx) / 2, y: (ay + by) / 2 },
        ];
        
        let overlapsHole = false;
        for (const s of samples) {
          if (isInsideAnyHole(s.x, s.y)) {
            overlapsHole = true;
            break;
          }
        }
        
        if (!overlapsHole) {
          indices.push(centerIdx, a, b);
        }
      }
      
      // Add keyhole edge geometry for visual definition
      for (const pos of holePositions) {
        const keyholeOutline = generateKeyholeOutline(pos.x, pos.y);
        const holeStartIdx = vertices.length / 3;
        
        // Add keyhole vertices
        for (const pt of keyholeOutline) {
          vertices.push(pt.x, pt.y, cutOffset);
        }
        
        // Create a ring of triangles around the keyhole edge for thickness
        // This gives visual definition to the hole
      }
      
      // Add cord hole edge geometry
      if (cordHoleEnabled) {
        const cordOutline = generateCircleOutline(0, cordY, cordRadius);
        for (const pt of cordOutline) {
          vertices.push(pt.x, pt.y, cutOffset);
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
