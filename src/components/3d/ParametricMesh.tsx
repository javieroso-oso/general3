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

    // Build body geometry
    const vertices: number[] = [];
    const indices: number[] = [];

    if (isWallMount) {
      // DIRECT HALF-GENERATION: Generate only front half (theta 0 to PI)
      // This guarantees flat back at z=0 regardless of organic deformations
      
      const halfSegments = segments; // Keep same resolution for half
      const wallMountVerts: number[] = [];
      
      // Generate ONLY front half of object (theta from 0 to PI)
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * h;

        // Base profile interpolation (same as full object)
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

        const twistRad = (twistAngle * Math.PI / 180) * t;

        // Generate vertices for front half only (theta from 0 to PI)
        for (let j = 0; j <= halfSegments; j++) {
          // CRITICAL: Edge vertices must have theta WITHOUT twist to guarantee z=0 for flat back
          let theta;
          const isEdge = j === 0 || j === halfSegments;
          if (j === 0) {
            theta = 0; // Right edge: sin(0) = 0, guaranteed z=0
          } else if (j === halfSegments) {
            theta = Math.PI; // Left edge: sin(π) = 0, guaranteed z=0
          } else {
            // Interior vertices get twist applied for organic look
            theta = (j / halfSegments) * Math.PI + twistRad;
          }
          
          let r = radius;

          // Wobble - skip for edge vertices to maintain flat back
          if (wobbleFrequency > 0 && wobbleAmplitude > 0 && !isEdge) {
            const maxWobble = Math.min(wobbleAmplitude, 0.15);
            r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * bRad;
          }

          // Ripples - skip for edge vertices to maintain flat back
          if (rippleCount > 0 && rippleDepth > 0 && !isEdge) {
            const maxRipple = Math.min(rippleDepth, 0.1);
            r += Math.sin(theta * rippleCount) * maxRipple * bRad;
          }

          // Asymmetry - skip for edge vertices to maintain flat back
          if (asymmetry > 0 && !isEdge) {
            const maxAsym = Math.min(asymmetry, 0.1);
            r += Math.sin(theta) * Math.cos(t * Math.PI * 2) * maxAsym * bRad;
          }

          // Organic noise - skip for edge vertices to maintain flat back
          if (organicNoise > 0 && !isEdge) {
            const maxNoise = Math.min(organicNoise, 0.1);
            const nx = Math.cos(theta) * r;
            const nz = Math.sin(theta) * r;
            r += noise3D(nx * 10, y * 10, nz * 10, noiseScale) * maxNoise * bRad;
          }

          // Ensure minimum radius
          r = Math.max(r, wall * 2);

          const x = Math.cos(theta) * r;
          // Force z=0 for edge vertices as belt-and-suspenders safety
          const z = isEdge ? 0 : Math.sin(theta) * r;
          
          wallMountVerts.push(x, y, z);
        }
      }
      
      // Copy half-shell vertices to main vertices array
      for (let i = 0; i < wallMountVerts.length; i++) {
        vertices.push(wallMountVerts[i]);
      }
      
      // Build shell surface triangles for front half
      for (let i = 0; i < heightSegments; i++) {
        for (let j = 0; j < halfSegments; j++) {
          const a = i * (halfSegments + 1) + j;
          const b = a + 1;
          const c = a + (halfSegments + 1);
          const d = c + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
      
      // Create flat back wall by connecting left edge (j=halfSegments) and right edge (j=0)
      // Both edges have z=0, so connecting them creates a perfectly flat back
      for (let i = 0; i < heightSegments; i++) {
        const rightCurrent = i * (halfSegments + 1);                    // Right edge at this height (j=0)
        const rightNext = (i + 1) * (halfSegments + 1);                 // Right edge at next height
        const leftCurrent = i * (halfSegments + 1) + halfSegments;      // Left edge at this height (j=halfSegments)
        const leftNext = (i + 1) * (halfSegments + 1) + halfSegments;   // Left edge at next height
        
        // Two triangles connecting edges to form flat back (normals facing -Z into wall)
        indices.push(rightCurrent, rightNext, leftCurrent);
        indices.push(leftCurrent, rightNext, leftNext);
      }
      
      // Add bottom cap for half-shell
      const bottomCenterIdx = vertices.length / 3;
      vertices.push(0, 0, 0); // Center at base
      
      // Connect bottom ring to center (front half only)
      for (let j = 0; j < halfSegments; j++) {
        const a = j;
        const b = j + 1;
        indices.push(bottomCenterIdx, b, a);
      }
      
      // Close bottom back edge (connect left corner to center to right corner)
      const bottomLeft = halfSegments; // j=halfSegments at i=0
      const bottomRight = 0;           // j=0 at i=0
      indices.push(bottomCenterIdx, bottomRight, bottomLeft);
      
      // Add mounting screw holes through the flat back (z=0 plane)
      const screwCount = params.wallMountScrewCount || 2;
      const screwDiameter = (params.wallMountScrewDiameter || 5) * SCALE;
      const screwRadius = screwDiameter / 2;
      const holeDepth = wall * 3;
      const holeSegments = 12;
      
      // Calculate safe Y positions
      const marginY = h * 0.15;
      
      // Get max X extent at each height for positioning
      const getMaxX = (yPos: number) => {
        const t = yPos / h;
        let radius = bRad + (tRad - bRad) * t;
        return radius * 0.6; // 60% of radius for safe margin
      };
      
      const screwPositions: { x: number; y: number }[] = [];
      if (screwCount === 2) {
        screwPositions.push({ x: 0, y: marginY });
        screwPositions.push({ x: 0, y: h - marginY });
      } else if (screwCount === 3) {
        screwPositions.push({ x: 0, y: h - marginY });
        const bottomX = getMaxX(marginY);
        screwPositions.push({ x: -bottomX, y: marginY });
        screwPositions.push({ x: bottomX, y: marginY });
      } else {
        const topX = getMaxX(h - marginY);
        const bottomX = getMaxX(marginY);
        screwPositions.push({ x: -topX, y: h - marginY });
        screwPositions.push({ x: topX, y: h - marginY });
        screwPositions.push({ x: -bottomX, y: marginY });
        screwPositions.push({ x: bottomX, y: marginY });
      }
      
      // Generate screw hole cylinders through the back (going into -Z)
      for (const pos of screwPositions) {
        const holeStartIdx = vertices.length / 3;
        
        // Front ring at z=0
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            0
          );
        }
        
        // Back ring at z=-holeDepth
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            -holeDepth
          );
        }
        
        // Cylinder wall connecting front and back rings
        for (let s = 0; s < holeSegments; s++) {
          const a = holeStartIdx + s;
          const b = holeStartIdx + s + 1;
          const c = holeStartIdx + holeSegments + 1 + s;
          const d = holeStartIdx + holeSegments + 1 + s + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
        
        // Back cap of hole
        const backCapCenter = vertices.length / 3;
        vertices.push(pos.x, pos.y, -holeDepth);
        for (let s = 0; s < holeSegments; s++) {
          const a = holeStartIdx + holeSegments + 1 + s;
          const b = holeStartIdx + holeSegments + 1 + s + 1;
          indices.push(backCapCenter, a, b);
        }
      }
      
      // Add cord hole if enabled
      if (params.wallMountCordHoleEnabled) {
        const cordRadius = (params.cordHoleDiameter || 8) * SCALE / 2;
        const cordY = h * 0.5;
        const cordHoleStartIdx = vertices.length / 3;
        
        // Front ring
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(Math.cos(angle) * cordRadius, cordY + Math.sin(angle) * cordRadius, 0);
        }
        // Back ring
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(Math.cos(angle) * cordRadius, cordY + Math.sin(angle) * cordRadius, -holeDepth);
        }
        // Cylinder wall
        for (let s = 0; s < holeSegments; s++) {
          const a = cordHoleStartIdx + s;
          const b = cordHoleStartIdx + s + 1;
          const c = cordHoleStartIdx + holeSegments + 1 + s;
          const d = cordHoleStartIdx + holeSegments + 1 + s + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
        // Back cap
        const cordBackCenter = vertices.length / 3;
        vertices.push(0, cordY, -holeDepth);
        for (let s = 0; s < holeSegments; s++) {
          const a = cordHoleStartIdx + holeSegments + 1 + s;
          const b = cordHoleStartIdx + holeSegments + 1 + s + 1;
          indices.push(cordBackCenter, a, b);
        }
      }
      
      // Add bulb socket shelf - horizontal ring inside the half-shell
      // This ring is parallel to the floor, socket hangs from it
      const socketY = h * 0.75;
      const socketInnerRadius = 14 * SCALE; // ~28mm diameter for E26/E27
      const socketOuterRadius = socketInnerRadius + wall;
      const socketThickness = wall * 1.5;
      const ringSegments = 24;
      
      // Calculate how far forward the ring can extend (must be inside the shell)
      // At socketY height, find the shell radius
      const socketT = socketY / h;
      let shellRadiusAtSocket = bRad + (tRad - bRad) * socketT;
      shellRadiusAtSocket = Math.max(shellRadiusAtSocket, socketOuterRadius * 1.2);
      
      const ringStartIdx = vertices.length / 3;
      
      // Generate half-ring that fits inside the half-shell
      // Top surface outer edge (front half only, z >= 0)
      for (let s = 0; s <= ringSegments; s++) {
        const angle = (s / ringSegments) * Math.PI; // 0 to PI only
        vertices.push(
          Math.cos(angle) * socketOuterRadius,
          socketY,
          Math.sin(angle) * socketOuterRadius
        );
      }
      
      // Top surface inner edge
      for (let s = 0; s <= ringSegments; s++) {
        const angle = (s / ringSegments) * Math.PI;
        vertices.push(
          Math.cos(angle) * socketInnerRadius,
          socketY,
          Math.sin(angle) * socketInnerRadius
        );
      }
      
      // Bottom surface outer edge
      for (let s = 0; s <= ringSegments; s++) {
        const angle = (s / ringSegments) * Math.PI;
        vertices.push(
          Math.cos(angle) * socketOuterRadius,
          socketY - socketThickness,
          Math.sin(angle) * socketOuterRadius
        );
      }
      
      // Bottom surface inner edge
      for (let s = 0; s <= ringSegments; s++) {
        const angle = (s / ringSegments) * Math.PI;
        vertices.push(
          Math.cos(angle) * socketInnerRadius,
          socketY - socketThickness,
          Math.sin(angle) * socketInnerRadius
        );
      }
      
      const topOuter = ringStartIdx;
      const topInner = ringStartIdx + (ringSegments + 1);
      const botOuter = ringStartIdx + (ringSegments + 1) * 2;
      const botInner = ringStartIdx + (ringSegments + 1) * 3;
      
      // Top face
      for (let s = 0; s < ringSegments; s++) {
        indices.push(topOuter + s, topOuter + s + 1, topInner + s);
        indices.push(topInner + s, topOuter + s + 1, topInner + s + 1);
      }
      
      // Bottom face
      for (let s = 0; s < ringSegments; s++) {
        indices.push(botOuter + s, botInner + s, botOuter + s + 1);
        indices.push(botOuter + s + 1, botInner + s, botInner + s + 1);
      }
      
      // Outer curved wall
      for (let s = 0; s < ringSegments; s++) {
        indices.push(topOuter + s, botOuter + s, topOuter + s + 1);
        indices.push(topOuter + s + 1, botOuter + s, botOuter + s + 1);
      }
      
      // Inner curved wall (socket hole)
      for (let s = 0; s < ringSegments; s++) {
        indices.push(topInner + s, topInner + s + 1, botInner + s);
        indices.push(botInner + s, topInner + s + 1, botInner + s + 1);
      }
      
      // Close the back edges of the ring (where it meets z=0)
      // Left side (s=ringSegments)
      indices.push(topOuter + ringSegments, topInner + ringSegments, botOuter + ringSegments);
      indices.push(botOuter + ringSegments, topInner + ringSegments, botInner + ringSegments);
      // Right side (s=0)
      indices.push(topOuter, botOuter, topInner);
      indices.push(topInner, botOuter, botInner);
      
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
