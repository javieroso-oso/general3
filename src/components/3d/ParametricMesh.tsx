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
      // TRUE PLANAR CUT: Generate full 360° object, then slice with a vertical plane at z = cutOffset
      // Step 1: Copy all vertices from full object
      const fullVerts = [...outerVerts];
      
      // Step 2: Find vertices that need to be clipped (z < cutOffset)
      // Track which vertices are on the cut plane after clipping
      const onCutPlane: boolean[] = [];
      
      for (let i = 0; i < fullVerts.length; i += 3) {
        const z = fullVerts[i + 2];
        if (z < cutOffset) {
          // Clamp z to cut plane - this creates perfectly flat back
          fullVerts[i + 2] = cutOffset;
          onCutPlane.push(true);
        } else {
          onCutPlane.push(false);
        }
      }
      
      // Step 3: Build vertices array with clipped positions
      for (let i = 0; i < fullVerts.length; i++) {
        vertices.push(fullVerts[i]);
      }
      
      // Step 4: Build surface triangles, but skip triangles entirely behind the cut
      // We need to know original z positions to determine which triangles to skip
      for (let i = 0; i < heightSegments; i++) {
        for (let j = 0; j < segments; j++) {
          const a = i * (segments + 1) + j;
          const b = a + 1;
          const c = a + (segments + 1);
          const d = c + 1;
          
          // Get original z values for the 4 vertices of this quad
          const za = outerVerts[a * 3 + 2];
          const zb = outerVerts[b * 3 + 2];
          const zc = outerVerts[c * 3 + 2];
          const zd = outerVerts[d * 3 + 2];
          
          // Skip triangles where ALL original vertices were behind the cut plane
          // These are now degenerate (all clamped to same z) or invisible
          const allBehindABC = za < cutOffset && zb < cutOffset && zc < cutOffset;
          const allBehindBCD = zb < cutOffset && zc < cutOffset && zd < cutOffset;
          
          if (!allBehindABC) {
            indices.push(a, c, b);
          }
          if (!allBehindBCD) {
            indices.push(b, c, d);
          }
        }
      }
      
      // Step 5: Create flat back wall by triangulating vertices on the cut plane
      // Collect all vertices that are on the cut plane (were clipped)
      const backVerts: { idx: number; x: number; y: number }[] = [];
      for (let v = 0; v < onCutPlane.length; v++) {
        if (onCutPlane[v]) {
          const x = vertices[v * 3];
          const y = vertices[v * 3 + 1];
          backVerts.push({ idx: v, x, y });
        }
      }
      
      // Sort by angle around center for proper triangulation
      if (backVerts.length >= 3) {
        const centerX = backVerts.reduce((s, v) => s + v.x, 0) / backVerts.length;
        const centerY = backVerts.reduce((s, v) => s + v.y, 0) / backVerts.length;
        
        backVerts.sort((a, b) => {
          const angleA = Math.atan2(a.y - centerY, a.x - centerX);
          const angleB = Math.atan2(b.y - centerY, b.x - centerX);
          return angleA - angleB;
        });
        
        // Add center point for flat back face
        const backCenterIdx = vertices.length / 3;
        vertices.push(centerX, centerY, cutOffset);
        
        // Triangulate using fan from center (winding for -Z normal)
        for (let i = 0; i < backVerts.length; i++) {
          const curr = backVerts[i].idx;
          const next = backVerts[(i + 1) % backVerts.length].idx;
          indices.push(backCenterIdx, curr, next);
        }
      }
      
      // Step 6: Add bottom cap
      const bottomCenterIdx = vertices.length / 3;
      vertices.push(0, 0, cutOffset);
      // Find bottom ring vertices (i=0) that are in front of cut plane
      for (let j = 0; j < segments; j++) {
        const a = j;
        const b = j + 1;
        const za = outerVerts[a * 3 + 2];
        const zb = outerVerts[b * 3 + 2];
        // Only add triangles for the front portion
        if (za >= cutOffset || zb >= cutOffset) {
          indices.push(bottomCenterIdx, b, a);
        }
      }
      
      // Step 7: Add mounting screw holes through the flat back
      const screwCount = params.wallMountScrewCount || 2;
      const screwDiameter = (params.wallMountScrewDiameter || 5) * SCALE;
      const screwRadius = screwDiameter / 2;
      const holeDepth = wall * 3; // Through the wall
      const holeSegments = 12;
      
      // Calculate safe positions within the cut profile
      const marginY = h * 0.15;
      const getSafeX = (yPos: number) => {
        // Get the radius at this height, then find x extent at cut plane
        const t = yPos / h;
        let radius = bRad + (tRad - bRad) * t;
        // x² + cutOffset² = radius² => x = sqrt(radius² - cutOffset²)
        const xExtent = Math.sqrt(Math.max(0, radius * radius - cutOffset * cutOffset));
        return Math.max(0, xExtent - screwRadius * 3); // Margin from edge
      };
      
      const screwPositions: { x: number; y: number }[] = [];
      if (screwCount === 2) {
        screwPositions.push({ x: 0, y: marginY });
        screwPositions.push({ x: 0, y: h - marginY });
      } else if (screwCount === 3) {
        screwPositions.push({ x: 0, y: h - marginY });
        const bottomX = getSafeX(marginY) * 0.6;
        screwPositions.push({ x: -bottomX, y: marginY });
        screwPositions.push({ x: bottomX, y: marginY });
      } else {
        const topX = getSafeX(h - marginY) * 0.6;
        const bottomX = getSafeX(marginY) * 0.6;
        screwPositions.push({ x: -topX, y: h - marginY });
        screwPositions.push({ x: topX, y: h - marginY });
        screwPositions.push({ x: -bottomX, y: marginY });
        screwPositions.push({ x: bottomX, y: marginY });
      }
      
      // Generate screw hole cylinders (going into the wall, -Z direction)
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
        
        // Back ring (into wall)
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            cutOffset - holeDepth
          );
        }
        
        // Hole wall (cylinder)
        for (let s = 0; s < holeSegments; s++) {
          const a = holeStartIdx + s;
          const b = holeStartIdx + s + 1;
          const c = holeStartIdx + holeSegments + 1 + s;
          const d = holeStartIdx + holeSegments + 1 + s + 1;
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      }
      
      // Step 8: Add cord hole if enabled
      if (params.wallMountCordHoleEnabled) {
        const cordRadius = (params.cordHoleDiameter || 8) * SCALE / 2;
        const cordY = h * 0.6; // Slightly below center
        const cordHoleStartIdx = vertices.length / 3;
        
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(Math.cos(angle) * cordRadius, cordY + Math.sin(angle) * cordRadius, cutOffset);
        }
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(Math.cos(angle) * cordRadius, cordY + Math.sin(angle) * cordRadius, cutOffset - holeDepth);
        }
        for (let s = 0; s < holeSegments; s++) {
          const a = cordHoleStartIdx + s;
          const b = cordHoleStartIdx + s + 1;
          const c = cordHoleStartIdx + holeSegments + 1 + s;
          const d = cordHoleStartIdx + holeSegments + 1 + s + 1;
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      }
      
      // Step 9: Add bulb socket mount - VERTICAL ring facing outward (+Z direction)
      // The socket hangs from this ring, which is horizontal (like a shelf)
      const socketY = h * 0.75; // Near top of sconce
      const socketInnerRadius = 14 * SCALE; // E26/E27 socket ~27mm diameter
      const socketOuterRadius = socketInnerRadius + wall;
      const socketRingThickness = wall * 2;
      const ringSegments = 24;
      
      // Create a horizontal ring (shelf) that the socket can rest on
      // The ring is centered at x=0, y=socketY, and extends in front of the back wall
      const ringStartIdx = vertices.length / 3;
      
      // Top surface of ring (outer edge)
      for (let s = 0; s <= ringSegments; s++) {
        const angle = (s / ringSegments) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * socketOuterRadius,
          socketY,
          cutOffset + Math.sin(angle) * socketOuterRadius + socketOuterRadius
        );
      }
      
      // Top surface of ring (inner edge - hole for socket)
      for (let s = 0; s <= ringSegments; s++) {
        const angle = (s / ringSegments) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * socketInnerRadius,
          socketY,
          cutOffset + Math.sin(angle) * socketInnerRadius + socketOuterRadius
        );
      }
      
      // Bottom surface of ring (outer edge)
      for (let s = 0; s <= ringSegments; s++) {
        const angle = (s / ringSegments) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * socketOuterRadius,
          socketY - socketRingThickness,
          cutOffset + Math.sin(angle) * socketOuterRadius + socketOuterRadius
        );
      }
      
      // Bottom surface of ring (inner edge)
      for (let s = 0; s <= ringSegments; s++) {
        const angle = (s / ringSegments) * Math.PI * 2;
        vertices.push(
          Math.cos(angle) * socketInnerRadius,
          socketY - socketRingThickness,
          cutOffset + Math.sin(angle) * socketInnerRadius + socketOuterRadius
        );
      }
      
      const topOuter = ringStartIdx;
      const topInner = ringStartIdx + (ringSegments + 1);
      const botOuter = ringStartIdx + (ringSegments + 1) * 2;
      const botInner = ringStartIdx + (ringSegments + 1) * 3;
      
      // Top face (ring between inner and outer)
      for (let s = 0; s < ringSegments; s++) {
        indices.push(topOuter + s, topOuter + s + 1, topInner + s);
        indices.push(topInner + s, topOuter + s + 1, topInner + s + 1);
      }
      
      // Bottom face
      for (let s = 0; s < ringSegments; s++) {
        indices.push(botOuter + s, botInner + s, botOuter + s + 1);
        indices.push(botOuter + s + 1, botInner + s, botInner + s + 1);
      }
      
      // Outer wall
      for (let s = 0; s < ringSegments; s++) {
        indices.push(topOuter + s, botOuter + s, topOuter + s + 1);
        indices.push(topOuter + s + 1, botOuter + s, botOuter + s + 1);
      }
      
      // Inner wall (socket hole)
      for (let s = 0; s < ringSegments; s++) {
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
