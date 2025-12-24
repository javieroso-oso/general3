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
      // Wall mount: clip at z = cutOffset, create flat back wall with proper circular holes
      
      const holeCount = params.wallMountHoleCount || 2;
      const holeDiameter = (params.wallMountHoleDiameter || 5) * SCALE;
      const holeRadius = holeDiameter / 2;
      const holeMargin = params.wallMountHoleMargin || 0.15;
      const holeStyle = params.wallMountHoleStyle || 'round';
      
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
      
      // Keyhole dimensions
      const keyholeSlotLength = holeRadius * 2;
      const keyholeSlotWidth = holeRadius * 0.5;
      
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
      
      // === CREATE BACK WALL WITH PROPER CIRCULAR HOLES ===
      // We'll create a dense grid on the back wall and properly triangulate around holes
      
      // Find bounds of the back wall
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i <= heightSegments; i++) {
        for (let j = 0; j <= segments; j++) {
          const idx = i * (segments + 1) + j;
          const z = clippedVerts[idx * 3 + 2];
          if (Math.abs(z - cutOffset) < 0.0001) {
            const x = clippedVerts[idx * 3];
            const y = clippedVerts[idx * 3 + 1];
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      
      // Generate a grid of points for the back wall
      const gridResX = 40;
      const gridResY = 40;
      const holeSegs = 24; // Segments for circular holes
      
      // Helper: check if point is inside the object boundary at given height
      const getRadiusAtHeight = (y: number): number => {
        const t = Math.min(1, Math.max(0, y / h));
        const heightIdx = Math.round(t * heightSegments);
        return radiiAtHeight[heightIdx] || bRad;
      };
      
      // Helper: check if point is inside any hole (with proper keyhole/countersink shapes)
      const isInsideHole = (px: number, py: number): { inside: boolean; holeIdx: number } => {
        // Check mounting holes
        for (let hi = 0; hi < holePositions.length; hi++) {
          const pos = holePositions[hi];
          const dx = px - pos.x;
          const dy = py - pos.y;
          
          if (holeStyle === 'keyhole') {
            // Keyhole: large circle at bottom + narrow slot extending upward
            if (Math.hypot(dx, dy) < holeRadius) {
              return { inside: true, holeIdx: hi };
            }
            // Slot extends upward
            if (dy > 0 && dy < keyholeSlotLength && Math.abs(dx) < keyholeSlotWidth) {
              return { inside: true, holeIdx: hi };
            }
          } else {
            // Round or countersink - circular
            if (Math.hypot(dx, dy) < holeRadius) {
              return { inside: true, holeIdx: hi };
            }
          }
        }
        // Check cord hole
        if (cordHoleEnabled && Math.hypot(px, py - cordY) < cordRadius) {
          return { inside: true, holeIdx: -1 }; // -1 for cord hole
        }
        return { inside: false, holeIdx: -1 };
      };
      
      // Create vertices for back wall grid (only points inside object and outside holes)
      const backWallStartIdx = vertices.length / 3;
      const gridPoints: { x: number; y: number; idx: number; valid: boolean }[][] = [];
      
      for (let gy = 0; gy <= gridResY; gy++) {
        const row: { x: number; y: number; idx: number; valid: boolean }[] = [];
        const py = minY + (maxY - minY) * (gy / gridResY);
        const radiusAtY = getRadiusAtHeight(py);
        
        for (let gx = 0; gx <= gridResX; gx++) {
          const px = minX + (maxX - minX) * (gx / gridResX);
          
          // Check if inside object boundary (semi-circle)
          const insideBoundary = px >= -radiusAtY * 1.1 && px <= radiusAtY * 1.1;
          const { inside: insideHole } = isInsideHole(px, py);
          
          if (insideBoundary && !insideHole) {
            const idx = vertices.length / 3;
            vertices.push(px, py, cutOffset);
            row.push({ x: px, y: py, idx, valid: true });
          } else {
            row.push({ x: px, y: py, idx: -1, valid: false });
          }
        }
        gridPoints.push(row);
      }
      
      // Add circular hole edge vertices for smooth holes
      const holeEdgeStarts: number[] = [];
      
      // Mounting holes
      for (let hi = 0; hi < holePositions.length; hi++) {
        const pos = holePositions[hi];
        const startIdx = vertices.length / 3;
        holeEdgeStarts.push(startIdx);
        
        if (holeStyle === 'keyhole') {
          // Keyhole shape: circle + slot
          // Bottom circle arc (180 degrees at bottom)
          for (let s = 0; s <= holeSegs; s++) {
            const angle = Math.PI + (s / holeSegs) * Math.PI; // Bottom half
            const x = pos.x + Math.cos(angle) * holeRadius;
            const y = pos.y + Math.sin(angle) * holeRadius;
            vertices.push(x, y, cutOffset);
          }
          // Slot sides going up
          const slotTop = pos.y + keyholeSlotLength;
          vertices.push(pos.x - keyholeSlotWidth, pos.y, cutOffset);
          vertices.push(pos.x - keyholeSlotWidth, slotTop, cutOffset);
          // Top arc
          for (let s = 0; s <= holeSegs / 2; s++) {
            const angle = Math.PI + (s / (holeSegs / 2)) * Math.PI;
            const x = pos.x + Math.cos(angle) * keyholeSlotWidth;
            const y = slotTop + Math.sin(angle) * keyholeSlotWidth;
            vertices.push(x, y, cutOffset);
          }
          vertices.push(pos.x + keyholeSlotWidth, slotTop, cutOffset);
          vertices.push(pos.x + keyholeSlotWidth, pos.y, cutOffset);
        } else if (holeStyle === 'countersink') {
          // Countersink: add outer ring for chamfer visualization
          // Outer edge (larger circle for countersink effect)
          const outerRadius = holeRadius * 1.4;
          for (let s = 0; s <= holeSegs; s++) {
            const angle = (s / holeSegs) * Math.PI * 2;
            const x = pos.x + Math.cos(angle) * outerRadius;
            const y = pos.y + Math.sin(angle) * outerRadius;
            vertices.push(x, y, cutOffset);
          }
          // Inner edge
          for (let s = 0; s <= holeSegs; s++) {
            const angle = (s / holeSegs) * Math.PI * 2;
            const x = pos.x + Math.cos(angle) * holeRadius;
            const y = pos.y + Math.sin(angle) * holeRadius;
            vertices.push(x, y, cutOffset);
          }
        } else {
          // Round hole - simple circle
          for (let s = 0; s <= holeSegs; s++) {
            const angle = (s / holeSegs) * Math.PI * 2;
            const x = pos.x + Math.cos(angle) * holeRadius;
            const y = pos.y + Math.sin(angle) * holeRadius;
            vertices.push(x, y, cutOffset);
          }
        }
      }
      
      // Cord hole edge
      if (cordHoleEnabled) {
        const cordEdgeStart = vertices.length / 3;
        holeEdgeStarts.push(cordEdgeStart);
        for (let s = 0; s <= holeSegs; s++) {
          const angle = (s / holeSegs) * Math.PI * 2;
          const x = Math.cos(angle) * cordRadius;
          const y = cordY + Math.sin(angle) * cordRadius;
          vertices.push(x, y, cutOffset);
        }
      }
      
      // Triangulate back wall grid
      for (let gy = 0; gy < gridResY; gy++) {
        for (let gx = 0; gx < gridResX; gx++) {
          const bl = gridPoints[gy][gx];
          const br = gridPoints[gy][gx + 1];
          const tl = gridPoints[gy + 1][gx];
          const tr = gridPoints[gy + 1][gx + 1];
          
          // Only create triangles where all vertices are valid
          if (bl.valid && br.valid && tl.valid) {
            indices.push(bl.idx, tl.idx, br.idx);
          }
          if (br.valid && tl.valid && tr.valid) {
            indices.push(br.idx, tl.idx, tr.idx);
          }
        }
      }
      
      // Connect grid to hole edges for smooth transition (simplified - holes will appear as gaps)
      // The grid already excludes hole interiors, creating clean hole boundaries
      
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
