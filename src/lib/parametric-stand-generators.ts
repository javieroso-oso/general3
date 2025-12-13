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
// Generates stands with customizable leg shapes and styles
// ============================================

// Socket dimensions for object connection (cup that holds the object)
const getSocketDimensions = (rimSize: number) => {
  const rimRadius = rimSize / 2;
  const clearance = 0.3;
  const wallThickness = 4;
  const cupDepth = 10;
  
  return {
    innerRadius: rimRadius + clearance,
    outerRadius: rimRadius + clearance + wallThickness,
    depth: cupDepth,
    lipRadius: rimRadius + clearance + wallThickness + 2,
  };
};

// Generate smooth cup socket (where object sits)
function generateCupSocket(rimSize: number, topY: number): THREE.BufferGeometry {
  const socket = getSocketDimensions(rimSize);
  const points: THREE.Vector2[] = [];
  
  points.push(new THREE.Vector2(0, topY - socket.depth));
  points.push(new THREE.Vector2(socket.innerRadius, topY - socket.depth));
  points.push(new THREE.Vector2(socket.innerRadius, topY - 2));
  
  // Curved lip
  const lipSteps = 8;
  for (let i = 0; i <= lipSteps; i++) {
    const t = i / lipSteps;
    const angle = t * Math.PI / 2;
    const curveRadius = socket.outerRadius - socket.innerRadius;
    const x = socket.innerRadius + Math.sin(angle) * curveRadius;
    const y = topY - 2 + Math.cos(angle) * 2;
    points.push(new THREE.Vector2(x, y));
  }
  
  points.push(new THREE.Vector2(socket.outerRadius, topY - socket.depth + 2));
  points.push(new THREE.Vector2(socket.outerRadius * 0.95, topY - socket.depth));
  points.push(new THREE.Vector2(0, topY - socket.depth));
  
  return new THREE.LatheGeometry(points, 48);
}

// Generate socket holder for electrical socket (E26/E27)
function generateSocketHolder(params: ParametricStandParams, topY: number): THREE.BufferGeometry {
  const dims = getSocketHolderDims(params.socketType);
  const points: THREE.Vector2[] = [];
  
  const holderTopY = topY - 5; // Sits just below cup socket
  const holderBottomY = holderTopY - dims.height;
  
  // Create hollow cylinder with cord hole at bottom
  // Inner wall (socket cavity)
  points.push(new THREE.Vector2(dims.cordHoleRadius, holderBottomY));
  points.push(new THREE.Vector2(dims.innerRadius, holderBottomY + 5));
  points.push(new THREE.Vector2(dims.innerRadius, holderTopY - dims.collarHeight));
  // Collar lip to hold socket
  points.push(new THREE.Vector2(dims.innerRadius - 2, holderTopY - dims.collarHeight));
  points.push(new THREE.Vector2(dims.innerRadius - 2, holderTopY));
  points.push(new THREE.Vector2(dims.outerRadius, holderTopY));
  // Outer wall
  points.push(new THREE.Vector2(dims.outerRadius, holderBottomY));
  points.push(new THREE.Vector2(dims.cordHoleRadius, holderBottomY));
  
  return new THREE.LatheGeometry(points, 24);
}

// Generate cord channel through a leg
function generateCordChannel(
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3,
  radius: number = 4
): THREE.BufferGeometry {
  const path = new THREE.LineCurve3(startPoint, endPoint);
  return new THREE.TubeGeometry(path, 8, radius, 8, false);
}

// Generate leg cross-section based on profile
function getLegCrossSection(profile: LegProfile, thickness: number, segments: number = 8): THREE.Shape {
  const shape = new THREE.Shape();
  const r = thickness / 2;
  
  switch (profile) {
    case 'round':
      // Circle
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      break;
      
    case 'square':
      shape.moveTo(-r, -r);
      shape.lineTo(r, -r);
      shape.lineTo(r, r);
      shape.lineTo(-r, r);
      shape.lineTo(-r, -r);
      break;
      
    case 'angular':
      // Hexagonal
      for (let i = 0; i <= 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      break;
      
    default:
      // Default to round
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
  }
  
  return shape;
}

// Generate a parametric leg with curve, twist, and taper
function generateParametricLeg(
  params: ParametricStandParams,
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3
): THREE.BufferGeometry {
  const { legProfile, legThickness, legCurve, legTwist, legTaper } = params;
  
  const segments = 24;
  const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
  const length = direction.length();
  direction.normalize();
  
  // Calculate perpendicular for curve
  const up = new THREE.Vector3(0, 1, 0);
  const perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize();
  if (perpendicular.length() < 0.1) {
    perpendicular.set(1, 0, 0);
  }
  
  // Generate path points with curve
  const pathPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Base position along straight line
    const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
    
    // Add curve (parabolic curve, max at middle)
    const curveAmount = legCurve * length * 0.15;
    const curveFactor = 4 * t * (1 - t); // Parabola: 0 at ends, 1 at middle
    point.addScaledVector(perpendicular, curveFactor * curveAmount);
    
    pathPoints.push(point);
  }
  
  // Create path
  const path = new THREE.CatmullRomCurve3(pathPoints);
  
  // Generate tube with varying radius (taper)
  const radiusFunction = (t: number) => {
    const baseRadius = legThickness / 2;
    const taperFactor = 1 - legTaper * t;
    return baseRadius * Math.max(0.3, taperFactor);
  };
  
  // Use TubeGeometry with custom radius
  const frames = path.computeFrenetFrames(segments, false);
  
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  
  const radialSegments = legProfile === 'square' ? 4 : legProfile === 'angular' ? 6 : 12;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const radius = radiusFunction(t);
    const point = path.getPointAt(t);
    
    const N = frames.normals[i];
    const B = frames.binormals[i];
    
    // Add twist
    const twistAngle = (legTwist * Math.PI / 180) * t;
    
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2 + twistAngle;
      
      const sin = Math.sin(v);
      const cos = Math.cos(v);
      
      const normal = new THREE.Vector3();
      normal.x = cos * N.x + sin * B.x;
      normal.y = cos * N.y + sin * B.y;
      normal.z = cos * N.z + sin * B.z;
      normal.normalize();
      
      const vertex = new THREE.Vector3();
      vertex.x = point.x + radius * normal.x;
      vertex.y = point.y + radius * normal.y;
      vertex.z = point.z + radius * normal.z;
      
      vertices.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
    }
  }
  
  // Generate indices
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = (i + 1) * (radialSegments + 1) + j;
      const c = (i + 1) * (radialSegments + 1) + j + 1;
      const d = i * (radialSegments + 1) + j + 1;
      
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

// Generate hub with leg attachment shoulders
function generateHub(
  hubStyle: HubStyle,
  hubScale: number,
  baseRadius: number,
  topY: number,
  bottomY: number,
  legCount: number = 3,
  legThickness: number = 8
): THREE.BufferGeometry[] {
  const scaledRadius = baseRadius * hubScale;
  const height = topY - bottomY;
  const geometries: THREE.BufferGeometry[] = [];
  
  // Main hub geometry
  let hubGeom: THREE.BufferGeometry;
  
  switch (hubStyle) {
    case 'sphere':
      hubGeom = new THREE.SphereGeometry(scaledRadius, 24, 16);
      hubGeom.translate(0, bottomY + height / 2, 0);
      break;
      
    case 'disc':
      hubGeom = new THREE.CylinderGeometry(scaledRadius, scaledRadius, height * 0.4, 24);
      hubGeom.translate(0, bottomY + height * 0.5, 0);
      break;
      
    case 'cone':
      hubGeom = new THREE.ConeGeometry(scaledRadius, height, 24);
      hubGeom.rotateX(Math.PI);
      hubGeom.translate(0, bottomY + height / 2, 0);
      break;
      
    case 'minimal':
      // Slightly larger minimal hub for better leg attachment
      hubGeom = new THREE.CylinderGeometry(
        scaledRadius * 0.9,
        scaledRadius * 0.6,
        height * 0.6,
        24
      );
      hubGeom.translate(0, topY - height * 0.3, 0);
      break;
      
    case 'smooth':
    default:
      hubGeom = new THREE.CylinderGeometry(
        scaledRadius,
        scaledRadius * 0.7,
        height,
        24
      );
      hubGeom.translate(0, bottomY + height / 2, 0);
      break;
  }
  
  geometries.push(hubGeom);
  
  // Add leg attachment shoulders/collars for seamless connection
  const shoulderRadius = legThickness * 0.7;
  const shoulderHeight = height * 0.4;
  const legAngleStep = (Math.PI * 2) / legCount;
  
  for (let i = 0; i < legCount; i++) {
    const angle = i * legAngleStep;
    const shoulderX = Math.cos(angle) * scaledRadius * 0.5;
    const shoulderZ = Math.sin(angle) * scaledRadius * 0.5;
    
    // Create tapered shoulder that blends into leg
    const shoulderGeom = new THREE.CylinderGeometry(
      shoulderRadius * 0.8,
      shoulderRadius * 1.2,
      shoulderHeight,
      12
    );
    
    // Rotate shoulder to point outward toward leg
    const outwardAngle = Math.atan2(shoulderZ, shoulderX);
    shoulderGeom.rotateZ(Math.PI / 6); // Slight outward tilt
    shoulderGeom.rotateY(-outwardAngle);
    shoulderGeom.translate(shoulderX, bottomY + shoulderHeight / 2, shoulderZ);
    
    geometries.push(shoulderGeom);
  }
  
  return geometries;
}

// Generate foot based on style
function generateFoot(
  footStyle: FootStyle,
  footScale: number,
  baseRadius: number,
  position: THREE.Vector3,
  hasCordExit: boolean = false
): THREE.BufferGeometry | null {
  if (footStyle === 'none') return null;
  
  const scaledRadius = baseRadius * footScale;
  
  let geom: THREE.BufferGeometry;
  
  switch (footStyle) {
    case 'sphere':
      geom = new THREE.SphereGeometry(scaledRadius, 16, 12);
      geom.translate(position.x, position.y + scaledRadius * 0.5, position.z);
      break;
      
    case 'spike':
      geom = new THREE.ConeGeometry(scaledRadius * 0.5, scaledRadius * 2, 12);
      geom.rotateX(Math.PI);
      geom.translate(position.x, position.y + scaledRadius, position.z);
      break;
      
    case 'flare':
      // Flare with optional cord exit hole
      if (hasCordExit) {
        const points: THREE.Vector2[] = [];
        points.push(new THREE.Vector2(4, 0)); // Cord hole
        points.push(new THREE.Vector2(scaledRadius * 0.6, scaledRadius * 0.2));
        points.push(new THREE.Vector2(scaledRadius * 1.2, scaledRadius * 0.8));
        points.push(new THREE.Vector2(scaledRadius * 1.1, scaledRadius * 0.8));
        points.push(new THREE.Vector2(scaledRadius * 0.5, scaledRadius * 0.2));
        points.push(new THREE.Vector2(4, 0));
        geom = new THREE.LatheGeometry(points, 16);
        geom.translate(position.x, position.y, position.z);
      } else {
        geom = new THREE.CylinderGeometry(scaledRadius * 0.6, scaledRadius * 1.2, scaledRadius * 0.8, 16);
        geom.translate(position.x, position.y + scaledRadius * 0.4, position.z);
      }
      break;
      
    case 'pad':
    default:
      if (hasCordExit) {
        // Pad with cord hole
        const points: THREE.Vector2[] = [];
        points.push(new THREE.Vector2(4, 0)); // Cord hole
        points.push(new THREE.Vector2(scaledRadius * 1.1, 0));
        points.push(new THREE.Vector2(scaledRadius * 1.1, scaledRadius * 0.4));
        points.push(new THREE.Vector2(scaledRadius, scaledRadius * 0.4));
        points.push(new THREE.Vector2(scaledRadius * 0.9, scaledRadius * 0.1));
        points.push(new THREE.Vector2(4, scaledRadius * 0.1));
        points.push(new THREE.Vector2(4, 0));
        geom = new THREE.LatheGeometry(points, 16);
        geom.translate(position.x, position.y, position.z);
      } else {
        geom = new THREE.CylinderGeometry(scaledRadius, scaledRadius * 1.1, scaledRadius * 0.4, 16);
        geom.translate(position.x, position.y + scaledRadius * 0.2, position.z);
      }
      break;
  }
  
  return geom;
}

// Generate parametric tripod stand
export function generateParametricTripod(params: ParametricStandParams): THREE.BufferGeometry {
  const socket = getSocketDimensions(params.rimSize);
  const geometries: THREE.BufferGeometry[] = [];
  
  const socketTop = params.height;
  const hubHeight = 20 * params.hubScale;
  const hubTopY = socketTop - socket.depth;
  const hubBottomY = hubTopY - hubHeight;
  const hubRadius = socket.outerRadius * 0.9 * params.hubScale;
  
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  const bottomSpreadRadius = hubRadius + hubBottomY * Math.tan(legSpreadRad);
  const footPadRadius = 10 * params.footScale;
  
  // 1. Cup socket (where object sits)
  geometries.push(generateCupSocket(params.rimSize, socketTop));
  
  // 2. Socket holder for electrical socket (if enabled)
  if (params.showSocketHolder) {
    geometries.push(generateSocketHolder(params, socketTop - socket.depth));
  }
  
  // 3. Hub with leg attachment shoulders
  const hubGeometries = generateHub(
    params.hubStyle,
    params.hubScale,
    socket.outerRadius * 0.9,
    hubTopY,
    hubBottomY,
    params.legCount,
    params.legThickness
  );
  geometries.push(...hubGeometries);
  
  // 4. Legs with improved attachment
  const legAngleStep = (Math.PI * 2) / params.legCount;
  for (let i = 0; i < params.legCount; i++) {
    const angle = i * legAngleStep;
    const isCordLeg = params.showSocketHolder && i === params.cordExitLeg;
    
    // Start leg from hub's outer edge (not inside) for seamless attachment
    const hubAttachRadius = hubRadius * 0.7;
    const topX = Math.cos(angle) * hubAttachRadius;
    const topZ = Math.sin(angle) * hubAttachRadius;
    
    const bottomX = Math.cos(angle) * bottomSpreadRadius;
    const bottomZ = Math.sin(angle) * bottomSpreadRadius;
    
    // Leg starts slightly overlapping into hub for seamless connection
    const startPoint = new THREE.Vector3(topX, hubBottomY + hubHeight * 0.15, topZ);
    const endPoint = new THREE.Vector3(bottomX, footPadRadius * 0.4, bottomZ);
    
    geometries.push(generateParametricLeg(params, startPoint, endPoint));
    
    // 5. Feet (with cord exit hole on designated leg)
    const footGeom = generateFoot(
      params.footStyle,
      params.footScale,
      footPadRadius,
      new THREE.Vector3(bottomX, 0, bottomZ),
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
  const canopyDiameter = 70 + params.rimSize * 0.3;
  const canopyHeight = 20;
  const totalHeight = socketTop + params.cordLength + canopyHeight;
  
  // 1. Canopy (ceiling mount)
  const canopyGeom = new THREE.SphereGeometry(
    canopyDiameter / 2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2
  );
  canopyGeom.scale(1, canopyHeight / (canopyDiameter / 2), 1);
  canopyGeom.translate(0, totalHeight - canopyHeight, 0);
  geometries.push(canopyGeom);
  
  // 2. Cord (hollow tube for wiring)
  const cordThickness = params.legThickness * 0.4;
  const cordGeom = new THREE.CylinderGeometry(cordThickness, cordThickness, params.cordLength, 8);
  cordGeom.translate(0, totalHeight - canopyHeight - params.cordLength / 2, 0);
  geometries.push(cordGeom);
  
  // 3. Transition piece
  const transitionHeight = 25;
  const transitionGeom = new THREE.CylinderGeometry(
    socket.outerRadius * 0.9,
    cordThickness * 2.5,
    transitionHeight,
    24
  );
  transitionGeom.translate(0, socketTop + socket.depth + transitionHeight / 2, 0);
  geometries.push(transitionGeom);
  
  // 4. Socket holder (built into pendant - always shown)
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
  
  const backplateWidth = 90;
  const backplateHeight = 120;
  const wallThickness = 8;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight / 2 + params.armLength * Math.sin(armAngleRad);
  const socketTopY = armEndY + socket.depth + 20;
  
  // 1. Backplate with cord channel
  const backplateGeom = new THREE.BoxGeometry(backplateWidth, backplateHeight, wallThickness);
  backplateGeom.translate(0, backplateHeight / 2, 0);
  geometries.push(backplateGeom);
  
  // 2. Arm (using parametric leg system)
  const armStart = new THREE.Vector3(0, backplateHeight / 2, wallThickness / 2);
  const armEnd = new THREE.Vector3(0, armEndY, armEndZ);
  geometries.push(generateParametricLeg(params, armStart, armEnd));
  
  // 3. Transition to socket area
  const transitionHeight = 20;
  const transitionGeom = new THREE.CylinderGeometry(
    socket.outerRadius * 0.9,
    params.legThickness * 0.8,
    transitionHeight,
    24
  );
  transitionGeom.translate(0, armEndY + transitionHeight / 2, armEndZ);
  geometries.push(transitionGeom);
  
  // 4. Socket holder (if enabled)
  if (params.showSocketHolder) {
    const holderGeom = generateSocketHolder(params, socketTopY);
    holderGeom.translate(0, 0, armEndZ);
    geometries.push(holderGeom);
  }
  
  // 5. Cup socket at arm end
  const cupPoints: THREE.Vector2[] = [];
  cupPoints.push(new THREE.Vector2(0, -socket.depth));
  cupPoints.push(new THREE.Vector2(socket.innerRadius, -socket.depth));
  cupPoints.push(new THREE.Vector2(socket.innerRadius, -2));
  
  const lipSteps = 8;
  for (let i = 0; i <= lipSteps; i++) {
    const t = i / lipSteps;
    const angle = t * Math.PI / 2;
    const curveRadius = socket.outerRadius - socket.innerRadius;
    const x = socket.innerRadius + Math.sin(angle) * curveRadius;
    const y = -2 + Math.cos(angle) * 2;
    cupPoints.push(new THREE.Vector2(x, y));
  }
  
  cupPoints.push(new THREE.Vector2(socket.outerRadius, -socket.depth + 2));
  cupPoints.push(new THREE.Vector2(socket.outerRadius * 0.95, -socket.depth));
  cupPoints.push(new THREE.Vector2(0, -socket.depth));
  
  const cupGeom = new THREE.LatheGeometry(cupPoints, 48);
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
  if (geometries.length === 0) return new THREE.BufferGeometry();
  
  let totalVertices = 0;
  let totalIndices = 0;
  
  for (const geom of geometries) {
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
  
  for (const geom of geometries) {
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
