import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParametricParams, ObjectType, printConstraints, AttachmentType } from '@/types/parametric';
import { getOverhangVertexColors } from '@/lib/support-free-constraints';
import { generateLegsWithBase, generateBaseMountPlate, AttachmentParams } from '@/lib/leg-generator';
import { 
  validateBaseConfig, 
  getMinimumBodyRadius,
  ValidationResult,
  composeBase,
  BaseAssembly,
} from '@/lib/base';
import {
  SocketMountConfig,
  StandConfig,
  ConnectorConfig,
  SOCKET_THREAD_DIAMETERS,
} from '@/lib/base/types';

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
    
    // For wall mount with BACK style, we generate FULL 360° object then slice with a plane
    // BASE style wall mount keeps full 360° body and adds a base plate with keyholes
    const isWallMount = addLegs && params.standType === 'wall_mount' && params.wallMountStyle === 'back';
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

        // Asymmetry - now much crazier with multiple patterns
        if (asymmetry > 0) {
          // Primary wave - large one-sided bulge
          const primaryWave = Math.sin(theta) * Math.cos(t * Math.PI) * asymmetry * bRad;
          // Secondary wave - twisting asymmetry along height
          const secondaryWave = Math.sin(theta * 2 + t * Math.PI * 3) * asymmetry * 0.5 * bRad;
          // Directional lean - the whole shape leans
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
    // CORRECT keyhole: large circle at TOP (where you insert screw head), narrow slot going UP (slide up to lock)
    // When hung on wall: insert screw head in large hole, slide DOWN so screw shaft goes into narrow slot
    const createKeyholeVisual = (cx: number, cy: number, zPos: number): THREE.BufferGeometry => {
      const segs = 32;
      const headRadius = 4 * SCALE;    // 8mm diameter head hole (large circle)
      const slotWidth = 2 * SCALE;     // 4mm wide slot for screw shaft
      const slotLength = 8 * SCALE;    // 8mm slot length going UP from circle
      const depth = 3 * SCALE;         // 3mm depth (goes through back wall)
      
      // Create 2D keyhole shape: large circle at BOTTOM, narrow slot going UP
      // This is correct because when you hang something:
      // 1. Put screw in wall
      // 2. Position large hole over screw head
      // 3. Slide object DOWN so screw shaft enters narrow slot above
      const shape = new THREE.Shape();
      
      // Draw circle (large opening at bottom for screw head entry)
      shape.moveTo(headRadius, 0);
      for (let i = 1; i <= segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        shape.lineTo(Math.cos(angle) * headRadius, Math.sin(angle) * headRadius);
      }
      
      // Add the slot going UP from the circle
      const slotPath = new THREE.Path();
      slotPath.moveTo(slotWidth, headRadius * 0.5);
      slotPath.lineTo(slotWidth, slotLength);
      
      // Rounded top of slot
      for (let i = 0; i <= segs / 2; i++) {
        const angle = (i / (segs / 2)) * Math.PI;
        slotPath.lineTo(
          Math.cos(angle) * slotWidth,
          slotLength + Math.sin(angle) * slotWidth
        );
      }
      
      slotPath.lineTo(-slotWidth, headRadius * 0.5);
      slotPath.closePath();
      
      // Add slot as a hole that will merge with circle
      shape.holes.push(slotPath);
      
      // Actually we need to combine them - let's draw as one continuous shape
      const combinedShape = new THREE.Shape();
      
      // Start from right side where slot meets circle
      combinedShape.moveTo(slotWidth, headRadius * 0.3);
      // Go up the slot right side
      combinedShape.lineTo(slotWidth, slotLength);
      // Round top of slot
      for (let i = 0; i <= segs / 4; i++) {
        const angle = (i / (segs / 4)) * Math.PI;
        combinedShape.lineTo(
          Math.cos(angle) * slotWidth,
          slotLength + Math.sin(angle) * slotWidth
        );
      }
      // Down left side of slot
      combinedShape.lineTo(-slotWidth, headRadius * 0.3);
      // Around the bottom circle (left side, then bottom, then right side back to start)
      for (let i = 0; i <= segs * 0.75; i++) {
        const angle = Math.PI / 2 + (i / (segs * 0.75)) * (Math.PI * 1.5);
        combinedShape.lineTo(Math.cos(angle) * headRadius, Math.sin(angle) * headRadius);
      }
      combinedShape.closePath();
      
      // Extrude to create 3D shape
      const geo = new THREE.ExtrudeGeometry(combinedShape, {
        depth: depth,
        bevelEnabled: false,
      });
      
      // Position: push into the back wall
      geo.translate(cx, cy, zPos - depth);
      return geo;
    };
    
    // Helper to create circular hole visual
    const createCircleVisual = (cx: number, cy: number, radius: number, zPos: number): THREE.BufferGeometry => {
      const geo = new THREE.CylinderGeometry(radius, radius, 2 * SCALE, 32);
      geo.rotateX(Math.PI / 2);
      geo.translate(cx, cy, zPos - 1 * SCALE);
      return geo;
    };

    // Store visual keyhole geometries for wall mount
    let keyholeGeometries: THREE.BufferGeometry[] = [];
    let cordHoleGeometry: THREE.BufferGeometry | null = null;

    if (isWallMount) {
      // Wall mount: clip at z = cutOffset, create proper back wall
      
      // === SMART KEYHOLE POSITIONING ===
      // Minimum dimensions for keyholes
      const KEYHOLE_HEIGHT = 12 * SCALE;     // 12mm keyhole visual height
      const KEYHOLE_MIN_MARGIN = 10 * SCALE; // 10mm minimum from edge
      const KEYHOLE_MIN_SPACING = 25 * SCALE; // 25mm minimum between holes
      
      const holeCount = params.wallMountHoleCount || 2;
      const holeMargin = params.wallMountHoleMargin || 0.15;
      const holePositions: { x: number; y: number }[] = [];
      
      // Calculate available height for keyholes
      const availableHeight = h - 2 * KEYHOLE_MIN_MARGIN;
      
      if (availableHeight >= KEYHOLE_HEIGHT) {
        // We have room for at least one keyhole
        const marginY = Math.max(h * holeMargin, KEYHOLE_MIN_MARGIN + KEYHOLE_HEIGHT / 2);
        const topMarginY = Math.max(h * holeMargin, KEYHOLE_MIN_MARGIN + KEYHOLE_HEIGHT / 2);
        
        if (holeCount === 2 && availableHeight >= KEYHOLE_MIN_SPACING + KEYHOLE_HEIGHT) {
          // Two vertical holes only if there's enough spacing
          const bottomY = Math.max(marginY, KEYHOLE_MIN_MARGIN + KEYHOLE_HEIGHT / 2);
          const topY = Math.min(h - topMarginY, h - KEYHOLE_MIN_MARGIN - KEYHOLE_HEIGHT / 2);
          
          if (topY - bottomY >= KEYHOLE_MIN_SPACING) {
            holePositions.push({ x: 0, y: bottomY });
            holePositions.push({ x: 0, y: topY });
          } else {
            // Not enough vertical space, use single centered hole
            holePositions.push({ x: 0, y: h / 2 });
          }
        } else if (holeCount === 3 && availableHeight >= KEYHOLE_MIN_SPACING) {
          const topY = Math.min(h - topMarginY, h - KEYHOLE_MIN_MARGIN - KEYHOLE_HEIGHT / 2);
          holePositions.push({ x: 0, y: topY });
          
          // Bottom two holes spread horizontally
          const bottomSpread = Math.min(bRad * 0.4, bRad - 5 * SCALE);
          const bottomY = Math.max(marginY, KEYHOLE_MIN_MARGIN + KEYHOLE_HEIGHT / 2);
          if (bottomSpread > 5 * SCALE) {
            holePositions.push({ x: -bottomSpread, y: bottomY });
            holePositions.push({ x: bottomSpread, y: bottomY });
          } else {
            holePositions.push({ x: 0, y: bottomY });
          }
        } else if (holeCount >= 4 && availableHeight >= KEYHOLE_MIN_SPACING) {
          const topSpread = Math.min(tRad * 0.35, tRad - 5 * SCALE);
          const bottomSpread = Math.min(bRad * 0.35, bRad - 5 * SCALE);
          const topY = Math.min(h - topMarginY, h - KEYHOLE_MIN_MARGIN - KEYHOLE_HEIGHT / 2);
          const bottomY = Math.max(marginY, KEYHOLE_MIN_MARGIN + KEYHOLE_HEIGHT / 2);
          
          if (topSpread > 5 * SCALE && bottomSpread > 5 * SCALE && topY - bottomY >= KEYHOLE_MIN_SPACING) {
            holePositions.push({ x: -topSpread, y: topY });
            holePositions.push({ x: topSpread, y: topY });
            holePositions.push({ x: -bottomSpread, y: bottomY });
            holePositions.push({ x: bottomSpread, y: bottomY });
          } else {
            // Fallback to 2 holes
            holePositions.push({ x: 0, y: bottomY });
            holePositions.push({ x: 0, y: topY });
          }
        } else {
          // Single centered hole for short pieces
          holePositions.push({ x: 0, y: h / 2 });
        }
      }
      // If availableHeight < KEYHOLE_HEIGHT, no holes are added (piece too short)
      
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
      
      // === CREATE BACK WALL FROM ACTUAL BODY INTERSECTION ===
      // Scan ALL intersections and use leftmost/rightmost for asymmetric shapes
      
      const edgePoints: { x: number; y: number }[] = [];
      
      for (let i = 0; i <= heightSegments; i++) {
        const t = i / heightSegments;
        const y = t * h;
        
        // Collect ALL intersection points at this height level
        const intersections: number[] = [];
        
        // Scan through all angles to find all intersections with cut plane
        for (let j = 0; j < segments; j++) {
          const idx1 = i * (segments + 1) + j;
          const idx2 = i * (segments + 1) + j + 1;
          
          const x1 = outerVerts[idx1 * 3];
          const z1 = outerVerts[idx1 * 3 + 2];
          const x2 = outerVerts[idx2 * 3];
          const z2 = outerVerts[idx2 * 3 + 2];
          
          // Check if the cut plane crosses between these two vertices
          if ((z1 >= cutOffset && z2 < cutOffset) || (z1 < cutOffset && z2 >= cutOffset)) {
            // Interpolate to find exact intersection point
            const tInterp = (cutOffset - z1) / (z2 - z1);
            const xIntersect = x1 + tInterp * (x2 - x1);
            intersections.push(xIntersect);
          }
        }
        
        // If we found intersections, use leftmost and rightmost
        if (intersections.length >= 2) {
          intersections.sort((a, b) => a - b);
          const leftX = intersections[0];
          const rightX = intersections[intersections.length - 1];
          
          if (Math.abs(rightX - leftX) > 0.001) {
            edgePoints.push({ x: leftX, y });
            edgePoints.push({ x: rightX, y });
          }
        } else if (intersections.length === 1) {
          // Single intersection - use center point on other side
          edgePoints.push({ x: intersections[0], y });
          edgePoints.push({ x: 0, y }); // Center fallback
        } else {
          // No intersection found - fallback to radius calculation
          const radius = radiiAtHeight[i] || bRad;
          const rSquared = radius * radius;
          const zSquared = cutOffset * cutOffset;
          
          if (rSquared > zSquared) {
            const xBoundary = Math.sqrt(rSquared - zSquared);
            edgePoints.push({ x: -xBoundary, y });
            edgePoints.push({ x: xBoundary, y });
          }
        }
      }
      
      // Sort all edge points and create left/right edges
      const leftEdge: { x: number; y: number }[] = [];
      const rightEdge: { x: number; y: number }[] = [];
      
      // Group by Y and take min/max X for each height
      const pointsByY = new Map<number, number[]>();
      for (const pt of edgePoints) {
        const yKey = Math.round(pt.y * 1000); // Round to avoid floating point issues
        if (!pointsByY.has(yKey)) {
          pointsByY.set(yKey, []);
        }
        pointsByY.get(yKey)!.push(pt.x);
      }
      
      // Convert to sorted arrays
      const sortedYKeys = Array.from(pointsByY.keys()).sort((a, b) => a - b);
      for (const yKey of sortedYKeys) {
        const xValues = pointsByY.get(yKey)!;
        const y = yKey / 1000;
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        
        if (Math.abs(maxX - minX) > 0.001) {
          leftEdge.push({ x: minX, y });
          rightEdge.push({ x: maxX, y });
        }
      }
      
      // Build outline for back wall (fillet removed - was broken)
      const outline = [...leftEdge, ...rightEdge.reverse()];
      
      if (outline.length >= 3) {
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
    
    // Calculate effective base radius based on baseSizeMode
    const bottomRadiusMM = radiiAtHeight[0] / SCALE;  // Actual bottom radius of the lamp
    const maxRadiusMM = maxRadius / SCALE;            // Widest point of the lamp
    
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
    
    // Build validation configs from params
    // Note: We always use press-fit-ring for validation even if centering lip disabled
    // This ensures socket dimensions are checked for compatibility
    const socketConfig: SocketMountConfig = {
      type: 'press-fit-ring',
      socketType: params.socketType,
      clearance: 0.5,
      lipHeight: params.centeringLipEnabled ? (params.centeringLipHeight || 3) : 0,
      cordHoleEnabled: params.cordHoleEnabled,
      cordHoleDiameter: params.cordHoleDiameter,
    };
    
    const standConfig: StandConfig = {
      type: params.standType === 'tripod' ? 'tripod' : 
            params.standType === 'weighted_disc' ? 'weighted-disc' : 'wall-mount',
      tripod: params.standType === 'tripod' ? {
        legCount: params.legCount,
        legHeight: params.legHeight,
        legSpread: params.legSpread,
        legThickness: params.legThickness,
        legTaper: params.legTaper,
        legInset: params.legInset,
      } : undefined,
      weightedDisc: params.standType === 'weighted_disc' ? {
        discDiameter: (params.standBaseRadius || effectiveBaseRadius) * 2,
        discThickness: params.standBaseThickness || 8,
        weightCavityEnabled: true,
        weightCavityDiameter: ((params.standBaseRadius || effectiveBaseRadius) * 2) * 0.6,
        weightCavityDepth: (params.standBaseThickness || 8) - 2,
        rubberFeetEnabled: true,
        rubberFeetCount: 3,
        rubberFeetDiameter: 10,
      } : undefined,
      baseThickness: params.standBaseThickness || 3,
      baseTaper: params.standBaseTaper || 0,
      baseEdgeStyle: params.standBaseEdgeStyle || 'flat',
      baseLip: params.standBaseLip || 0,
    };
    
    const connectorConfig: ConnectorConfig = {
      type: params.attachmentType === 'integrated' ? 'integrated' :
            params.attachmentType === 'press_fit' ? 'press-fit' :
            params.attachmentType === 'bayonet' ? 'bayonet' :
            params.attachmentType === 'screw_m3' ? 'screw-m3' : 'screw-m4',
      tolerance: 0.3,
      insertDepth: 5,
      screwCount: params.screwCount,
    };
    
    // Validate base configuration (log warnings to console for now)
    let validation: ValidationResult | null = null;
    let baseAssembly: BaseAssembly | null = null;
    
    if (addLegs) {
      validation = validateBaseConfig(
        effectiveBaseRadius,
        params.height,
        socketConfig,
        standConfig,
        connectorConfig
      );
      
      if (validation.warnings.length > 0) {
        console.log('[Base Validation] Warnings:', validation.warnings);
      }
      if (!validation.isValid) {
        console.warn('[Base Validation] Errors:', validation.errors);
      }
    }
    
    let standGeo: THREE.BufferGeometry | null = null;
    
    // For tripod, use the legacy generator which correctly handles organic deformations
    // The new base system generates simple circular bases - we'll migrate this later
    if (addLegs && params.standType === 'tripod') {
      const attachmentParamsForLegGen: AttachmentParams = {
        attachmentType: params.attachmentType as AttachmentParams['attachmentType'],
        screwCount: params.screwCount,
        baseRadius: params.baseRadius,
      };
      
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
        attachmentParamsForLegGen,
        {
          thickness: params.standBaseThickness,
          taper: params.standBaseTaper,
          edgeStyle: params.standBaseEdgeStyle,
          lip: params.standBaseLip,
        }
      );
      legGeoMM.scale(SCALE, SCALE, SCALE);
      standGeo = legGeoMM;
    } else if (addLegs && params.standType === 'weighted_disc') {
      // Use new composer for weighted disc (doesn't need organic matching)
      baseAssembly = composeBase(
        effectiveBaseRadius,
        params.height,
        socketConfig,
        standConfig,
        connectorConfig
      );
      
      if (baseAssembly.success && baseAssembly.geometry) {
        baseAssembly.geometry.scale(SCALE, SCALE, SCALE);
        standGeo = baseAssembly.geometry;
      }
    } else if (addLegs && params.standType === 'wall_mount' && params.wallMountStyle === 'base') {
      // Base mount with keyholes - a flat plate with mounting holes facing down
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
          centeringLipEnabled: params.centeringLipEnabled,
          centeringLipHeight: params.centeringLipHeight,
          socketType: params.socketType,
        },
        {
          attachmentType: params.attachmentType,
          screwCount: params.screwCount,
          baseRadius: params.baseRadius,
        },
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
    // Wall mount with 'back' style uses integrated back wall keyholes (no separate stand)

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
