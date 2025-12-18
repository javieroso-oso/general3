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
      // NEW APPROACH: Generate full 360° object, then clip at z = cutOffset
      // This properly handles all organic deformations and creates a true flat back
      
      // Step 1: Collect the full 360° vertices (already generated in outerVerts)
      // Step 2: Clip vertices: any vertex with z < cutOffset gets z = cutOffset
      // Step 3: Build faces, skipping degenerate triangles behind cut plane
      // Step 4: Triangulate the back wall from boundary vertices at z = cutOffset
      
      // Clipped vertices array - modify z coordinates at cut plane
      const clippedVerts: number[] = [];
      const vertexAtCut: boolean[] = []; // Track which vertices are on the cut plane
      
      for (let i = 0; i < outerVerts.length; i += 3) {
        const x = outerVerts[i];
        const y = outerVerts[i + 1];
        let z = outerVerts[i + 2];
        
        // Clip vertices behind the cut plane
        if (z < cutOffset) {
          z = cutOffset;
          vertexAtCut.push(true);
        } else {
          vertexAtCut.push(false);
        }
        
        clippedVerts.push(x, y, z);
      }
      
      // Copy clipped vertices to main array
      for (let i = 0; i < clippedVerts.length; i++) {
        vertices.push(clippedVerts[i]);
      }
      
      // Build shell surface faces, keeping only those in front of cut plane
      for (let i = 0; i < heightSegments; i++) {
        for (let j = 0; j < segments; j++) {
          const a = i * (segments + 1) + j;
          const b = a + 1;
          const c = a + (segments + 1);
          const d = c + 1;
          
          // Get z values to check if face is visible
          const za = clippedVerts[a * 3 + 2];
          const zb = clippedVerts[b * 3 + 2];
          const zc = clippedVerts[c * 3 + 2];
          const zd = clippedVerts[d * 3 + 2];
          
          // Only add face if at least one vertex is in front of cut plane
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
      
      // Step 4: Create flat back wall by triangulating boundary vertices at z = cutOffset
      // Collect all vertices that are on the cut plane, organized by height
      const boundaryByHeight: Map<number, { x: number; y: number; idx: number }[]> = new Map();
      
      for (let i = 0; i <= heightSegments; i++) {
        const heightVerts: { x: number; y: number; idx: number }[] = [];
        
        for (let j = 0; j <= segments; j++) {
          const idx = i * (segments + 1) + j;
          const z = clippedVerts[idx * 3 + 2];
          
          // Vertex is on cut plane
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
      
      // For each height level, create quads connecting boundary vertices
      // This creates horizontal strips across the back wall
      const heightLevels = Array.from(boundaryByHeight.keys()).sort((a, b) => a - b);
      
      for (let hi = 0; hi < heightLevels.length - 1; hi++) {
        const currentLevel = boundaryByHeight.get(heightLevels[hi])!;
        const nextLevel = boundaryByHeight.get(heightLevels[hi + 1])!;
        
        // Sort vertices by x coordinate at each level
        currentLevel.sort((a, b) => a.x - b.x);
        nextLevel.sort((a, b) => a.x - b.x);
        
        // Find the leftmost and rightmost x at each level
        if (currentLevel.length >= 2 && nextLevel.length >= 2) {
          const currentLeft = currentLevel[0];
          const currentRight = currentLevel[currentLevel.length - 1];
          const nextLeft = nextLevel[0];
          const nextRight = nextLevel[nextLevel.length - 1];
          
          // Create two triangles for this strip of the back wall
          // Triangle 1: currentLeft -> nextLeft -> currentRight
          indices.push(currentLeft.idx, nextLeft.idx, currentRight.idx);
          // Triangle 2: currentRight -> nextLeft -> nextRight
          indices.push(currentRight.idx, nextLeft.idx, nextRight.idx);
        }
      }
      
      // Add bottom cap for half-shell
      const bottomCenterIdx = vertices.length / 3;
      vertices.push(0, 0, cutOffset); // Center at base, on cut plane
      
      // Collect bottom ring vertices that are in front of cut plane
      for (let j = 0; j < segments; j++) {
        const aIdx = j;
        const bIdx = j + 1;
        const az = clippedVerts[aIdx * 3 + 2];
        const bz = clippedVerts[bIdx * 3 + 2];
        
        // Only add triangle if vertices are in front of cut plane
        if (az > cutOffset + 0.0001 || bz > cutOffset + 0.0001) {
          indices.push(bottomCenterIdx, bIdx, aIdx);
        }
      }
      
      // Add mounting screw holes through the flat back
      const screwCount = params.wallMountScrewCount || 2;
      const screwDiameter = (params.wallMountScrewDiameter || 5) * SCALE;
      const screwRadius = screwDiameter / 2;
      const holeDepth = wall * 3;
      const holeSegments = 12;
      
      const marginY = h * 0.15;
      
      const getMaxX = (yPos: number) => {
        const t = yPos / h;
        let radius = bRad + (tRad - bRad) * t;
        return radius * 0.4; // 40% of radius for safe margin from edges
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
      
      // Generate screw hole cylinders going into -Z from cut plane
      for (const pos of screwPositions) {
        const holeStartIdx = vertices.length / 3;
        
        // Front ring at z = cutOffset
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            cutOffset
          );
        }
        
        // Back ring at z = cutOffset - holeDepth
        for (let s = 0; s <= holeSegments; s++) {
          const angle = (s / holeSegments) * Math.PI * 2;
          vertices.push(
            pos.x + Math.cos(angle) * screwRadius,
            pos.y + Math.sin(angle) * screwRadius,
            cutOffset - holeDepth
          );
        }
        
        // Cylinder wall
        for (let s = 0; s < holeSegments; s++) {
          const a = holeStartIdx + s;
          const b = holeStartIdx + s + 1;
          const c = holeStartIdx + holeSegments + 1 + s;
          const d = holeStartIdx + holeSegments + 1 + s + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
        
        // Back cap
        const backCapCenter = vertices.length / 3;
        vertices.push(pos.x, pos.y, cutOffset - holeDepth);
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
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
        const cordBackCenter = vertices.length / 3;
        vertices.push(0, cordY, cutOffset - holeDepth);
        for (let s = 0; s < holeSegments; s++) {
          const a = cordHoleStartIdx + holeSegments + 1 + s;
          const b = cordHoleStartIdx + holeSegments + 1 + s + 1;
          indices.push(cordBackCenter, a, b);
        }
      }
      
      // SOCKET BRACKET: Connected to shell with vertical struts
      const socketY = h * 0.7;
      const socketInnerRadius = 14 * SCALE; // ~28mm for E26/E27
      const socketOuterRadius = socketInnerRadius + wall * 1.5;
      const shelfThickness = wall * 2;
      const strutCount = 3;
      const strutWidth = wall * 2;
      const strutDepth = wall * 1.5;
      
      // Find shell radius at socket height for strut connection
      const socketT = socketY / h;
      let shellRadiusAtSocket = bRad + (tRad - bRad) * socketT;
      // Apply bulge at this height
      const bulgeDist = Math.abs(socketT - bulgePosition);
      shellRadiusAtSocket += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * bRad;
      
      const bracketStartIdx = vertices.length / 3;
      const ringSegs = 16;
      
      // Create horizontal shelf (disc) for socket - only front half (z > cutOffset)
      // Top surface
      for (let s = 0; s <= ringSegs; s++) {
        const angle = (s / ringSegs) * Math.PI; // 0 to PI (front half)
        const z = Math.sin(angle) * socketOuterRadius;
        if (z >= cutOffset) {
          vertices.push(Math.cos(angle) * socketOuterRadius, socketY, z);
        } else {
          vertices.push(Math.cos(angle) * socketOuterRadius, socketY, cutOffset);
        }
      }
      for (let s = 0; s <= ringSegs; s++) {
        const angle = (s / ringSegs) * Math.PI;
        const z = Math.sin(angle) * socketInnerRadius;
        if (z >= cutOffset) {
          vertices.push(Math.cos(angle) * socketInnerRadius, socketY, z);
        } else {
          vertices.push(Math.cos(angle) * socketInnerRadius, socketY, cutOffset);
        }
      }
      
      // Bottom surface
      for (let s = 0; s <= ringSegs; s++) {
        const angle = (s / ringSegs) * Math.PI;
        const z = Math.sin(angle) * socketOuterRadius;
        if (z >= cutOffset) {
          vertices.push(Math.cos(angle) * socketOuterRadius, socketY - shelfThickness, z);
        } else {
          vertices.push(Math.cos(angle) * socketOuterRadius, socketY - shelfThickness, cutOffset);
        }
      }
      for (let s = 0; s <= ringSegs; s++) {
        const angle = (s / ringSegs) * Math.PI;
        const z = Math.sin(angle) * socketInnerRadius;
        if (z >= cutOffset) {
          vertices.push(Math.cos(angle) * socketInnerRadius, socketY - shelfThickness, z);
        } else {
          vertices.push(Math.cos(angle) * socketInnerRadius, socketY - shelfThickness, cutOffset);
        }
      }
      
      const topOuter = bracketStartIdx;
      const topInner = bracketStartIdx + (ringSegs + 1);
      const botOuter = bracketStartIdx + (ringSegs + 1) * 2;
      const botInner = bracketStartIdx + (ringSegs + 1) * 3;
      
      // Shelf faces
      for (let s = 0; s < ringSegs; s++) {
        indices.push(topOuter + s, topOuter + s + 1, topInner + s);
        indices.push(topInner + s, topOuter + s + 1, topInner + s + 1);
        indices.push(botOuter + s, botInner + s, botOuter + s + 1);
        indices.push(botOuter + s + 1, botInner + s, botInner + s + 1);
        indices.push(topOuter + s, botOuter + s, topOuter + s + 1);
        indices.push(topOuter + s + 1, botOuter + s, botOuter + s + 1);
        indices.push(topInner + s, topInner + s + 1, botInner + s);
        indices.push(botInner + s, topInner + s + 1, botInner + s + 1);
      }
      
      // Close shelf edges at z = cutOffset
      indices.push(topOuter + ringSegs, topInner + ringSegs, botOuter + ringSegs);
      indices.push(botOuter + ringSegs, topInner + ringSegs, botInner + ringSegs);
      indices.push(topOuter, botOuter, topInner);
      indices.push(topInner, botOuter, botInner);
      
      // VERTICAL SUPPORT STRUTS connecting shelf to shell wall
      for (let si = 0; si < strutCount; si++) {
        const strutAngle = (si / (strutCount - 1)) * Math.PI * 0.6 + Math.PI * 0.2; // Spread across front
        
        // Strut goes from shelf outer edge down to bottom of shell
        const strutX = Math.cos(strutAngle) * socketOuterRadius;
        const strutZ = Math.max(Math.sin(strutAngle) * socketOuterRadius, cutOffset + 0.001);
        const strutBottom = 0;
        const strutTop = socketY - shelfThickness;
        
        // Find where this strut meets the shell at the bottom
        const shellX = Math.cos(strutAngle) * bRad;
        const shellZ = Math.max(Math.sin(strutAngle) * bRad, cutOffset + 0.001);
        
        const strutStartIdx = vertices.length / 3;
        
        // Strut vertices (simple rectangular box)
        const hw = strutWidth / 2;
        const hd = strutDepth / 2;
        
        // Top face (at shelf)
        vertices.push(strutX - hw, strutTop, strutZ - hd);
        vertices.push(strutX + hw, strutTop, strutZ - hd);
        vertices.push(strutX + hw, strutTop, strutZ + hd);
        vertices.push(strutX - hw, strutTop, strutZ + hd);
        
        // Bottom face (at shell)
        vertices.push(shellX - hw, strutBottom, shellZ - hd);
        vertices.push(shellX + hw, strutBottom, shellZ - hd);
        vertices.push(shellX + hw, strutBottom, shellZ + hd);
        vertices.push(shellX - hw, strutBottom, shellZ + hd);
        
        // Strut faces
        // Top
        indices.push(strutStartIdx + 0, strutStartIdx + 1, strutStartIdx + 2);
        indices.push(strutStartIdx + 0, strutStartIdx + 2, strutStartIdx + 3);
        // Bottom
        indices.push(strutStartIdx + 4, strutStartIdx + 6, strutStartIdx + 5);
        indices.push(strutStartIdx + 4, strutStartIdx + 7, strutStartIdx + 6);
        // Front
        indices.push(strutStartIdx + 2, strutStartIdx + 1, strutStartIdx + 5);
        indices.push(strutStartIdx + 2, strutStartIdx + 5, strutStartIdx + 6);
        // Back
        indices.push(strutStartIdx + 0, strutStartIdx + 3, strutStartIdx + 7);
        indices.push(strutStartIdx + 0, strutStartIdx + 7, strutStartIdx + 4);
        // Left
        indices.push(strutStartIdx + 0, strutStartIdx + 4, strutStartIdx + 5);
        indices.push(strutStartIdx + 0, strutStartIdx + 5, strutStartIdx + 1);
        // Right
        indices.push(strutStartIdx + 3, strutStartIdx + 2, strutStartIdx + 6);
        indices.push(strutStartIdx + 3, strutStartIdx + 6, strutStartIdx + 7);
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
