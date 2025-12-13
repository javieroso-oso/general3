import * as THREE from 'three';
import { 
  ParametricStandParams, 
  LegProfile, 
  HubStyle, 
  FootStyle 
} from '@/types/stand';

// ============================================
// PARAMETRIC STAND GENERATORS
// Generates stands with customizable leg shapes and styles
// ============================================

// Socket dimensions for object connection
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

// Generate smooth cup socket
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

// Generate hub based on style
function generateHub(
  hubStyle: HubStyle,
  hubScale: number,
  baseRadius: number,
  topY: number,
  bottomY: number
): THREE.BufferGeometry {
  const scaledRadius = baseRadius * hubScale;
  const height = topY - bottomY;
  
  switch (hubStyle) {
    case 'sphere':
      const sphereGeom = new THREE.SphereGeometry(scaledRadius, 24, 16);
      sphereGeom.translate(0, bottomY + height / 2, 0);
      return sphereGeom;
      
    case 'disc':
      const discGeom = new THREE.CylinderGeometry(scaledRadius, scaledRadius, height * 0.3, 24);
      discGeom.translate(0, bottomY + height * 0.5, 0);
      return discGeom;
      
    case 'cone':
      const coneGeom = new THREE.ConeGeometry(scaledRadius, height, 24);
      coneGeom.rotateX(Math.PI);
      coneGeom.translate(0, bottomY + height / 2, 0);
      return coneGeom;
      
    case 'minimal':
      // Very small transition piece
      const minimalGeom = new THREE.CylinderGeometry(
        scaledRadius * 0.8,
        scaledRadius * 0.5,
        height * 0.5,
        24
      );
      minimalGeom.translate(0, topY - height * 0.25, 0);
      return minimalGeom;
      
    case 'smooth':
    default:
      // Smooth tapered cylinder
      const smoothGeom = new THREE.CylinderGeometry(
        scaledRadius,
        scaledRadius * 0.6,
        height,
        24
      );
      smoothGeom.translate(0, bottomY + height / 2, 0);
      return smoothGeom;
  }
}

// Generate foot based on style
function generateFoot(
  footStyle: FootStyle,
  footScale: number,
  baseRadius: number,
  position: THREE.Vector3
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
      geom = new THREE.CylinderGeometry(scaledRadius * 0.6, scaledRadius * 1.2, scaledRadius * 0.8, 16);
      geom.translate(position.x, position.y + scaledRadius * 0.4, position.z);
      break;
      
    case 'pad':
    default:
      geom = new THREE.CylinderGeometry(scaledRadius, scaledRadius * 1.1, scaledRadius * 0.4, 16);
      geom.translate(position.x, position.y + scaledRadius * 0.2, position.z);
      break;
  }
  
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
  const hubRadius = socket.outerRadius * 0.8 * params.hubScale;
  
  const legSpreadRad = (params.legSpread * Math.PI) / 180;
  const bottomSpreadRadius = hubRadius + hubBottomY * Math.tan(legSpreadRad);
  const footPadRadius = 10 * params.footScale;
  
  // 1. Cup socket
  geometries.push(generateCupSocket(params.rimSize, socketTop));
  
  // 2. Hub
  geometries.push(generateHub(
    params.hubStyle,
    params.hubScale,
    socket.outerRadius * 0.8,
    hubTopY,
    hubBottomY
  ));
  
  // 3. Legs
  const legAngleStep = (Math.PI * 2) / params.legCount;
  for (let i = 0; i < params.legCount; i++) {
    const angle = i * legAngleStep;
    
    const topX = Math.cos(angle) * hubRadius * 0.6;
    const topZ = Math.sin(angle) * hubRadius * 0.6;
    
    const bottomX = Math.cos(angle) * bottomSpreadRadius;
    const bottomZ = Math.sin(angle) * bottomSpreadRadius;
    
    const startPoint = new THREE.Vector3(topX, hubBottomY, topZ);
    const endPoint = new THREE.Vector3(bottomX, footPadRadius * 0.4, bottomZ);
    
    geometries.push(generateParametricLeg(params, startPoint, endPoint));
    
    // 4. Feet
    const footGeom = generateFoot(
      params.footStyle,
      params.footScale,
      footPadRadius,
      new THREE.Vector3(bottomX, 0, bottomZ)
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
  
  // 1. Canopy
  const canopyGeom = new THREE.SphereGeometry(
    canopyDiameter / 2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2
  );
  canopyGeom.scale(1, canopyHeight / (canopyDiameter / 2), 1);
  canopyGeom.translate(0, totalHeight - canopyHeight, 0);
  geometries.push(canopyGeom);
  
  // 2. Cord (can be styled based on leg profile)
  const cordThickness = params.legThickness * 0.4;
  const cordStart = new THREE.Vector3(0, totalHeight - canopyHeight, 0);
  const cordEnd = new THREE.Vector3(0, socketTop + socket.depth + 20, 0);
  
  const cordGeom = new THREE.CylinderGeometry(cordThickness, cordThickness, params.cordLength, 8);
  cordGeom.translate(0, totalHeight - canopyHeight - params.cordLength / 2, 0);
  geometries.push(cordGeom);
  
  // 3. Transition
  const transitionHeight = 20;
  const transitionGeom = new THREE.CylinderGeometry(
    socket.outerRadius * 0.9,
    cordThickness * 2,
    transitionHeight,
    24
  );
  transitionGeom.translate(0, socketTop + socket.depth + transitionHeight / 2, 0);
  geometries.push(transitionGeom);
  
  // 4. Cup socket
  geometries.push(generateCupSocket(params.rimSize, socketTop));
  
  return mergeGeometries(geometries);
}

// Generate parametric wall arm
export function generateParametricWallArm(params: ParametricStandParams): THREE.BufferGeometry {
  const socket = getSocketDimensions(params.rimSize);
  const geometries: THREE.BufferGeometry[] = [];
  
  const backplateWidth = 90;
  const backplateHeight = 120;
  const wallThickness = 6;
  const armAngleRad = (params.armAngle * Math.PI) / 180;
  
  const armEndZ = params.armLength * Math.cos(armAngleRad);
  const armEndY = backplateHeight / 2 + params.armLength * Math.sin(armAngleRad);
  
  // 1. Backplate
  const backplateGeom = new THREE.BoxGeometry(backplateWidth, backplateHeight, wallThickness);
  backplateGeom.translate(0, backplateHeight / 2, 0);
  geometries.push(backplateGeom);
  
  // 2. Arm (using parametric leg system)
  const armStart = new THREE.Vector3(0, backplateHeight / 2, wallThickness / 2);
  const armEnd = new THREE.Vector3(0, armEndY, armEndZ);
  geometries.push(generateParametricLeg(params, armStart, armEnd));
  
  // 3. Transition
  const transitionHeight = socket.depth + 8;
  const transitionGeom = new THREE.CylinderGeometry(
    socket.outerRadius * 0.9,
    params.legThickness / 2,
    transitionHeight,
    24
  );
  transitionGeom.translate(0, armEndY + transitionHeight / 2, armEndZ);
  geometries.push(transitionGeom);
  
  // 4. Cup socket at arm end
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
  cupGeom.translate(0, armEndY + transitionHeight + socket.depth, armEndZ);
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
