import * as THREE from 'three';
import { 
  ParametricStandParams, 
  LegProfile, 
  HubStyle, 
  FootStyle,
  getSocketHolderDims
} from '@/types/stand';

// ============================================
// PARAMETRIC STAND GENERATORS
// Sleek, minimal stands with proper leg attachment
// ============================================

// Socket dimensions for object connection (simple cup)
const getSocketDimensions = (rimSize: number) => {
  const rimRadius = rimSize / 2;
  const clearance = 0.5;
  const wallThickness = 3;
  const cupDepth = 8;
  
  return {
    innerRadius: rimRadius + clearance,
    outerRadius: rimRadius + clearance + wallThickness,
    depth: cupDepth,
  };
};

// Generate clean, minimal cup socket (where object sits)
function generateCupSocket(rimSize: number, topY: number): THREE.BufferGeometry {
  const socket = getSocketDimensions(rimSize);
  const points: THREE.Vector2[] = [];
  
  // Simple, clean cup profile
  points.push(new THREE.Vector2(socket.innerRadius * 0.8, topY - socket.depth));
  points.push(new THREE.Vector2(socket.innerRadius, topY - socket.depth + 2));
  points.push(new THREE.Vector2(socket.innerRadius, topY - 1));
  points.push(new THREE.Vector2(socket.outerRadius, topY));
  points.push(new THREE.Vector2(socket.outerRadius, topY - socket.depth));
  points.push(new THREE.Vector2(socket.innerRadius * 0.8, topY - socket.depth));
  
  return new THREE.LatheGeometry(points, 32);
}

// Generate socket holder for electrical socket (E26/E27)
function generateSocketHolder(params: ParametricStandParams, topY: number): THREE.BufferGeometry {
  const dims = getSocketHolderDims(params.socketType);
  const points: THREE.Vector2[] = [];
  
  const holderTopY = topY - 5;
  const holderBottomY = holderTopY - dims.height;
  
  // Simple hollow cylinder for socket
  points.push(new THREE.Vector2(dims.cordHoleRadius, holderBottomY));
  points.push(new THREE.Vector2(dims.innerRadius, holderBottomY + 3));
  points.push(new THREE.Vector2(dims.innerRadius, holderTopY - 3));
  points.push(new THREE.Vector2(dims.innerRadius - 1.5, holderTopY));
  points.push(new THREE.Vector2(dims.outerRadius, holderTopY));
  points.push(new THREE.Vector2(dims.outerRadius, holderBottomY));
  points.push(new THREE.Vector2(dims.cordHoleRadius, holderBottomY));
  
  return new THREE.LatheGeometry(points, 24);
}

// Generate a safe, robust leg using TubeGeometry
function generateParametricLeg(
  params: ParametricStandParams,
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3
): THREE.BufferGeometry {
  const { legProfile, legThickness, legCurve, legTaper } = params;
  
  const segments = 20;
  const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
  const length = direction.length();
  
  if (length < 1) {
    // Return empty geometry for invalid legs
    return new THREE.BufferGeometry();
  }
  
  direction.normalize();
  
  // Calculate a stable perpendicular vector
  let perpendicular: THREE.Vector3;
  if (Math.abs(direction.y) > 0.9) {
    // Direction is mostly vertical, use X axis as reference
    perpendicular = new THREE.Vector3(1, 0, 0);
  } else {
    // Use Y axis as reference
    const up = new THREE.Vector3(0, 1, 0);
    perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize();
  }
  
  // Generate curved path points
  const pathPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Base position along straight line
    const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
    
    // Add outward curve (parabolic, max at middle)
    const curveAmount = legCurve * length * 0.12;
    const curveFactor = 4 * t * (1 - t); // 0 at ends, 1 at middle
    point.addScaledVector(perpendicular, curveFactor * curveAmount);
    
    pathPoints.push(point);
  }
  
  // Create smooth curve
  const path = new THREE.CatmullRomCurve3(pathPoints);
  
  // Determine radial segments based on profile
  const radialSegments = legProfile === 'square' ? 4 : legProfile === 'angular' ? 6 : 8;
  
  // Calculate radius with taper
  const baseRadius = legThickness / 2;
  const startRadius = baseRadius;
  const endRadius = baseRadius * Math.max(0.4, 1 - legTaper * 0.6);
  
  // Use TubeGeometry for robust, clean legs
  const tubeGeom = new THREE.TubeGeometry(path, segments, baseRadius, radialSegments, false);
  
  // Apply taper by modifying vertices
  const positions = tubeGeom.getAttribute('position');
  const pathLength = path.getLength();
  
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    
    const vertex = new THREE.Vector3(x, y, z);
    
    // Find closest point on path to determine t
    let minDist = Infinity;
    let closestT = 0;
    for (let j = 0; j <= 20; j++) {
      const t = j / 20;
      const pathPoint = path.getPointAt(t);
      const dist = vertex.distanceTo(pathPoint);
      if (dist < minDist) {
        minDist = dist;
        closestT = t;
      }
    }
    
    // Apply taper based on position along path
    const taperScale = 1 - (closestT * legTaper * 0.5);
    const pathPoint = path.getPointAt(closestT);
    
    // Scale vertex position relative to path
    const offset = vertex.clone().sub(pathPoint);
    offset.multiplyScalar(Math.max(0.5, taperScale));
    const newPos = pathPoint.clone().add(offset);
    
    positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
  }
  
  positions.needsUpdate = true;
  tubeGeom.computeVertexNormals();
  
  return tubeGeom;
}

// Generate sleek, minimal hub
function generateHub(
  hubStyle: HubStyle,
  hubScale: number,
  baseRadius: number,
  topY: number,
  bottomY: number
): THREE.BufferGeometry {
  const scaledRadius = baseRadius * hubScale;
  const height = topY - bottomY;
  
  const points: THREE.Vector2[] = [];
  
  switch (hubStyle) {
    case 'sphere':
      // Smooth sphere-like profile
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const angle = t * Math.PI;
        const r = Math.sin(angle) * scaledRadius;
        const y = bottomY + (1 - Math.cos(angle)) * height * 0.5;
        points.push(new THREE.Vector2(r, y));
      }
      break;
      
    case 'disc':
      // Low, wide disc
      points.push(new THREE.Vector2(0, bottomY));
      points.push(new THREE.Vector2(scaledRadius * 1.2, bottomY));
      points.push(new THREE.Vector2(scaledRadius * 1.2, bottomY + height * 0.3));
      points.push(new THREE.Vector2(scaledRadius * 0.8, bottomY + height * 0.4));
      points.push(new THREE.Vector2(0, bottomY + height * 0.4));
      break;
      
    case 'cone':
      // Clean tapered cone
      points.push(new THREE.Vector2(0, bottomY));
      points.push(new THREE.Vector2(scaledRadius, bottomY));
      points.push(new THREE.Vector2(scaledRadius * 0.3, topY));
      points.push(new THREE.Vector2(0, topY));
      break;
      
    case 'minimal':
      // Ultra-clean minimal profile
      points.push(new THREE.Vector2(0, bottomY + height * 0.3));
      points.push(new THREE.Vector2(scaledRadius * 0.6, bottomY + height * 0.3));
      points.push(new THREE.Vector2(scaledRadius * 0.5, topY));
      points.push(new THREE.Vector2(0, topY));
      break;
      
    case 'smooth':
    default:
      // Default smooth tapered cylinder
      points.push(new THREE.Vector2(0, bottomY));
      points.push(new THREE.Vector2(scaledRadius * 0.8, bottomY));
      points.push(new THREE.Vector2(scaledRadius, bottomY + height * 0.2));
      points.push(new THREE.Vector2(scaledRadius * 0.9, topY - height * 0.1));
      points.push(new THREE.Vector2(scaledRadius * 0.7, topY));
      points.push(new THREE.Vector2(0, topY));
      break;
  }
  
  return new THREE.LatheGeometry(points, 24);
}

// Generate minimal foot
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
      // Small spherical foot
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const angle = t * Math.PI * 0.5;
        const r = Math.cos(angle) * baseSize;
        const y = Math.sin(angle) * baseSize * 0.6;
        points.push(new THREE.Vector2(r, y));
      }
      break;
      
    case 'spike':
      // Small pointed spike
      points.push(new THREE.Vector2(0, 0));
      points.push(new THREE.Vector2(baseSize * 0.4, baseSize * 0.3));
      points.push(new THREE.Vector2(baseSize * 0.5, baseSize));
      points.push(new THREE.Vector2(0, baseSize));
      break;
      
    case 'flare':
      // Subtle flare
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
      // Simple pad
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

// Generate parametric tripod stand
export function generateParametricTripod(params: ParametricStandParams): THREE.BufferGeometry {
  const socket = getSocketDimensions(params.rimSize);
  const geometries: THREE.BufferGeometry[] = [];
  
  const socketTop = params.height;
  const hubHeight = 15 * params.hubScale;
  const hubTopY = socketTop - socket.depth;
  const hubBottomY = hubTopY - hubHeight;
  const hubRadius = socket.outerRadius * 0.7 * params.hubScale;
  
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  const effectiveHeight = hubBottomY;
  const bottomSpreadRadius = hubRadius + effectiveHeight * Math.tan(legSpreadRad);
  
  // 1. Cup socket (where object sits)
  geometries.push(generateCupSocket(params.rimSize, socketTop));
  
  // 2. Socket holder for electrical socket (if enabled)
  if (params.showSocketHolder) {
    geometries.push(generateSocketHolder(params, socketTop - socket.depth));
  }
  
  // 3. Clean, minimal hub
  const hubGeom = generateHub(
    params.hubStyle,
    params.hubScale,
    hubRadius,
    hubTopY,
    hubBottomY
  );
  geometries.push(hubGeom);
  
  // 4. Legs - attach properly to hub
  const legAngleStep = (Math.PI * 2) / params.legCount;
  for (let i = 0; i < params.legCount; i++) {
    const angle = i * legAngleStep;
    const isCordLeg = params.showSocketHolder && i === params.cordExitLeg;
    
    // Leg starts at hub's outer edge at the bottom of the hub
    const startRadius = hubRadius * 0.75;
    const startX = Math.cos(angle) * startRadius;
    const startZ = Math.sin(angle) * startRadius;
    
    // Leg ends at foot position on the ground
    const endX = Math.cos(angle) * bottomSpreadRadius;
    const endZ = Math.sin(angle) * bottomSpreadRadius;
    
    // Start point is at the bottom of the hub
    const startPoint = new THREE.Vector3(startX, hubBottomY, startZ);
    const endPoint = new THREE.Vector3(endX, 0, endZ);
    
    const legGeom = generateParametricLeg(params, startPoint, endPoint);
    if (legGeom.getAttribute('position')?.count > 0) {
      geometries.push(legGeom);
    }
    
    // 5. Minimal feet
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

// Generate parametric pendant
export function generateParametricPendant(params: ParametricStandParams): THREE.BufferGeometry {
  const socket = getSocketDimensions(params.rimSize);
  const geometries: THREE.BufferGeometry[] = [];
  
  const socketTop = params.height;
  const canopyDiameter = 50 + params.rimSize * 0.2;
  const canopyHeight = 15;
  const totalHeight = socketTop + params.cordLength + canopyHeight;
  
  // 1. Clean canopy (ceiling mount)
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
  
  // 3. Clean transition piece
  const transitionHeight = 12;
  const transitionPoints: THREE.Vector2[] = [];
  transitionPoints.push(new THREE.Vector2(0, socketTop + socket.depth));
  transitionPoints.push(new THREE.Vector2(socket.outerRadius * 0.8, socketTop + socket.depth));
  transitionPoints.push(new THREE.Vector2(cordThickness * 1.5, socketTop + socket.depth + transitionHeight));
  transitionPoints.push(new THREE.Vector2(0, socketTop + socket.depth + transitionHeight));
  const transitionGeom = new THREE.LatheGeometry(transitionPoints, 16);
  geometries.push(transitionGeom);
  
  // 4. Socket holder (if enabled)
  if (params.showSocketHolder) {
    geometries.push(generateSocketHolder(params, socketTop));
  }
  
  // 5. Cup socket
  geometries.push(generateCupSocket(params.rimSize, socketTop));
  
  return mergeGeometries(geometries);
}

// Generate parametric wall arm
export function generateParametricWallArm(params: ParametricStandParams): THREE.BufferGeometry {
  const socket = getSocketDimensions(params.rimSize);
  const geometries: THREE.BufferGeometry[] = [];
  
  const backplateWidth = 60;
  const backplateHeight = 80;
  const wallThickness = 6;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight * 0.6 + params.armLength * Math.sin(armAngleRad);
  const socketTopY = armEndY + 15;
  
  // 1. Clean backplate
  const backplatePoints: THREE.Vector2[] = [];
  backplatePoints.push(new THREE.Vector2(0, 0));
  backplatePoints.push(new THREE.Vector2(backplateWidth / 2, 0));
  backplatePoints.push(new THREE.Vector2(backplateWidth / 2, backplateHeight));
  backplatePoints.push(new THREE.Vector2(0, backplateHeight));
  
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
  
  // 2. Arm (using parametric leg system)
  const armStart = new THREE.Vector3(0, backplateHeight * 0.6, wallThickness);
  const armEnd = new THREE.Vector3(0, armEndY, armEndZ);
  const armGeom = generateParametricLeg(params, armStart, armEnd);
  if (armGeom.getAttribute('position')?.count > 0) {
    geometries.push(armGeom);
  }
  
  // 3. Clean transition to socket
  const transitionHeight = 10;
  const transitionPoints: THREE.Vector2[] = [];
  transitionPoints.push(new THREE.Vector2(0, 0));
  transitionPoints.push(new THREE.Vector2(socket.outerRadius * 0.7, 0));
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
  
  // 5. Cup socket at arm end
  const cupPoints: THREE.Vector2[] = [];
  cupPoints.push(new THREE.Vector2(socket.innerRadius * 0.8, -socket.depth));
  cupPoints.push(new THREE.Vector2(socket.innerRadius, -socket.depth + 2));
  cupPoints.push(new THREE.Vector2(socket.innerRadius, -1));
  cupPoints.push(new THREE.Vector2(socket.outerRadius, 0));
  cupPoints.push(new THREE.Vector2(socket.outerRadius, -socket.depth));
  cupPoints.push(new THREE.Vector2(socket.innerRadius * 0.8, -socket.depth));
  
  const cupGeom = new THREE.LatheGeometry(cupPoints, 32);
  cupGeom.translate(0, socketTopY, armEndZ);
  geometries.push(cupGeom);
  
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

// Get socket depth for positioning
export function getParametricSocketDepth(rimSize: number): number {
  return getSocketDimensions(rimSize).depth;
}

// Merge geometries helper
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Filter out empty geometries
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
