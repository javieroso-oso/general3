import * as THREE from 'three';
import { 
  ParametricStandParams, 
  LegProfile, 
  HubStyle, 
  FootStyle,
  getSocketHolderDims,
  plugSpecs,
  isWoojStyle
} from '@/types/stand';

// ============================================
// PARAMETRIC STAND GENERATORS
// Internal plug system - plug fits inside object's socket
// ============================================

// Plug dimensions (fits inside object's socket)
const getPlugDimensions = (plugSize: number, plugHeight: number) => {
  const plugRadius = plugSize / 2;
  const clearance = plugSpecs.clearance;
  
  return {
    radius: plugRadius - clearance,  // Slightly smaller for friction fit
    height: plugHeight,
    taperAngle: plugSpecs.taperAngle,
  };
};

// ============================================
// PLUG GENERATOR
// Cylinder that fits inside object's socket
// ============================================

function generatePlug(params: ParametricStandParams, topY: number): THREE.BufferGeometry {
  const plug = getPlugDimensions(params.plugSize, params.plugHeight);
  
  // Create slightly tapered plug for easy insertion
  const topRadius = plug.radius;
  const bottomRadius = plug.radius * 0.98; // Subtle taper
  
  const plugGeom = new THREE.CylinderGeometry(
    topRadius, 
    bottomRadius, 
    plug.height, 
    32
  );
  plugGeom.translate(0, topY - plug.height / 2, 0);
  
  return plugGeom;
}

// ============================================
// WOOJ SPLAYED TRIPOD
// Ultra-thin straight legs with internal plug
// ============================================

function generateWoojSplayedTripod(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plugTop = params.height;
  const plugBottom = plugTop - params.plugHeight;
  
  // 1. Internal plug at top (hidden inside object)
  geometries.push(generatePlug(params, plugTop));
  
  // 2. Ultra-thin splayed legs
  const legCount = params.legCount;
  const legAngleStep = (Math.PI * 2) / legCount;
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  
  // Legs start from bottom edge of plug, angle outward to ground
  const plugRadius = params.plugSize / 2 - plugSpecs.clearance;
  const bottomSpreadRadius = plugRadius + plugBottom * Math.tan(legSpreadRad);
  
  for (let i = 0; i < legCount; i++) {
    const angle = i * legAngleStep;
    
    // Start at plug bottom edge
    const startX = Math.cos(angle) * plugRadius * 0.8;
    const startZ = Math.sin(angle) * plugRadius * 0.8;
    
    // End at floor, spread outward
    const endX = Math.cos(angle) * bottomSpreadRadius;
    const endZ = Math.sin(angle) * bottomSpreadRadius;
    
    const startPoint = new THREE.Vector3(startX, plugBottom, startZ);
    const endPoint = new THREE.Vector3(endX, 0, endZ);
    
    // Generate thin leg
    const legGeom = generateStraightLeg(params, startPoint, endPoint);
    if (legGeom.getAttribute('position')?.count > 0) {
      geometries.push(legGeom);
    }
    
    // Minimal pointed feet
    if (params.footStyle !== 'none') {
      const footGeom = generateMinimalFoot(params, endPoint);
      if (footGeom) geometries.push(footGeom);
    }
  }
  
  return mergeGeometries(geometries);
}

// Straight leg for WOOJ style (no curve, clean taper)
function generateStraightLeg(
  params: ParametricStandParams,
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3
): THREE.BufferGeometry {
  const { legThickness, legTaper, legProfile } = params;
  
  const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
  const length = direction.length();
  
  if (length < 1) return new THREE.BufferGeometry();
  
  direction.normalize();
  
  // Simple straight path
  const pathPoints: THREE.Vector3[] = [];
  const segments = 12;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
    pathPoints.push(point);
  }
  
  const path = new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.5);
  
  const radialSegments = legProfile === 'square' ? 4 : legProfile === 'angular' ? 6 : 8;
  const baseRadius = legThickness / 2;
  
  // Create tube geometry
  const tubeGeom = new THREE.TubeGeometry(path, segments, baseRadius, radialSegments, false);
  
  // Apply strong taper (WOOJ style has pointed ends)
  if (legTaper > 0.01) {
    const positions = tubeGeom.getAttribute('position');
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      // t based on Y (top to bottom)
      const t = Math.max(0, Math.min(1, 1 - (vertex.y - endPoint.y) / (startPoint.y - endPoint.y)));
      
      const pathPoint = path.getPointAt(Math.min(1, Math.max(0, t)));
      const offset = vertex.clone().sub(pathPoint);
      
      // Strong taper: 1 at top, very small at bottom
      const taperScale = 1 - (t * legTaper * 0.9);
      offset.multiplyScalar(Math.max(0.1, taperScale));
      
      const newPos = pathPoint.clone().add(offset);
      positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
    }
    
    positions.needsUpdate = true;
  }
  
  tubeGeom.computeVertexNormals();
  return tubeGeom;
}

// Minimal pointed foot for WOOJ style
function generateMinimalFoot(
  params: ParametricStandParams,
  position: THREE.Vector3
): THREE.BufferGeometry | null {
  const { footStyle, footScale } = params;
  
  if (footStyle === 'none') return null;
  
  const size = 3 * footScale;
  
  if (footStyle === 'spike') {
    // Tiny pointed spike
    const spikeGeom = new THREE.ConeGeometry(size, size * 2, 8);
    spikeGeom.translate(position.x, position.y + size, position.z);
    return spikeGeom;
  }
  
  // Small sphere foot
  const sphereGeom = new THREE.SphereGeometry(size, 8, 6);
  sphereGeom.translate(position.x, position.y + size / 2, position.z);
  return sphereGeom;
}

// ============================================
// RIBBED PEDESTAL
// Vertical fluted cylinder base with plug
// ============================================

function generateRibbedPedestal(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plugTop = params.height;
  const pedestalHeight = params.height - params.plugHeight;
  const baseRadius = params.plugSize / 2 + 10;
  const ribCount = params.ribCount || 16;
  
  // 1. Internal plug at top
  geometries.push(generatePlug(params, plugTop));
  
  // 2. Ribbed cylinder (fluted)
  const ribShape = new THREE.Shape();
  const angleStep = (Math.PI * 2) / (ribCount * 4);
  const ribDepth = 3;
  
  for (let i = 0; i <= ribCount * 4; i++) {
    const angle = i * angleStep;
    const ribFactor = Math.cos(angle * ribCount) * 0.5 + 0.5;
    const r = baseRadius - ribDepth * ribFactor;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    
    if (i === 0) {
      ribShape.moveTo(x, z);
    } else {
      ribShape.lineTo(x, z);
    }
  }
  ribShape.closePath();
  
  const extrudeSettings = {
    depth: pedestalHeight,
    bevelEnabled: true,
    bevelThickness: 2,
    bevelSize: 2,
    bevelSegments: 2,
  };
  
  const pedestalGeom = new THREE.ExtrudeGeometry(ribShape, extrudeSettings);
  pedestalGeom.rotateX(-Math.PI / 2);
  pedestalGeom.translate(0, 0, 0);
  geometries.push(pedestalGeom);
  
  return mergeGeometries(geometries);
}

// ============================================
// FLOATING RING
// Simple torus ring at base with plug
// ============================================

function generateFloatingRing(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plugTop = params.height;
  const ringThickness = params.ringThickness || 6;
  const ringRadius = params.plugSize / 2 + 15;
  const stemHeight = params.height - params.plugHeight - ringThickness * 2;
  
  // 1. Internal plug at top
  geometries.push(generatePlug(params, plugTop));
  
  // 2. Thin stem from plug to ring
  const stemRadius = ringThickness / 2;
  const stemGeom = new THREE.CylinderGeometry(stemRadius, stemRadius, stemHeight, 16);
  stemGeom.translate(0, ringThickness + stemHeight / 2, 0);
  geometries.push(stemGeom);
  
  // 3. Floating ring (torus) at base
  const torusGeom = new THREE.TorusGeometry(ringRadius, ringThickness / 2, 16, 48);
  torusGeom.rotateX(Math.PI / 2);
  torusGeom.translate(0, ringThickness / 2, 0);
  geometries.push(torusGeom);
  
  return mergeGeometries(geometries);
}

// ============================================
// ORIGINAL STAND GENERATORS (with plug integration)
// ============================================

// Generate clean, minimal cup socket (where object sits) - kept for pendant/wall
function generateCupSocket(plugSize: number, topY: number): THREE.BufferGeometry {
  const plugRadius = plugSize / 2;
  const clearance = 0.5;
  const wallThickness = 3;
  const cupDepth = 8;
  
  const innerRadius = plugRadius + clearance;
  const outerRadius = plugRadius + clearance + wallThickness;
  
  const points: THREE.Vector2[] = [];
  points.push(new THREE.Vector2(innerRadius * 0.8, topY - cupDepth));
  points.push(new THREE.Vector2(innerRadius, topY - cupDepth + 2));
  points.push(new THREE.Vector2(innerRadius, topY - 1));
  points.push(new THREE.Vector2(outerRadius, topY));
  points.push(new THREE.Vector2(outerRadius, topY - cupDepth));
  points.push(new THREE.Vector2(innerRadius * 0.8, topY - cupDepth));
  
  return new THREE.LatheGeometry(points, 32);
}

// Generate socket holder for electrical socket (E26/E27)
function generateSocketHolder(params: ParametricStandParams, topY: number): THREE.BufferGeometry {
  const dims = getSocketHolderDims(params.socketType);
  const points: THREE.Vector2[] = [];
  
  const holderTopY = topY - 5;
  const holderBottomY = holderTopY - dims.height;
  
  points.push(new THREE.Vector2(dims.cordHoleRadius, holderBottomY));
  points.push(new THREE.Vector2(dims.innerRadius, holderBottomY + 3));
  points.push(new THREE.Vector2(dims.innerRadius, holderTopY - 3));
  points.push(new THREE.Vector2(dims.innerRadius - 1.5, holderTopY));
  points.push(new THREE.Vector2(dims.outerRadius, holderTopY));
  points.push(new THREE.Vector2(dims.outerRadius, holderBottomY));
  points.push(new THREE.Vector2(dims.cordHoleRadius, holderBottomY));
  
  return new THREE.LatheGeometry(points, 24);
}

// Generate a leg using TubeGeometry (for non-WOOJ styles)
function generateParametricLeg(
  params: ParametricStandParams,
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3
): THREE.BufferGeometry {
  const { legProfile, legThickness, legCurve, legTaper } = params;
  
  const segments = 16;
  const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
  const length = direction.length();
  
  if (length < 1) return new THREE.BufferGeometry();
  
  direction.normalize();
  
  const horizontalDir = new THREE.Vector3(startPoint.x, 0, startPoint.z).normalize();
  
  const pathPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
    
    if (legCurve > 0) {
      const curveAmount = legCurve * length * 0.1;
      const curveFactor = 4 * t * (1 - t);
      point.addScaledVector(horizontalDir, curveFactor * curveAmount);
    }
    
    pathPoints.push(point);
  }
  
  const path = new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.5);
  
  const radialSegments = legProfile === 'square' ? 4 : legProfile === 'angular' ? 6 : 8;
  const baseRadius = legThickness / 2;
  
  const tubeGeom = new THREE.TubeGeometry(path, segments, baseRadius, radialSegments, false);
  
  if (legTaper > 0.01) {
    const positions = tubeGeom.getAttribute('position');
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      const t = Math.max(0, Math.min(1, 1 - (vertex.y - endPoint.y) / (startPoint.y - endPoint.y)));
      const pathPoint = path.getPointAt(Math.min(1, Math.max(0, t)));
      const offset = vertex.clone().sub(pathPoint);
      const taperScale = 1 - (t * legTaper * 0.5);
      offset.multiplyScalar(Math.max(0.5, taperScale));
      
      const newPos = pathPoint.clone().add(offset);
      positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
    }
    
    positions.needsUpdate = true;
  }
  
  tubeGeom.computeVertexNormals();
  return tubeGeom;
}

// Generate hub (for non-WOOJ styles)
function generateHub(
  hubStyle: HubStyle,
  hubScale: number,
  baseRadius: number,
  topY: number,
  bottomY: number
): THREE.BufferGeometry {
  if (hubStyle === 'hidden') {
    return new THREE.BufferGeometry();
  }
  
  const r = baseRadius;
  const height = topY - bottomY;
  const legAttachY = bottomY + height * 0.25;
  
  const points: THREE.Vector2[] = [];
  
  switch (hubStyle) {
    case 'sphere':
      points.push(new THREE.Vector2(0, bottomY));
      points.push(new THREE.Vector2(r * 0.7, bottomY));
      points.push(new THREE.Vector2(r, legAttachY));
      points.push(new THREE.Vector2(r * 0.85, bottomY + height * 0.5));
      points.push(new THREE.Vector2(r * 0.6, topY - height * 0.15));
      points.push(new THREE.Vector2(r * 0.45, topY));
      points.push(new THREE.Vector2(0, topY));
      break;
      
    case 'disc':
      points.push(new THREE.Vector2(0, bottomY));
      points.push(new THREE.Vector2(r * 1.1, bottomY));
      points.push(new THREE.Vector2(r * 1.1, legAttachY));
      points.push(new THREE.Vector2(r * 0.9, bottomY + height * 0.5));
      points.push(new THREE.Vector2(r * 0.5, topY));
      points.push(new THREE.Vector2(0, topY));
      break;
      
    case 'cone':
      points.push(new THREE.Vector2(0, bottomY));
      points.push(new THREE.Vector2(r, bottomY));
      points.push(new THREE.Vector2(r, legAttachY));
      points.push(new THREE.Vector2(r * 0.5, bottomY + height * 0.5));
      points.push(new THREE.Vector2(r * 0.25, topY));
      points.push(new THREE.Vector2(0, topY));
      break;
      
    case 'minimal':
      points.push(new THREE.Vector2(0, bottomY));
      points.push(new THREE.Vector2(r * 0.9, bottomY));
      points.push(new THREE.Vector2(r, legAttachY));
      points.push(new THREE.Vector2(r * 0.6, bottomY + height * 0.5));
      points.push(new THREE.Vector2(r * 0.4, topY));
      points.push(new THREE.Vector2(0, topY));
      break;
      
    case 'smooth':
    default:
      points.push(new THREE.Vector2(0, bottomY));
      points.push(new THREE.Vector2(r * 0.85, bottomY));
      points.push(new THREE.Vector2(r, legAttachY));
      points.push(new THREE.Vector2(r * 0.8, bottomY + height * 0.5));
      points.push(new THREE.Vector2(r * 0.55, topY));
      points.push(new THREE.Vector2(0, topY));
      break;
  }
  
  return new THREE.LatheGeometry(points, 32);
}

// Generate foot (for non-WOOJ styles)
function generateFoot(
  footStyle: FootStyle,
  footScale: number,
  position: THREE.Vector3,
  hasCordExit: boolean = false
): THREE.BufferGeometry | null {
  if (footStyle === 'none') return null;
  
  const baseSize = 8 * footScale;
  const points: THREE.Vector2[] = [];
  
  switch (footStyle) {
    case 'sphere':
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const angle = t * Math.PI * 0.5;
        const r = Math.cos(angle) * baseSize;
        const y = Math.sin(angle) * baseSize * 0.6;
        points.push(new THREE.Vector2(r, y));
      }
      break;
      
    case 'spike':
      points.push(new THREE.Vector2(0, 0));
      points.push(new THREE.Vector2(baseSize * 0.4, baseSize * 0.3));
      points.push(new THREE.Vector2(baseSize * 0.5, baseSize));
      points.push(new THREE.Vector2(0, baseSize));
      break;
      
    case 'flare':
      if (hasCordExit) {
        points.push(new THREE.Vector2(3, 0));
        points.push(new THREE.Vector2(baseSize * 0.8, baseSize * 0.15));
      } else {
        points.push(new THREE.Vector2(0, 0));
        points.push(new THREE.Vector2(baseSize * 0.8, baseSize * 0.15));
      }
      points.push(new THREE.Vector2(baseSize, baseSize * 0.5));
      points.push(new THREE.Vector2(baseSize * 0.6, baseSize));
      points.push(new THREE.Vector2(0, baseSize));
      break;
      
    case 'pad':
    default:
      if (hasCordExit) {
        points.push(new THREE.Vector2(3, 0));
      } else {
        points.push(new THREE.Vector2(0, 0));
      }
      points.push(new THREE.Vector2(baseSize * 0.7, 0));
      points.push(new THREE.Vector2(baseSize * 0.8, baseSize * 0.3));
      points.push(new THREE.Vector2(baseSize * 0.5, baseSize * 0.5));
      points.push(new THREE.Vector2(0, baseSize * 0.5));
      break;
  }
  
  const geom = new THREE.LatheGeometry(points, 12);
  geom.translate(position.x, position.y, position.z);
  
  return geom;
}

// Classic tripod with plug (for non-WOOJ styles)
function generateClassicTripod(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plugTop = params.height;
  const plugBottom = plugTop - params.plugHeight;
  const hubHeight = 20 * params.hubScale;
  const hubTopY = plugBottom;
  const hubBottomY = hubTopY - hubHeight;
  
  const plugRadius = params.plugSize / 2 - plugSpecs.clearance;
  const hubMaxRadius = plugRadius * params.hubScale;
  
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  const bottomSpreadRadius = hubMaxRadius * 2 + hubBottomY * Math.tan(legSpreadRad);
  
  // 1. Internal plug
  geometries.push(generatePlug(params, plugTop));
  
  // 2. Socket holder (if enabled)
  if (params.showSocketHolder) {
    geometries.push(generateSocketHolder(params, plugBottom));
  }
  
  // 3. Hub
  if (params.hubStyle !== 'hidden') {
    const hubGeom = generateHub(
      params.hubStyle,
      params.hubScale,
      hubMaxRadius,
      hubTopY,
      hubBottomY
    );
    geometries.push(hubGeom);
  }
  
  // 4. Legs
  const legAngleStep = (Math.PI * 2) / params.legCount;
  const legStartY = hubBottomY + hubHeight * 0.4;
  const legStartRadius = hubMaxRadius * 0.5;
  
  for (let i = 0; i < params.legCount; i++) {
    const angle = i * legAngleStep;
    const isCordLeg = params.showSocketHolder && i === params.cordExitLeg;
    
    const startX = Math.cos(angle) * legStartRadius;
    const startZ = Math.sin(angle) * legStartRadius;
    
    const endX = Math.cos(angle) * bottomSpreadRadius;
    const endZ = Math.sin(angle) * bottomSpreadRadius;
    
    const startPoint = new THREE.Vector3(startX, legStartY, startZ);
    const endPoint = new THREE.Vector3(endX, 0, endZ);
    
    const legGeom = generateParametricLeg(params, startPoint, endPoint);
    if (legGeom.getAttribute('position')?.count > 0) {
      geometries.push(legGeom);
    }
    
    const footGeom = generateFoot(
      params.footStyle,
      params.footScale,
      new THREE.Vector3(endX, 0, endZ),
      isCordLeg
    );
    if (footGeom) geometries.push(footGeom);
  }
  
  return mergeGeometries(geometries);
}

// Generate parametric tripod stand (routes to appropriate generator)
export function generateParametricTripod(params: ParametricStandParams): THREE.BufferGeometry {
  // Route to WOOJ-style generators
  if (params.style === 'wooj_splayed') {
    return generateWoojSplayedTripod(params);
  }
  if (params.style === 'ribbed_pedestal') {
    return generateRibbedPedestal(params);
  }
  if (params.style === 'floating_ring') {
    return generateFloatingRing(params);
  }
  
  // Classic style
  return generateClassicTripod(params);
}

// Generate parametric pendant
export function generateParametricPendant(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const plugTop = params.height;
  const canopyDiameter = 50 + params.plugSize * 0.2;
  const canopyHeight = 15;
  const totalHeight = plugTop + params.cordLength + canopyHeight;
  
  // 1. Clean canopy
  const canopyPoints: THREE.Vector2[] = [];
  canopyPoints.push(new THREE.Vector2(3, totalHeight - canopyHeight));
  canopyPoints.push(new THREE.Vector2(canopyDiameter / 2, totalHeight - canopyHeight));
  canopyPoints.push(new THREE.Vector2(canopyDiameter / 2 - 3, totalHeight));
  canopyPoints.push(new THREE.Vector2(3, totalHeight));
  const canopyGeom = new THREE.LatheGeometry(canopyPoints, 24);
  geometries.push(canopyGeom);
  
  // 2. Slim cord
  const cordThickness = params.legThickness * 0.3;
  const cordGeom = new THREE.CylinderGeometry(cordThickness, cordThickness, params.cordLength, 8);
  cordGeom.translate(0, totalHeight - canopyHeight - params.cordLength / 2, 0);
  geometries.push(cordGeom);
  
  // 3. Transition piece
  const plugRadius = params.plugSize / 2;
  const transitionHeight = 12;
  const transitionPoints: THREE.Vector2[] = [];
  transitionPoints.push(new THREE.Vector2(0, plugTop + params.plugHeight));
  transitionPoints.push(new THREE.Vector2(plugRadius * 0.8, plugTop + params.plugHeight));
  transitionPoints.push(new THREE.Vector2(cordThickness * 1.5, plugTop + params.plugHeight + transitionHeight));
  transitionPoints.push(new THREE.Vector2(0, plugTop + params.plugHeight + transitionHeight));
  const transitionGeom = new THREE.LatheGeometry(transitionPoints, 16);
  geometries.push(transitionGeom);
  
  // 4. Socket holder (if enabled)
  if (params.showSocketHolder) {
    geometries.push(generateSocketHolder(params, plugTop));
  }
  
  // 5. Internal plug or cup socket
  if (isWoojStyle(params.style)) {
    geometries.push(generatePlug(params, plugTop));
  } else {
    geometries.push(generateCupSocket(params.plugSize, plugTop));
  }
  
  return mergeGeometries(geometries);
}

// Generate parametric wall arm
export function generateParametricWallArm(params: ParametricStandParams): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const backplateWidth = 60;
  const backplateHeight = 80;
  const wallThickness = 6;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight * 0.6 + params.armLength * Math.sin(armAngleRad);
  const socketTopY = armEndY + 15;
  
  // 1. Clean backplate
  const backplateShape = new THREE.Shape();
  backplateShape.moveTo(-backplateWidth / 2, 0);
  backplateShape.lineTo(backplateWidth / 2, 0);
  backplateShape.lineTo(backplateWidth / 2, backplateHeight);
  backplateShape.lineTo(-backplateWidth / 2, backplateHeight);
  backplateShape.lineTo(-backplateWidth / 2, 0);
  
  const backplateGeom = new THREE.ExtrudeGeometry(backplateShape, {
    depth: wallThickness,
    bevelEnabled: false
  });
  geometries.push(backplateGeom);
  
  // 2. Arm
  const armStart = new THREE.Vector3(0, backplateHeight * 0.6, wallThickness);
  const armEnd = new THREE.Vector3(0, armEndY, armEndZ);
  const armGeom = generateParametricLeg(params, armStart, armEnd);
  if (armGeom.getAttribute('position')?.count > 0) {
    geometries.push(armGeom);
  }
  
  // 3. Transition
  const plugRadius = params.plugSize / 2;
  const transitionHeight = 10;
  const transitionPoints: THREE.Vector2[] = [];
  transitionPoints.push(new THREE.Vector2(0, 0));
  transitionPoints.push(new THREE.Vector2(plugRadius * 0.7, 0));
  transitionPoints.push(new THREE.Vector2(params.legThickness * 0.5, transitionHeight));
  transitionPoints.push(new THREE.Vector2(0, transitionHeight));
  const transitionGeom = new THREE.LatheGeometry(transitionPoints, 12);
  transitionGeom.translate(0, armEndY, armEndZ);
  geometries.push(transitionGeom);
  
  // 4. Socket holder (if enabled)
  if (params.showSocketHolder) {
    const holderGeom = generateSocketHolder(params, socketTopY);
    holderGeom.translate(0, 0, armEndZ);
    geometries.push(holderGeom);
  }
  
  // 5. Internal plug or cup socket
  if (isWoojStyle(params.style)) {
    const plugGeom = generatePlug(params, socketTopY);
    plugGeom.translate(0, 0, armEndZ);
    geometries.push(plugGeom);
  } else {
    const cupPoints: THREE.Vector2[] = [];
    const innerRadius = plugRadius + 0.5;
    const outerRadius = plugRadius + 3.5;
    cupPoints.push(new THREE.Vector2(innerRadius * 0.8, -8));
    cupPoints.push(new THREE.Vector2(innerRadius, -8 + 2));
    cupPoints.push(new THREE.Vector2(innerRadius, -1));
    cupPoints.push(new THREE.Vector2(outerRadius, 0));
    cupPoints.push(new THREE.Vector2(outerRadius, -8));
    cupPoints.push(new THREE.Vector2(innerRadius * 0.8, -8));
    
    const cupGeom = new THREE.LatheGeometry(cupPoints, 32);
    cupGeom.translate(0, socketTopY, armEndZ);
    geometries.push(cupGeom);
  }
  
  return mergeGeometries(geometries);
}

// Main generator function
export function generateParametricStandGeometry(params: ParametricStandParams): THREE.BufferGeometry {
  if (!params.enabled) return new THREE.BufferGeometry();
  
  switch (params.mountType) {
    case 'tripod':
      return generateParametricTripod(params);
    case 'pendant':
      return generateParametricPendant(params);
    case 'wall_arm':
      return generateParametricWallArm(params);
    default:
      return new THREE.BufferGeometry();
  }
}

// Get plug height for positioning
export function getParametricPlugHeight(params: ParametricStandParams): number {
  return params.plugHeight;
}

// Merge geometries helper
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const validGeometries = geometries.filter(geom => {
    const pos = geom.getAttribute('position');
    return pos && pos.count > 0;
  });
  
  if (validGeometries.length === 0) return new THREE.BufferGeometry();
  
  let totalVertices = 0;
  let totalIndices = 0;
  
  for (const geom of validGeometries) {
    const pos = geom.getAttribute('position');
    if (pos) totalVertices += pos.count;
    const idx = geom.getIndex();
    if (idx) totalIndices += idx.count;
  }
  
  if (totalVertices === 0) return new THREE.BufferGeometry();
  
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices: number[] = [];
  
  let vertexOffset = 0;
  
  for (const geom of validGeometries) {
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    if (!pos) continue;
    
    for (let i = 0; i < pos.count; i++) {
      positions[(vertexOffset + i) * 3] = pos.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = pos.getZ(i);
      
      if (norm) {
        normals[(vertexOffset + i) * 3] = norm.getX(i);
        normals[(vertexOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vertexOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }
    
    const idx = geom.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(vertexOffset + i);
      }
    }
    
    vertexOffset += pos.count;
  }
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  
  return merged;
}