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
      // PLANAR CUT APPROACH: Generate half-shell with proper flat back wall
      // For a half-shell, we generate from theta = -PI/2 to PI/2 (front half)
      // The flat back is at z = cutOffset
      
      const halfSegments = Math.floor(segments / 2);
      const wallMountVerts: number[] = [];
      
      // Generate the front half of the shell (z >= cutOffset)
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * h;
        
        // Get base radius at this height (recalculate with all deformations)
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
        
        const bulgeDist = Math.abs(t - bulgePosition);
        radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * bRad;
        const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
        const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
        radius *= (1 - pinchTop - pinchBottom);
        const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
        radius += lipT * lipT * lipFlare * bRad;
        radius = Math.max(radius, printConstraints.minBaseRadius * SCALE * 0.5);
        
        const twistRad = (twistAngle * Math.PI / 180) * t;
        
        // Generate vertices from -PI/2 to PI/2 (front semicircle)
        // This naturally creates a flat back at z = 0 (or cutOffset)
        for (let j = 0; j <= halfSegments; j++) {
          // Map j to theta from -PI/2 to PI/2
          const theta = -Math.PI / 2 + (j / halfSegments) * Math.PI + twistRad;
          let r = radius;
          
          // Apply deformations
          if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
            const maxWobble = Math.min(wobbleAmplitude, 0.15);
            r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * bRad;
          }
          if (rippleCount > 0 && rippleDepth > 0) {
            const maxRipple = Math.min(rippleDepth, 0.1);
            r += Math.sin(theta * rippleCount) * maxRipple * bRad;
          }
          if (asymmetry > 0) {
            const maxAsym = Math.min(asymmetry, 0.1);
            r += Math.sin(theta) * Math.cos(t * Math.PI * 2) * maxAsym * bRad;
          }
          if (organicNoise > 0) {
            const maxNoise = Math.min(organicNoise, 0.1);
            const nx = Math.cos(theta) * r;
            const nz = Math.sin(theta) * r;
            r += noise3D(nx * 10, y * 10, nz * 10, noiseScale) * maxNoise * bRad;
          }
          r = Math.max(r, wall * 2);
          
          let x = Math.cos(theta) * r;
          let z = Math.sin(theta) * r + cutOffset; // Shift by cutOffset
          
          // Clamp z to cutOffset at edges to ensure flat back
          if (j === 0 || j === halfSegments) {
            z = cutOffset;
          }
          
          wallMountVerts.push(x, y, z);
        }
      }
      
      // Copy to main vertices array
      for (let i = 0; i < wallMountVerts.length; i++) {
        vertices.push(wallMountVerts[i]);
      }
      
      // Build shell surface indices
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
      
      // Create flat back wall by connecting left and right edges
      // Left edge is j=0, right edge is j=halfSegments
      const leftEdge: number[] = [];
      const rightEdge: number[] = [];
      for (let i = 0; i <= heightSegments; i++) {
        leftEdge.push(i * (halfSegments + 1)); // j=0
        rightEdge.push(i * (halfSegments + 1) + halfSegments); // j=halfSegments
      }
      
      // Triangulate flat back - connect left and right edges with quads
      for (let i = 0; i < heightSegments; i++) {
        const l0 = leftEdge[i];
        const l1 = leftEdge[i + 1];
        const r0 = rightEdge[i];
        const r1 = rightEdge[i + 1];
        
        // Create quad (two triangles) - winding for back-facing normal
        indices.push(l0, l1, r0);
        indices.push(r0, l1, r1);
      }
      
      // Add bottom cap for the half-shell
      const bottomCenterIdx = vertices.length / 3;
      vertices.push(0, 0, cutOffset); // Center at base, on cut plane
      for (let j = 0; j < halfSegments; j++) {
        const a = j;
        const b = j + 1;
        indices.push(bottomCenterIdx, b, a);
      }
      
      // Add mounting screw holes through the flat back
      const screwCount = params.wallMountScrewCount || 2;
      const screwDiameter = (params.wallMountScrewDiameter || 5) * SCALE;
      const screwRadius = screwDiameter / 2;
      const holeDepth = 10 * SCALE;
      
      const backHeight = h;
      const marginY = backHeight * 0.15;
      
      // Get the x-extent of the back at different heights
      const getBackWidth = (yPos: number) => {
        const t = yPos / h;
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
        return radius;
      };
      
      const screwPositions: { x: number; y: number }[] = [];
      if (screwCount === 2) {
        screwPositions.push({ x: 0, y: marginY });
        screwPositions.push({ x: 0, y: backHeight - marginY });
      } else if (screwCount === 3) {
        screwPositions.push({ x: 0, y: backHeight - marginY });
        const bottomWidth = getBackWidth(marginY) * 0.5;
        screwPositions.push({ x: -bottomWidth, y: marginY });
        screwPositions.push({ x: bottomWidth, y: marginY });
      } else {
        const topWidth = getBackWidth(backHeight - marginY) * 0.5;
        const bottomWidth = getBackWidth(marginY) * 0.5;
        screwPositions.push({ x: -topWidth, y: backHeight - marginY });
        screwPositions.push({ x: topWidth, y: backHeight - marginY });
        screwPositions.push({ x: -bottomWidth, y: marginY });
        screwPositions.push({ x: bottomWidth, y: marginY });
      }
      
      // Generate screw hole cylinders
      const holeSegments = 12;
      for (const pos of screwPositions) {
        const holeStartIdx = vertices.length / 3;
        
        // Front ring (at cut plane)
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            cutOffset + 0.001 // Slightly in front
          );
        }
        
        // Back ring
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            cutOffset - holeDepth
          );
        }
        
        // Hole wall
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
        const cordY = backHeight * 0.7;
        const cordHoleStartIdx = vertices.length / 3;
        
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(0 + Math.cos(angle) * cordRadius, cordY + Math.sin(angle) * cordRadius, cutOffset + 0.001);
        }
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(0 + Math.cos(angle) * cordRadius, cordY + Math.sin(angle) * cordRadius, cutOffset - holeDepth);
        }
        for (let s = 0; s < holeSegments; s++) {
          const a = cordHoleStartIdx + s;
          const b = cordHoleStartIdx + s + 1;
          const c = cordHoleStartIdx + holeSegments + 1 + s;
          const d = cordHoleStartIdx + holeSegments + 1 + s + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
      
      // Add bulb socket support ring inside the shell near the top
      // This is a horizontal ring that the socket can rest on
      const socketRingY = h * 0.85; // Near top
      const socketInnerRadius = 14 * SCALE; // E26 socket ~27mm, clearance
      const socketOuterRadius = socketInnerRadius + 4 * SCALE;
      const socketRingThickness = 3 * SCALE;
      const ringSegments = 16;
      
      // Only generate the front half of the ring (matching the shell)
      const ringStartIdx = vertices.length / 3;
      
      // Top inner ring
      for (let s = 0; s <= ringSegments; s++) {
        const angle = -Math.PI / 2 + (s / ringSegments) * Math.PI;
        vertices.push(
          Math.cos(angle) * socketInnerRadius,
          socketRingY + socketRingThickness / 2,
          Math.sin(angle) * socketInnerRadius + cutOffset
        );
      }
      // Top outer ring
      for (let s = 0; s <= ringSegments; s++) {
        const angle = -Math.PI / 2 + (s / ringSegments) * Math.PI;
        vertices.push(
          Math.cos(angle) * socketOuterRadius,
          socketRingY + socketRingThickness / 2,
          Math.sin(angle) * socketOuterRadius + cutOffset
        );
      }
      // Bottom inner ring
      for (let s = 0; s <= ringSegments; s++) {
        const angle = -Math.PI / 2 + (s / ringSegments) * Math.PI;
        vertices.push(
          Math.cos(angle) * socketInnerRadius,
          socketRingY - socketRingThickness / 2,
          Math.sin(angle) * socketInnerRadius + cutOffset
        );
      }
      // Bottom outer ring
      for (let s = 0; s <= ringSegments; s++) {
        const angle = -Math.PI / 2 + (s / ringSegments) * Math.PI;
        vertices.push(
          Math.cos(angle) * socketOuterRadius,
          socketRingY - socketRingThickness / 2,
          Math.sin(angle) * socketOuterRadius + cutOffset
        );
      }
      
      const topInner = ringStartIdx;
      const topOuter = ringStartIdx + (ringSegments + 1);
      const botInner = ringStartIdx + (ringSegments + 1) * 2;
      const botOuter = ringStartIdx + (ringSegments + 1) * 3;
      
      // Top face (inner to outer)
      for (let s = 0; s < ringSegments; s++) {
        indices.push(topInner + s, topOuter + s, topInner + s + 1);
        indices.push(topInner + s + 1, topOuter + s, topOuter + s + 1);
      }
      // Bottom face
      for (let s = 0; s < ringSegments; s++) {
        indices.push(botInner + s, botInner + s + 1, botOuter + s);
        indices.push(botOuter + s, botInner + s + 1, botOuter + s + 1);
      }
      // Inner wall
      for (let s = 0; s < ringSegments; s++) {
        indices.push(topInner + s, topInner + s + 1, botInner + s);
        indices.push(botInner + s, topInner + s + 1, botInner + s + 1);
      }
      // Outer wall
      for (let s = 0; s < ringSegments; s++) {
        indices.push(topOuter + s, botOuter + s, topOuter + s + 1);
        indices.push(topOuter + s + 1, botOuter + s, botOuter + s + 1);
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
