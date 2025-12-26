import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
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

    // Helper function to create a solid keyhole cylinder for CSG subtraction
    const createKeyholeShape = (cx: number, cy: number, zPos: number, depth: number): THREE.BufferGeometry => {
      const segs = 32;
      const headRadius = 5 * SCALE;    // 5mm head
      const shaftWidth = 2.5 * SCALE;  // 2.5mm slot width
      const slotLength = 10 * SCALE;   // 10mm slot length
      
      // Create 2D keyhole shape
      const shape = new THREE.Shape();
      
      // Start at bottom left of head circle, go clockwise
      // Bottom semicircle of head (large circle)
      for (let i = 0; i <= segs / 2; i++) {
        const angle = Math.PI + (i / (segs / 2)) * Math.PI;
        const x = cx + Math.cos(angle) * headRadius;
        const y = cy + Math.sin(angle) * headRadius;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      
      // Right side going up into slot
      shape.lineTo(cx + shaftWidth, cy);
      shape.lineTo(cx + shaftWidth, cy + slotLength - shaftWidth);
      
      // Top semicircle of slot
      for (let i = 0; i <= segs / 4; i++) {
        const angle = 0 - (i / (segs / 4)) * Math.PI;
        shape.lineTo(
          cx + Math.cos(angle) * shaftWidth,
          cy + slotLength - shaftWidth + Math.sin(angle) * shaftWidth + shaftWidth
        );
      }
      
      // Left side going down
      shape.lineTo(cx - shaftWidth, cy + slotLength - shaftWidth);
      shape.lineTo(cx - shaftWidth, cy);
      
      // Close back to start
      shape.closePath();
      
      // Extrude in Z direction
      const extrudeSettings = {
        depth: depth * 2,
        bevelEnabled: false,
      };
      
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      // Position so it's centered on zPos
      geo.translate(0, 0, zPos - depth);
      return geo;
    };
    
    // Helper to create circular hole for CSG subtraction
    const createCircleHole = (cx: number, cy: number, radius: number, zPos: number, depth: number): THREE.BufferGeometry => {
      const geo = new THREE.CylinderGeometry(radius, radius, depth * 2, 32);
      geo.rotateX(Math.PI / 2); // Orient along Z axis
      geo.translate(cx, cy, zPos);
      return geo;
    };

    // Store keyhole geometries for wall mount
    let keyholeGeometries: THREE.BufferGeometry[] = [];
    let cordHoleGeometry: THREE.BufferGeometry | null = null;

    if (isWallMount) {
      // Wall mount: clip at z = cutOffset, create back wall with CSG holes
      
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
      
      // === CREATE BACK WALL FROM ACTUAL CLIPPED SHELL BOUNDARY ===
      // Collect boundary vertices from the clipped shell
      const boundaryPoints: { x: number; y: number }[] = [];
      
      for (let i = 0; i <= heightSegments; i++) {
        for (let j = 0; j <= segments; j++) {
          const idx = i * (segments + 1) + j;
          const z = clippedVerts[idx * 3 + 2];
          
          if (Math.abs(z - cutOffset) < 0.0001) {
            const x = clippedVerts[idx * 3];
            const y = clippedVerts[idx * 3 + 1];
            boundaryPoints.push({ x, y });
          }
        }
      }
      
      // Find convex hull of boundary points for a clean back wall
      const sortedByAngle = boundaryPoints.slice().sort((a, b) => {
        const angleA = Math.atan2(a.y - h/2, a.x);
        const angleB = Math.atan2(b.y - h/2, b.x);
        return angleA - angleB;
      });
      
      // Remove duplicate points (keep unique by rounding)
      const uniquePoints: { x: number; y: number }[] = [];
      const seen = new Set<string>();
      for (const pt of sortedByAngle) {
        const key = `${Math.round(pt.x * 1000)},${Math.round(pt.y * 1000)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePoints.push(pt);
        }
      }
      
      // Create back wall geometry using Shape + ExtrudeGeometry for CSG compatibility
      const backShape = new THREE.Shape();
      if (uniquePoints.length > 2) {
        backShape.moveTo(uniquePoints[0].x, uniquePoints[0].y);
        for (let i = 1; i < uniquePoints.length; i++) {
          backShape.lineTo(uniquePoints[i].x, uniquePoints[i].y);
        }
        backShape.closePath();
      }
      
      const wallThickness = 3 * SCALE; // 3mm thick back wall
      const backWallGeo = new THREE.ExtrudeGeometry(backShape, {
        depth: wallThickness,
        bevelEnabled: false,
      });
      backWallGeo.translate(0, 0, cutOffset - wallThickness);
      
      // Create CSG evaluator
      const evaluator = new Evaluator();
      evaluator.useGroups = false;
      
      // Create brush from back wall
      let backWallBrush = new Brush(backWallGeo);
      backWallBrush.updateMatrixWorld();
      
      // Subtract each keyhole
      const holeDepth = wallThickness * 2;
      for (const pos of holePositions) {
        const keyholeGeo = createKeyholeShape(pos.x, pos.y, cutOffset - wallThickness/2, holeDepth);
        const keyholeBrush = new Brush(keyholeGeo);
        keyholeBrush.updateMatrixWorld();
        
        try {
          const result = evaluator.evaluate(backWallBrush, keyholeBrush, SUBTRACTION);
          backWallBrush = result as Brush;
          backWallBrush.updateMatrixWorld();
        } catch (e) {
          console.warn('CSG subtraction failed for keyhole:', e);
        }
      }
      
      // Subtract cord hole if enabled
      if (params.wallMountCordHoleEnabled) {
        const cordRadius = (params.cordHoleDiameter || 8) * SCALE / 2;
        const cordY = h * 0.5;
        const cordGeo = createCircleHole(0, cordY, cordRadius, cutOffset - wallThickness/2, holeDepth);
        const cordBrush = new Brush(cordGeo);
        cordBrush.updateMatrixWorld();
        
        try {
          const result = evaluator.evaluate(backWallBrush, cordBrush, SUBTRACTION);
          backWallBrush = result as Brush;
        } catch (e) {
          console.warn('CSG subtraction failed for cord hole:', e);
        }
      }
      
      // Get the final geometry with holes
      const finalBackWallGeo = backWallBrush.geometry.clone();
      
      // Merge back wall vertices and indices into main geometry
      const backWallPositions = finalBackWallGeo.getAttribute('position');
      const backWallIndex = finalBackWallGeo.getIndex();
      
      if (backWallPositions && backWallIndex) {
        const baseVertexIndex = vertices.length / 3;
        
        // Add back wall vertices
        for (let i = 0; i < backWallPositions.count; i++) {
          vertices.push(
            backWallPositions.getX(i),
            backWallPositions.getY(i),
            backWallPositions.getZ(i)
          );
        }
        
        // Add back wall indices
        for (let i = 0; i < backWallIndex.count; i++) {
          indices.push(backWallIndex.getX(i) + baseVertexIndex);
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

    return { 
      bodyGeometry: bodyGeo, 
      wireframeGeo: wireGeo, 
      legGeometry: standGeo, 
      overhangColors: overhangColorArray
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
      
      {showWireframe && (
        <lineSegments geometry={wireframeGeo}>
          <lineBasicMaterial color="#3b82f6" opacity={0.3} transparent />
        </lineSegments>
      )}
    </group>
  );
};

export default ParametricMesh;
