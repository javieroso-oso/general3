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

  const { bodyGeometry, wireframeGeo, legGeometry, overhangColors, keyholeGeometries, cordHoleGeometry } = useMemo(() => {
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

    // Helper function to create keyhole geometry for visual rendering
    const createKeyholeVisual = (cx: number, cy: number, zPos: number): THREE.BufferGeometry => {
      const segs = 32;
      const headRadius = 5 * SCALE;    // 5mm head
      const shaftWidth = 2.5 * SCALE;  // 2.5mm slot width
      const slotLength = 10 * SCALE;   // 10mm slot length
      const depth = 0.5 * SCALE;       // 0.5mm visual depth
      
      // Create 2D keyhole shape
      const shape = new THREE.Shape();
      
      // Start at bottom of head circle
      for (let i = 0; i <= segs / 2; i++) {
        const angle = Math.PI + (i / (segs / 2)) * Math.PI;
        const x = Math.cos(angle) * headRadius;
        const y = Math.sin(angle) * headRadius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      
      // Right side of slot
      shape.lineTo(shaftWidth, 0);
      shape.lineTo(shaftWidth, slotLength - shaftWidth);
      
      // Top of slot
      for (let i = 0; i <= segs / 4; i++) {
        const angle = 0 - (i / (segs / 4)) * Math.PI;
        shape.lineTo(
          Math.cos(angle) * shaftWidth,
          slotLength - shaftWidth + Math.sin(angle) * shaftWidth + shaftWidth
        );
      }
      
      // Left side
      shape.lineTo(-shaftWidth, slotLength - shaftWidth);
      shape.lineTo(-shaftWidth, 0);
      shape.closePath();
      
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: depth,
        bevelEnabled: false,
      });
      geo.translate(cx, cy, zPos);
      return geo;
    };
    
    // Helper to create circular hole visual
    const createCircleVisual = (cx: number, cy: number, radius: number, zPos: number): THREE.BufferGeometry => {
      const geo = new THREE.CylinderGeometry(radius, radius, 0.5 * SCALE, 32);
      geo.rotateX(Math.PI / 2);
      geo.translate(cx, cy, zPos + 0.25 * SCALE);
      return geo;
    };

    // Store visual keyhole geometries for wall mount
    let keyholeGeometries: THREE.BufferGeometry[] = [];
    let cordHoleGeometry: THREE.BufferGeometry | null = null;

    if (isWallMount) {
      // Wall mount: clip at z = cutOffset, create proper back wall
      
      // Calculate keyhole positions
      const holeCount = params.wallMountHoleCount || 2;
      const holeMargin = params.wallMountHoleMargin || 0.15;
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
      
      // Create visual keyhole geometries
      for (const pos of holePositions) {
        keyholeGeometries.push(createKeyholeVisual(pos.x, pos.y, cutOffset));
      }
      
      // Create cord hole visual if enabled
      if (params.wallMountCordHoleEnabled) {
        const cordRadius = (params.cordHoleDiameter || 8) * SCALE / 2;
        const cordY = h * 0.5;
        cordHoleGeometry = createCircleVisual(0, cordY, cordRadius, cutOffset);
      }
      
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
      
      // === CREATE BACK WALL FROM CLIPPED SHELL BOUNDARY ===
      // Scan actual clipped vertices at the cut plane to get the real boundary
      // (includes all deformations: wobble, ripple, asymmetry, organic noise)
      const boundaryByHeight = new Map<number, { minX: number; maxX: number }>();
      
      for (let i = 0; i <= heightSegments; i++) {
        for (let j = 0; j <= segments; j++) {
          const idx = i * (segments + 1) + j;
          const x = clippedVerts[idx * 3];
          const y = clippedVerts[idx * 3 + 1];
          const z = clippedVerts[idx * 3 + 2];
          
          // Only consider vertices that are AT the cut plane (z = cutOffset)
          if (Math.abs(z - cutOffset) < 0.001) {
            // Use height segment index as key for reliable ordering
            const existing = boundaryByHeight.get(i);
            if (!existing) {
              boundaryByHeight.set(i, { minX: x, maxX: x });
            } else {
              existing.minX = Math.min(existing.minX, x);
              existing.maxX = Math.max(existing.maxX, x);
            }
          }
        }
      }
      
      // Build left and right edges from actual clipped boundary
      const leftEdge: { x: number; y: number }[] = [];
      const rightEdge: { x: number; y: number }[] = [];
      
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * h;
        const bounds = boundaryByHeight.get(i);
        
        if (bounds) {
          leftEdge.push({ x: bounds.minX, y });
          rightEdge.push({ x: bounds.maxX, y });
        } else {
          // Fallback to radiiAtHeight if no clipped vertices found at this height
          const radius = radiiAtHeight[i];
          leftEdge.push({ x: -radius, y });
          rightEdge.push({ x: radius, y });
        }
      }
      
      // Build outline: left edge going up, then right edge going down
      const outline = [...leftEdge, ...rightEdge.reverse()];
      
      // Add back wall vertices
      const backWallStartIdx = vertices.length / 3;
      for (const pt of outline) {
        vertices.push(pt.x, pt.y, cutOffset);
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
      
      // Create fan triangles from center to boundary
      for (let i = 0; i < outline.length; i++) {
        const a = backWallStartIdx + i;
        const b = backWallStartIdx + ((i + 1) % outline.length);
        indices.push(centerIdx, a, b);
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

    return { 
      bodyGeometry: bodyGeo, 
      wireframeGeo: wireGeo, 
      legGeometry: standGeo, 
      overhangColors: overhangColorArray,
      keyholeGeometries,
      cordHoleGeometry
    };
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
      
      {/* Keyhole mounting holes for wall mount (visual) */}
      {keyholeGeometries.map((geo, idx) => (
        <mesh key={`keyhole-${idx}`} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial
            color="#1a1a1a"
            roughness={0.8}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      
      {/* Cord hole for wall mount (visual) */}
      {cordHoleGeometry && (
        <mesh geometry={cordHoleGeometry} castShadow receiveShadow>
          <meshStandardMaterial
            color="#1a1a1a"
            roughness={0.8}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {showWireframe && (
        <lineSegments geometry={wireframeGeo}>
          <lineBasicMaterial color="#3b82f6" opacity={0.3} transparent />
        </lineSegments>
      )}
    </group>
  );
};

export default ParametricMesh;
