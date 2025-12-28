import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParametricParams, ObjectType, printConstraints } from '@/types/parametric';
import { getOverhangVertexColors } from '@/lib/support-free-constraints';
import { generateLegsWithBase, generateBaseMountPlate } from '@/lib/leg-generator';
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';

import { MaterialPreset, MATERIAL_PRESETS, MaterialConfig } from '@/types/materials';

interface ParametricMeshProps {
  params: ParametricParams;
  type: ObjectType;
  showWireframe?: boolean;
  materialPreset?: MaterialPreset;
  autoRotate?: boolean;
  customColor?: string;
  legMaterialPreset?: MaterialPreset;
  legCustomColor?: string;
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

const ParametricMesh = ({ 
  params, 
  type, 
  showWireframe = false,
  materialPreset = 'ceramic',
  autoRotate = true,
  customColor,
  legMaterialPreset,
  legCustomColor,
}: ParametricMeshProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Get base material config for body
  const baseConfig = materialPreset === 'custom' 
    ? {
        color: '#888888',
        roughness: 0.3,
        metalness: 0.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        envMapIntensity: 0.4,
      }
    : MATERIAL_PRESETS[materialPreset];

  const materialConfig: MaterialConfig = {
    ...baseConfig,
    color: customColor || baseConfig.color,
  };
  
  // Get material config for legs/base (defaults to body material if not specified)
  const legBaseConfig = legMaterialPreset 
    ? (legMaterialPreset === 'custom' 
        ? {
            color: '#888888',
            roughness: 0.3,
            metalness: 0.0,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1,
            envMapIntensity: 0.4,
          }
        : MATERIAL_PRESETS[legMaterialPreset])
    : baseConfig;

  const legMaterialConfig: MaterialConfig = {
    ...legBaseConfig,
    color: legCustomColor || legBaseConfig.color,
  };

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
      // New body customization params
      facetCount,
      facetSharpness,
      spiralGrooveCount,
      spiralGrooveDepth,
      spiralGrooveTwist,
      horizontalRibCount,
      horizontalRibDepth,
      horizontalRibWidth,
      flutingCount,
      flutingDepth,
      rimWaveCount,
      rimWaveDepth,
      profileCurve,
    } = params;

    // Scale to scene units
    const h = height * SCALE;
    const bRad = baseRadius * SCALE;
    const tRad = topRadius * SCALE;
    const wall = wallThickness * SCALE;

    const segments = 64;
    const heightSegments = 64;
    
    // For wall mount with BACK style, we generate FULL 360° object then slice with a plane
    const isWallMount = addLegs && params.standType === 'wall_mount' && params.wallMountStyle === 'back';
    const cutOffset = (params.wallMountCutOffset || 0) * SCALE;

    const outerVerts: number[] = [];
    const radiiAtHeight: number[] = [];
    let maxRadius = 0;

    // Generate full 360° object
    for (let i = 0; i <= heightSegments; i++) {
      const t = i / heightSegments;
      const y = t * h;

      // Base profile interpolation based on profileCurve
      let radius: number;
      const radiusDiff = tRad - bRad;
      
      switch (profileCurve) {
        case 'convex':
          // Bulges outward in the middle
          radius = bRad + radiusDiff * t + Math.sin(t * Math.PI) * Math.abs(radiusDiff) * 0.3;
          break;
        case 'concave':
          // Curves inward in the middle
          radius = bRad + radiusDiff * t - Math.sin(t * Math.PI) * Math.abs(radiusDiff) * 0.3;
          break;
        case 'hourglass':
          // Pinched in the middle
          radius = bRad + radiusDiff * t - Math.sin(t * Math.PI) * (bRad + tRad) * 0.15;
          break;
        case 'wave':
          // Wavy profile with 2 oscillations
          radius = bRad + radiusDiff * t + Math.sin(t * Math.PI * 4) * bRad * 0.08;
          break;
        case 'linear':
        default:
          // Apply object-type specific curves on top of linear base
          if (type === 'lamp') {
            radius = bRad + (tRad - bRad) * Math.pow(t, 0.6);
          } else if (type === 'sculpture') {
            const curve = Math.sin(t * Math.PI);
            radius = bRad * (1 - t * 0.3) + tRad * t * 0.7 + curve * bRad * 0.2;
          } else {
            const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
            radius = bRad * (1 - t * 0.4) + tRad * t * 0.6 + curve * bRad * 0.12;
          }
          break;
      }

      // Organic bulge
      const bulgeDist = Math.abs(t - bulgePosition);
      radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * bRad;

      // Pinch effect
      const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
      const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
      radius *= (1 - pinchTop - pinchBottom);

      // Lip flare
      if (lipHeight > 0 && lipFlare !== 0) {
        const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
        radius += lipT * lipT * lipFlare * bRad;
      }
      
      // Horizontal ribs (sinusoidal modulation based on height)
      if (horizontalRibCount > 0 && horizontalRibDepth > 0) {
        const ribPhase = t * horizontalRibCount * Math.PI * 2;
        const ribWave = Math.sin(ribPhase);
        // Adjust wave shape based on rib width (narrower = sharper peaks)
        const sharpness = 1 / horizontalRibWidth;
        const ribModifier = Math.pow(Math.abs(ribWave), sharpness) * Math.sign(ribWave);
        radius += ribModifier * horizontalRibDepth * bRad;
      }

      radius = Math.max(radius, printConstraints.minBaseRadius * SCALE * 0.5);
      radiiAtHeight.push(radius);
      if (radius > maxRadius) maxRadius = radius;

      radius = Math.max(radius, printConstraints.minBaseRadius * SCALE * 0.5);
      radiiAtHeight.push(radius);
      if (radius > maxRadius) maxRadius = radius;

      const twistRad = (twistAngle * Math.PI / 180) * t;

      for (let j = 0; j <= segments; j++) {
        // Calculate theta with potential faceting
        let theta: number;
        if (facetCount > 0 && facetCount >= 3) {
          // Faceting: snap to polygon vertices with optional sharpness
          const baseTheta = (j / segments) * Math.PI * 2;
          const facetAngle = (Math.PI * 2) / facetCount;
          const facetIndex = Math.floor(baseTheta / facetAngle + 0.5);
          const snappedTheta = facetIndex * facetAngle;
          // Interpolate between smooth and snapped based on sharpness
          theta = baseTheta + (snappedTheta - baseTheta) * facetSharpness + twistRad;
        } else {
          theta = (j / segments) * Math.PI * 2 + twistRad;
        }
        
        let r = radius;

        // Wobble
        if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
          const maxWobble = Math.min(wobbleAmplitude, 0.15);
          r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * bRad;
        }

        // Ripples (angular)
        if (rippleCount > 0 && rippleDepth > 0) {
          const maxRipple = Math.min(rippleDepth, 0.1);
          r += Math.sin(theta * rippleCount) * maxRipple * bRad;
        }
        
        // Fluting (vertical grooves like classical columns)
        if (flutingCount > 0 && flutingDepth > 0) {
          // Use half-sine for smooth flutes
          const fluteAngle = theta * flutingCount;
          const fluteWave = Math.cos(fluteAngle);
          // Only cut in (negative), not bulge out
          if (fluteWave < 0) {
            r += fluteWave * flutingDepth * bRad;
          }
        }
        
        // Spiral grooves (combine height and angle)
        if (spiralGrooveCount > 0 && spiralGrooveDepth > 0) {
          const spiralAngle = theta + t * spiralGrooveTwist * Math.PI * 2;
          const spiralWave = Math.sin(spiralAngle * spiralGrooveCount);
          // Only cut in (negative)
          if (spiralWave < 0) {
            r += spiralWave * spiralGrooveDepth * bRad;
          }
        }

        // Asymmetry
        if (asymmetry > 0) {
          const primaryWave = Math.sin(theta) * Math.cos(t * Math.PI) * asymmetry * bRad;
          const secondaryWave = Math.sin(theta * 2 + t * Math.PI * 3) * asymmetry * 0.5 * bRad;
          const lean = Math.cos(theta) * t * asymmetry * 0.4 * bRad;
          r += primaryWave + secondaryWave + lean;
        }

        // Organic noise
        if (organicNoise > 0) {
          const maxNoise = Math.min(organicNoise, 0.1);
          const nx = Math.cos(theta) * r;
          const nz = Math.sin(theta) * r;
          r += noise3D(nx * 10, y * 10, nz * 10, noiseScale) * maxNoise * bRad;
        }

        r = Math.max(r, wall * 2);

        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        
        // Rim waves: modify Y position for top rows
        let finalY = y;
        if (rimWaveCount > 0 && rimWaveDepth > 0) {
          const rimZone = 0.1; // Top 10% of height
          const rimT = Math.max(0, (t - (1 - rimZone)) / rimZone);
          if (rimT > 0) {
            const waveOffset = Math.sin(theta * rimWaveCount) * rimWaveDepth * h * rimT;
            finalY += waveOffset;
          }
        }
        
        outerVerts.push(x, finalY, z);
      }
    }

    const vertices: number[] = [];
    const indices: number[] = [];

    // Helper to create keyhole geometry for CSG - CORRECT: large circle at TOP, narrow slot going DOWN
    // Uses merged cylinder + box primitives for reliable CSG operations
    const createKeyholeGeometry = (cx: number, cy: number, zPos: number): THREE.BufferGeometry => {
      const headRadius = 5 * SCALE;  // 10mm diameter for screw head
      const slotWidth = 2.5 * SCALE; // 5mm wide slot for screw shaft
      const slotLength = 10 * SCALE; // 10mm slot length going DOWN
      const depth = wall * 3;        // Through the back wall
      
      // Create head (large circle at TOP) - cylinder aligned to Z axis
      const headGeometry = new THREE.CylinderGeometry(headRadius, headRadius, depth, 32);
      headGeometry.rotateX(Math.PI / 2); // Align cylinder to Z axis
      headGeometry.translate(cx, cy, zPos - depth / 2);
      
      // Create slot (narrow rectangle going DOWN from head)
      const slotGeometry = new THREE.BoxGeometry(slotWidth * 2, slotLength, depth);
      slotGeometry.translate(cx, cy - slotLength / 2, zPos - depth / 2);
      
      // Merge the two geometries
      const mergedPositions: number[] = [];
      const mergedIndices: number[] = [];
      
      // Add head geometry
      const headPos = headGeometry.getAttribute('position');
      const headIdx = headGeometry.getIndex();
      for (let i = 0; i < headPos.count; i++) {
        mergedPositions.push(headPos.getX(i), headPos.getY(i), headPos.getZ(i));
      }
      if (headIdx) {
        for (let i = 0; i < headIdx.count; i++) {
          mergedIndices.push(headIdx.getX(i));
        }
      }
      
      // Add slot geometry with offset indices
      const slotPos = slotGeometry.getAttribute('position');
      const slotIdx = slotGeometry.getIndex();
      const indexOffset = headPos.count;
      for (let i = 0; i < slotPos.count; i++) {
        mergedPositions.push(slotPos.getX(i), slotPos.getY(i), slotPos.getZ(i));
      }
      if (slotIdx) {
        for (let i = 0; i < slotIdx.count; i++) {
          mergedIndices.push(slotIdx.getX(i) + indexOffset);
        }
      }
      
      const mergedGeo = new THREE.BufferGeometry();
      mergedGeo.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3));
      mergedGeo.setIndex(mergedIndices);
      mergedGeo.computeVertexNormals();
      
      return mergedGeo;
    };
    
    const createCircleVisual = (cx: number, cy: number, radius: number, zPos: number): THREE.BufferGeometry => {
      const geo = new THREE.CylinderGeometry(radius, radius, 2 * SCALE, 32);
      geo.rotateX(Math.PI / 2);
      geo.translate(cx, cy, zPos - 1 * SCALE);
      return geo;
    };

    let keyholeGeometries: THREE.BufferGeometry[] = [];
    let cordHoleGeometry: THREE.BufferGeometry | null = null;

    if (isWallMount) {
      // Wall mount clipping and keyhole generation
      const KEYHOLE_HEIGHT = 12 * SCALE;
      const KEYHOLE_MIN_MARGIN = 10 * SCALE;
      const KEYHOLE_MIN_SPACING = 25 * SCALE;
      
      const holeCount = params.wallMountHoleCount || 2;
      const holeMargin = params.wallMountHoleMargin || 0.15;
      const holePositions: { x: number; y: number }[] = [];
      
      const availableHeight = h - 2 * KEYHOLE_MIN_MARGIN;
      
      if (availableHeight >= KEYHOLE_HEIGHT) {
        const marginY = Math.max(h * holeMargin, KEYHOLE_MIN_MARGIN + KEYHOLE_HEIGHT / 2);
        const topMarginY = Math.max(h * holeMargin, KEYHOLE_MIN_MARGIN + KEYHOLE_HEIGHT / 2);
        
        if (holeCount === 2 && availableHeight >= KEYHOLE_MIN_SPACING + KEYHOLE_HEIGHT) {
          const bottomY = Math.max(marginY, KEYHOLE_MIN_MARGIN + KEYHOLE_HEIGHT / 2);
          const topY = Math.min(h - topMarginY, h - KEYHOLE_MIN_MARGIN - KEYHOLE_HEIGHT / 2);
          
          if (topY - bottomY >= KEYHOLE_MIN_SPACING) {
            holePositions.push({ x: 0, y: bottomY });
            holePositions.push({ x: 0, y: topY });
          } else {
            holePositions.push({ x: 0, y: h / 2 });
          }
        } else {
          holePositions.push({ x: 0, y: h / 2 });
        }
      }
      
      for (const pos of holePositions) {
        keyholeGeometries.push(createKeyholeGeometry(pos.x, pos.y, cutOffset));
      }
      
      if (params.wallMountCordHoleEnabled) {
        const cordRadius = (params.cordHoleDiameter || 8) * SCALE / 2;
        cordHoleGeometry = createCircleVisual(0, h * 0.5, cordRadius, cutOffset);
      }
      
      // Clip vertices
      const clippedVerts: number[] = [];
      for (let i = 0; i < outerVerts.length; i += 3) {
        const x = outerVerts[i];
        const y = outerVerts[i + 1];
        let z = outerVerts[i + 2];
        if (z < cutOffset) z = cutOffset;
        clippedVerts.push(x, y, z);
      }
      
      for (let i = 0; i < clippedVerts.length; i++) {
        vertices.push(clippedVerts[i]);
      }
      
      // Build faces
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
      
      // Create back wall
      const edgePoints: { x: number; y: number }[] = [];
      
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * h;
        const intersections: number[] = [];
        
        for (let j = 0; j < segments; j++) {
          const idx1 = i * (segments + 1) + j;
          const idx2 = i * (segments + 1) + j + 1;
          
          const x1 = outerVerts[idx1 * 3];
          const z1 = outerVerts[idx1 * 3 + 2];
          const x2 = outerVerts[idx2 * 3];
          const z2 = outerVerts[idx2 * 3 + 2];
          
          if ((z1 >= cutOffset && z2 < cutOffset) || (z1 < cutOffset && z2 >= cutOffset)) {
            const tInterp = (cutOffset - z1) / (z2 - z1);
            intersections.push(x1 + tInterp * (x2 - x1));
          }
        }
        
        if (intersections.length >= 2) {
          intersections.sort((a, b) => a - b);
          edgePoints.push({ x: intersections[0], y });
          edgePoints.push({ x: intersections[intersections.length - 1], y });
        } else if (intersections.length === 1) {
          edgePoints.push({ x: intersections[0], y });
        }
      }
      
      // Create back wall triangles
      if (edgePoints.length >= 4) {
        const backStart = vertices.length / 3;
        
        for (const pt of edgePoints) {
          vertices.push(pt.x, pt.y, cutOffset);
        }
        
        for (let i = 0; i < edgePoints.length - 2; i += 2) {
          const bl = backStart + i;
          const br = backStart + i + 1;
          const tl = backStart + i + 2;
          const tr = backStart + i + 3;
          
          if (tl < backStart + edgePoints.length && tr < backStart + edgePoints.length) {
            indices.push(bl, tl, br);
            indices.push(br, tl, tr);
          }
        }
      }
    } else {
      // Full 360° body with shell
      const innerVerts: number[] = [];
      
      for (let i = 0; i < outerVerts.length; i += 3) {
        const ox = outerVerts[i];
        const oy = outerVerts[i + 1];
        const oz = outerVerts[i + 2];
        const or = Math.sqrt(ox * ox + oz * oz);
        const ir = Math.max(or - wall, 0.01);
        const angle = Math.atan2(oz, ox);
        innerVerts.push(Math.cos(angle) * ir, oy, Math.sin(angle) * ir);
      }
      
      // Add outer vertices
      for (let i = 0; i < outerVerts.length; i++) {
        vertices.push(outerVerts[i]);
      }
      
      // Add inner vertices
      const innerOffset = vertices.length / 3;
      for (let i = 0; i < innerVerts.length; i++) {
        vertices.push(innerVerts[i]);
      }
      
      // Outer wall faces
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
      
      // Inner wall faces (inverted)
      for (let i = 0; i < heightSegments; i++) {
        for (let j = 0; j < segments; j++) {
          const a = innerOffset + i * (segments + 1) + j;
          const b = a + 1;
          const c = a + (segments + 1);
          const d = c + 1;
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      }
      
      // Top rim
      const topRowOuter = heightSegments * (segments + 1);
      const topRowInner = innerOffset + topRowOuter;
      for (let j = 0; j < segments; j++) {
        const a = topRowOuter + j;
        const b = topRowOuter + j + 1;
        const c = topRowInner + j;
        const d = topRowInner + j + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
      
      // Bottom base - with cord hole if enabled and no legs
      const baseY = 0;
      const cordHoleRadius = (params.cordHoleDiameter / 2) * SCALE;
      
      if (params.cordHoleEnabled && !addLegs) {
        // Create annular base (ring) with cord hole
        const bottomInnerOffset = vertices.length / 3;
        
        // Add inner ring vertices at the cord hole radius
        for (let j = 0; j <= segments; j++) {
          const theta = (j / segments) * Math.PI * 2;
          vertices.push(
            Math.cos(theta) * cordHoleRadius,
            baseY,
            Math.sin(theta) * cordHoleRadius
          );
        }
        
        // Connect outer ring to inner ring (bottom face)
        for (let j = 0; j < segments; j++) {
          const outerCurr = j;
          const outerNext = j + 1;
          const innerCurr = bottomInnerOffset + j;
          const innerNext = bottomInnerOffset + j + 1;
          indices.push(outerCurr, innerCurr, outerNext);
          indices.push(outerNext, innerCurr, innerNext);
        }
        
        // Connect inner rings of outer and inner walls (cord hole wall)
        for (let j = 0; j < segments; j++) {
          const topInner = innerOffset + j;
          const topInnerNext = innerOffset + j + 1;
          const bottomInner = bottomInnerOffset + j;
          const bottomInnerNext = bottomInnerOffset + j + 1;
          indices.push(topInner, topInnerNext, bottomInner);
          indices.push(topInnerNext, bottomInnerNext, bottomInner);
        }
      } else if (!addLegs) {
        // Solid base (no cord hole)
        const bottomCenterIdx = vertices.length / 3;
        vertices.push(0, baseY, 0);
        
        for (let j = 0; j < segments; j++) {
          const curr = j;
          const next = j + 1;
          indices.push(bottomCenterIdx, next, curr);
        }
      }
    }

    let bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bodyGeo.setIndex(indices);
    bodyGeo.computeVertexNormals();
    
    // Apply CSG to cut keyhole and cord holes into the body (for wall mount)
    if (isWallMount && (keyholeGeometries.length > 0 || cordHoleGeometry)) {
      try {
        const evaluator = new Evaluator();
        let bodyBrush = new Brush(bodyGeo);
        bodyBrush.updateMatrixWorld();
        
        // Subtract each keyhole from the body
        for (const keyholeGeo of keyholeGeometries) {
          const keyholeBrush = new Brush(keyholeGeo);
          keyholeBrush.updateMatrixWorld();
          bodyBrush = evaluator.evaluate(bodyBrush, keyholeBrush, SUBTRACTION) as Brush;
        }
        
        // Subtract cord hole if enabled
        if (cordHoleGeometry) {
          // Create a cylinder for the cord hole
          const cordCylGeo = new THREE.CylinderGeometry(
            (params.cordHoleDiameter || 8) * SCALE / 2,
            (params.cordHoleDiameter || 8) * SCALE / 2,
            wall * 4,
            32
          );
          cordCylGeo.rotateX(Math.PI / 2);
          cordCylGeo.translate(0, h * 0.5, cutOffset - wall * 2);
          
          const cordBrush = new Brush(cordCylGeo);
          cordBrush.updateMatrixWorld();
          bodyBrush = evaluator.evaluate(bodyBrush, cordBrush, SUBTRACTION) as Brush;
        }
        
        bodyGeo = bodyBrush.geometry;
        // Clear the keyhole geometries since they're now cut into the body
        keyholeGeometries = [];
        cordHoleGeometry = null;
      } catch (e) {
        // CSG failed, fall back to visual-only keyholes
        console.warn('CSG operation failed, using visual keyholes:', e);
      }
    }
    
    let overhangColorArray: Float32Array | null = null;
    if (params.showOverhangMap && !isWallMount) {
      overhangColorArray = getOverhangVertexColors(params, heightSegments, segments);
      bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(overhangColorArray, 3));
    }

    const wireGeo = new THREE.WireframeGeometry(bodyGeo);
    
    // Calculate effective base radius
    const bottomRadiusMM = radiiAtHeight[0] / SCALE;
    const maxRadiusMM = maxRadius / SCALE;
    
    let effectiveBaseRadius: number;
    switch (params.baseSizeMode) {
      case 'tray':
        effectiveBaseRadius = maxRadiusMM;
        break;
      case 'custom':
        effectiveBaseRadius = params.standBaseRadius;
        break;
      case 'auto':
      default:
        effectiveBaseRadius = bottomRadiusMM;
        break;
    }
    
    let standGeo: THREE.BufferGeometry | null = null;
    
    // Generate tripod legs using the leg generator
    if (addLegs && params.standType === 'tripod') {
      const legGeoMM = generateLegsWithBase(
        effectiveBaseRadius,
        params.legCount,
        params.legHeight,
        params.legSpread,
        params.legThickness,
        params.legTaper,
        params.legInset,
        params.standBaseThickness || 3,
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
        undefined, // attachmentParams no longer used
        {
          thickness: params.standBaseThickness,
          taper: params.standBaseTaper,
          edgeStyle: params.standBaseEdgeStyle,
          lip: params.standBaseLip,
        },
        params.legStyle || 'tripod'
      );
      legGeoMM.scale(SCALE, SCALE, SCALE);
      standGeo = legGeoMM;
    } else if (addLegs && params.standType === 'wall_mount' && params.wallMountStyle === 'base') {
      // Base mount with keyholes
      const baseMountGeoMM = generateBaseMountPlate(
        effectiveBaseRadius,
        params.standBaseThickness || 3,
        params.wallMountHoleCount,
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
        },
        undefined,
        {
          thickness: params.standBaseThickness,
          taper: params.standBaseTaper,
          edgeStyle: params.standBaseEdgeStyle,
          lip: params.standBaseLip,
        }
      );
      baseMountGeoMM.scale(SCALE, SCALE, SCALE);
      standGeo = baseMountGeoMM;
    }

    return { 
      bodyGeometry: bodyGeo, 
      wireframeGeo: wireGeo, 
      legGeometry: standGeo, 
      overhangColors: overhangColorArray,
      keyholeGeometries,
      cordHoleGeometry,
    };
  }, [params, type]);

  useFrame((state) => {
    if (autoRotate && groupRef.current) {
      const rotation = state.clock.elapsedTime * 0.15;
      groupRef.current.rotation.y = rotation;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Legs */}
      {legGeometry && (
        <mesh geometry={legGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={legMaterialConfig.color}
            roughness={legMaterialConfig.roughness}
            metalness={legMaterialConfig.metalness}
            clearcoat={legMaterialConfig.clearcoat ?? 0}
            clearcoatRoughness={legMaterialConfig.clearcoatRoughness ?? 0}
            transmission={legMaterialConfig.transmission ?? 0}
            thickness={legMaterialConfig.thickness ?? 0}
            ior={legMaterialConfig.ior ?? 1.5}
            envMapIntensity={legMaterialConfig.envMapIntensity ?? 1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* Organic body - hidden in base only preview mode */}
      {!params.showBaseOnly && (
        <mesh geometry={bodyGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={params.showOverhangMap ? "#ffffff" : materialConfig.color}
            vertexColors={params.showOverhangMap}
            roughness={materialConfig.roughness}
            metalness={materialConfig.metalness}
            clearcoat={materialConfig.clearcoat ?? 0}
            clearcoatRoughness={materialConfig.clearcoatRoughness ?? 0}
            transmission={materialConfig.transmission ?? 0}
            thickness={materialConfig.thickness ?? 0}
            ior={materialConfig.ior ?? 1.5}
            envMapIntensity={materialConfig.envMapIntensity ?? 1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* Keyhole mounting holes for wall mount */}
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
      
      {/* Cord hole for wall mount */}
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
