import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { ProfilePoint, ProfileSettings, GenerationMode } from '@/types/custom-profile';
import { PrintSettings } from '@/types/parametric';

// Smooth profile points using Catmull-Rom spline interpolation
export function smoothProfile(
  points: ProfilePoint[],
  segments: number = 50
): ProfilePoint[] {
  if (points.length < 2) return points;
  
  const smoothed: ProfilePoint[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    
    const segmentsPerSection = Math.ceil(segments / (points.length - 1));
    
    for (let j = 0; j < segmentsPerSection; j++) {
      const t = j / segmentsPerSection;
      const t2 = t * t;
      const t3 = t2 * t;
      
      // Catmull-Rom spline
      const x = 0.5 * (
        2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      
      const y = 0.5 * (
        2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );
      
      smoothed.push({ x: Math.max(0, x), y });
    }
  }
  
  // Add last point
  smoothed.push(points[points.length - 1]);
  
  return smoothed;
}

// Generate smooth watertight lathe geometry from profile points
export function generateLatheMesh(
  profile: ProfilePoint[],
  settings: ProfileSettings
): THREE.BufferGeometry {
  const { wallThickness, segments, smoothing } = settings;
  
  // Smooth the profile first
  const smoothedProfile = smoothing > 0 
    ? smoothProfile(profile, Math.floor(profile.length * (1 + smoothing * 10)))
    : profile;
  
  // Ensure profile starts from bottom and has enough points
  const sortedProfile = [...smoothedProfile].sort((a, b) => a.y - b.y);
  
  if (sortedProfile.length < 2) {
    return new THREE.BufferGeometry();
  }
  
  // Create smooth outer profile points for LatheGeometry
  const outerPoints: THREE.Vector2[] = sortedProfile.map(p => 
    new THREE.Vector2(Math.max(0.1, p.x), p.y)
  );
  
  // Create smooth inner profile points (offset by wall thickness)
  const innerPoints: THREE.Vector2[] = sortedProfile.map(p => 
    new THREE.Vector2(Math.max(0.1, p.x - wallThickness), p.y)
  );
  
  // Use Three.js LatheGeometry for smooth curved surfaces
  const outerGeometry = new THREE.LatheGeometry(outerPoints, segments);
  const innerGeometry = new THREE.LatheGeometry(innerPoints, segments);
  
  // Get geometry data
  const outerPos = outerGeometry.getAttribute('position');
  const outerNorm = outerGeometry.getAttribute('normal');
  const outerIdx = outerGeometry.getIndex();
  
  const innerPos = innerGeometry.getAttribute('position');
  const innerNorm = innerGeometry.getAttribute('normal');
  const innerIdx = innerGeometry.getIndex();
  
  // Build merged geometry
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  
  // Add outer wall vertices
  for (let i = 0; i < outerPos.count; i++) {
    positions.push(outerPos.getX(i), outerPos.getY(i), outerPos.getZ(i));
    normals.push(outerNorm.getX(i), outerNorm.getY(i), outerNorm.getZ(i));
  }
  
  // Add outer wall faces
  if (outerIdx) {
    for (let i = 0; i < outerIdx.count; i++) {
      indices.push(outerIdx.getX(i));
    }
  }
  
  // Add inner wall vertices (with inverted normals)
  const innerOffset = outerPos.count;
  for (let i = 0; i < innerPos.count; i++) {
    positions.push(innerPos.getX(i), innerPos.getY(i), innerPos.getZ(i));
    normals.push(-innerNorm.getX(i), -innerNorm.getY(i), -innerNorm.getZ(i));
  }
  
  // Add inner wall faces (reversed winding for inside-facing)
  if (innerIdx) {
    for (let i = 0; i < innerIdx.count; i += 3) {
      indices.push(
        innerIdx.getX(i) + innerOffset,
        innerIdx.getX(i + 2) + innerOffset,
        innerIdx.getX(i + 1) + innerOffset
      );
    }
  }
  
  // Add bottom cap ring (connects outer to inner at bottom)
  const bottomY = sortedProfile[0].y;
  const bottomOuterR = Math.max(0.1, sortedProfile[0].x);
  const bottomInnerR = Math.max(0.1, sortedProfile[0].x - wallThickness);
  
  const bottomCapStart = positions.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // Outer edge
    positions.push(bottomOuterR * cos, bottomY, bottomOuterR * sin);
    normals.push(0, -1, 0);
    
    // Inner edge
    positions.push(bottomInnerR * cos, bottomY, bottomInnerR * sin);
    normals.push(0, -1, 0);
  }
  
  // Bottom cap faces
  for (let i = 0; i < segments; i++) {
    const a = bottomCapStart + i * 2;
    const b = bottomCapStart + i * 2 + 1;
    const c = bottomCapStart + (i + 1) * 2;
    const d = bottomCapStart + (i + 1) * 2 + 1;
    
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  
  // Add top rim ring (connects outer to inner at top)
  const topY = sortedProfile[sortedProfile.length - 1].y;
  const topOuterR = Math.max(0.1, sortedProfile[sortedProfile.length - 1].x);
  const topInnerR = Math.max(0.1, sortedProfile[sortedProfile.length - 1].x - wallThickness);
  
  const topCapStart = positions.length / 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // Outer edge
    positions.push(topOuterR * cos, topY, topOuterR * sin);
    normals.push(0, 1, 0);
    
    // Inner edge
    positions.push(topInnerR * cos, topY, topInnerR * sin);
    normals.push(0, 1, 0);
  }
  
  // Top rim faces
  for (let i = 0; i < segments; i++) {
    const a = topCapStart + i * 2;
    const b = topCapStart + i * 2 + 1;
    const c = topCapStart + (i + 1) * 2;
    const d = topCapStart + (i + 1) * 2 + 1;
    
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  // Create final geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  
  // Clean up
  outerGeometry.dispose();
  innerGeometry.dispose();
  
  return geometry;
}

// Generate extrusion geometry with hollow walls
// Vertical: profile defines X-Z silhouette (stands up from floor), extruded along Y
// Horizontal: profile defines X-Y silhouette, extruded along Z
export function generateExtrudeMesh(
  profile: ProfilePoint[],
  settings: ProfileSettings
): THREE.BufferGeometry {
  const { extrusionDepth, smoothing, wallThickness, extrusionDirection, extrusionShapeMode } = settings;
  
  // Smooth the profile
  const smoothedProfile = smoothing > 0 
    ? smoothProfile(profile, Math.floor(profile.length * (1 + smoothing * 10)))
    : profile;
  
  if (smoothedProfile.length < 2) {
    return new THREE.BufferGeometry();
  }
  
  // Create outer shape based on shape mode
  const outerShape = new THREE.Shape();
  
  if (extrusionShapeMode === 'direct') {
    // Direct mode: use the profile as-is as a closed shape
    outerShape.moveTo(smoothedProfile[0].x, smoothedProfile[0].y);
    
    for (let i = 1; i < smoothedProfile.length; i++) {
      outerShape.lineTo(smoothedProfile[i].x, smoothedProfile[i].y);
    }
    
    outerShape.closePath();
    
    // Create inner hole for hollow shape (offset inward by wall thickness)
    if (wallThickness > 0 && smoothedProfile.length >= 3) {
      // Use a simple offset approach - shrink toward centroid
      const centroidX = smoothedProfile.reduce((sum, p) => sum + p.x, 0) / smoothedProfile.length;
      const centroidY = smoothedProfile.reduce((sum, p) => sum + p.y, 0) / smoothedProfile.length;
      
      const hole = new THREE.Path();
      const innerPoints = smoothedProfile.map(p => {
        const dx = p.x - centroidX;
        const dy = p.y - centroidY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < wallThickness * 2) return null; // Too small for hollow
        const scale = (dist - wallThickness) / dist;
        return {
          x: centroidX + dx * scale,
          y: centroidY + dy * scale,
        };
      }).filter((p): p is { x: number; y: number } => p !== null);
      
      if (innerPoints.length >= 3) {
        hole.moveTo(innerPoints[0].x, innerPoints[0].y);
        for (let i = 1; i < innerPoints.length; i++) {
          hole.lineTo(innerPoints[i].x, innerPoints[i].y);
        }
        hole.closePath();
        outerShape.holes.push(hole);
      }
    }
  } else {
    // Mirrored mode: sort by Y and mirror for symmetry
    const sortedProfile = [...smoothedProfile].sort((a, b) => a.y - b.y);
    
    // Start at first point
    outerShape.moveTo(sortedProfile[0].x, sortedProfile[0].y);
    
    // Draw the right side (positive X)
    for (let i = 1; i < sortedProfile.length; i++) {
      outerShape.lineTo(sortedProfile[i].x, sortedProfile[i].y);
    }
    
    // Mirror back on the left side (negative X)
    for (let i = sortedProfile.length - 1; i >= 0; i--) {
      outerShape.lineTo(-sortedProfile[i].x, sortedProfile[i].y);
    }
    
    outerShape.closePath();
    
    // Create inner hole (offset by wall thickness)
    const hole = new THREE.Path();
    const innerProfile = sortedProfile.map(p => ({
      x: Math.max(0.5, p.x - wallThickness),
      y: p.y
    }));
    
    // Only create hole if there's room for walls
    const hasRoom = innerProfile.some(p => p.x > 0.5);
    
    if (hasRoom && wallThickness > 0) {
      // Inset from top/bottom by wall thickness too
      const minY = Math.min(...innerProfile.map(p => p.y)) + wallThickness;
      const maxY = Math.max(...innerProfile.map(p => p.y)) - wallThickness;
      
      const filteredInner = innerProfile.filter(p => p.y >= minY && p.y <= maxY);
      
      if (filteredInner.length >= 2) {
        hole.moveTo(filteredInner[0].x, filteredInner[0].y);
        
        for (let i = 1; i < filteredInner.length; i++) {
          hole.lineTo(filteredInner[i].x, filteredInner[i].y);
        }
        
        for (let i = filteredInner.length - 1; i >= 0; i--) {
          hole.lineTo(-filteredInner[i].x, filteredInner[i].y);
        }
        
        hole.closePath();
        outerShape.holes.push(hole);
      }
    }
  }
  
  // Extrude settings
  const extrudeSettings = {
    steps: Math.max(2, Math.floor(extrusionDepth / 5)),
    depth: extrusionDepth,
    bevelEnabled: false,
  };
  
  const geometry = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
  
  // Transform based on direction
  if (extrusionDirection === 'vertical') {
    // Rotate so shape stands up from floor (Y becomes Z, Z becomes Y)
    // Original: Shape in XY plane, extruded along Z
    // Target: Shape in XZ plane (standing up), extruded along Y (giving depth)
    geometry.rotateX(-Math.PI / 2);
  }
  
  // Center the geometry
  geometry.center();

  return geometry;
}

// Generate path mesh with capped ends - profile as spine with cross-section
export function generatePathMesh(
  profile: ProfilePoint[],
  settings: ProfileSettings
): THREE.BufferGeometry {
  const { crossSectionSize, pathCrossSection, smoothing } = settings;
  
  // Smooth the profile path
  const smoothedProfile = smoothing > 0 
    ? smoothProfile(profile, Math.floor(profile.length * (1 + smoothing * 10)))
    : profile;
  
  if (smoothedProfile.length < 2) {
    return new THREE.BufferGeometry();
  }
  
  // Create the path curve from profile points (use X,Y as path in XY plane)
  const pathPoints: THREE.Vector3[] = smoothedProfile.map(
    p => new THREE.Vector3(p.x, p.y, 0)
  );
  
  const curve = new THREE.CatmullRomCurve3(pathPoints);
  
  // Use TubeGeometry for circular cross-section (automatically capped)
  // Or ExtrudeGeometry for square
  const radius = crossSectionSize / 2;
  const tubularSegments = Math.max(smoothedProfile.length * 4, 50);
  const radialSegments = pathCrossSection === 'circle' ? 16 : 4;
  
  let geometry: THREE.BufferGeometry;
  
  if (pathCrossSection === 'circle') {
    // Use TubeGeometry for round tubes
    geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    
    // Add end caps manually for TubeGeometry
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const existingPositions = Array.from(positions.array);
    const existingNormals = Array.from(normals.array);
    const existingIndices = geometry.index ? Array.from(geometry.index.array) : [];
    
    // Get start and end tangent directions
    const startTangent = curve.getTangentAt(0);
    const endTangent = curve.getTangentAt(1);
    const startPoint = curve.getPointAt(0);
    const endPoint = curve.getPointAt(1);
    
    // Create start cap
    const startCapOffset = existingPositions.length / 3;
    const startCapCenter = existingPositions.length / 3;
    existingPositions.push(startPoint.x, startPoint.y, startPoint.z);
    existingNormals.push(-startTangent.x, -startTangent.y, -startTangent.z);
    
    // Add start cap ring vertices
    for (let i = 0; i <= radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(up, startTangent).normalize();
      const realUp = new THREE.Vector3().crossVectors(startTangent, right).normalize();
      
      const x = startPoint.x + radius * (Math.cos(theta) * right.x + Math.sin(theta) * realUp.x);
      const y = startPoint.y + radius * (Math.cos(theta) * right.y + Math.sin(theta) * realUp.y);
      const z = startPoint.z + radius * (Math.cos(theta) * right.z + Math.sin(theta) * realUp.z);
      
      existingPositions.push(x, y, z);
      existingNormals.push(-startTangent.x, -startTangent.y, -startTangent.z);
    }
    
    // Start cap faces
    for (let i = 0; i < radialSegments; i++) {
      existingIndices.push(
        startCapCenter,
        startCapCenter + 1 + i,
        startCapCenter + 2 + i
      );
    }
    
    // Create end cap
    const endCapCenter = existingPositions.length / 3;
    existingPositions.push(endPoint.x, endPoint.y, endPoint.z);
    existingNormals.push(endTangent.x, endTangent.y, endTangent.z);
    
    // Add end cap ring vertices
    for (let i = 0; i <= radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2;
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(up, endTangent).normalize();
      const realUp = new THREE.Vector3().crossVectors(endTangent, right).normalize();
      
      const x = endPoint.x + radius * (Math.cos(theta) * right.x + Math.sin(theta) * realUp.x);
      const y = endPoint.y + radius * (Math.cos(theta) * right.y + Math.sin(theta) * realUp.y);
      const z = endPoint.z + radius * (Math.cos(theta) * right.z + Math.sin(theta) * realUp.z);
      
      existingPositions.push(x, y, z);
      existingNormals.push(endTangent.x, endTangent.y, endTangent.z);
    }
    
    // End cap faces (reverse winding)
    for (let i = 0; i < radialSegments; i++) {
      existingIndices.push(
        endCapCenter,
        endCapCenter + 2 + i,
        endCapCenter + 1 + i
      );
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(existingPositions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(existingNormals, 3));
    geometry.setIndex(existingIndices);
    
  } else {
    // Square cross-section using ExtrudeGeometry
    const crossSection = new THREE.Shape();
    crossSection.moveTo(-radius, -radius);
    crossSection.lineTo(radius, -radius);
    crossSection.lineTo(radius, radius);
    crossSection.lineTo(-radius, radius);
    crossSection.closePath();
    
    const extrudeSettings = {
      steps: tubularSegments,
      bevelEnabled: false,
      extrudePath: curve,
    };
    
    geometry = new THREE.ExtrudeGeometry(crossSection, extrudeSettings);
  }
  
  geometry.center();
  geometry.computeVertexNormals();
  
  return geometry;
}

// Main mesh generation function based on mode
export function generateMesh(
  profile: ProfilePoint[],
  settings: ProfileSettings
): THREE.BufferGeometry {
  switch (settings.generationMode) {
    case 'lathe':
      return generateLatheMesh(profile, settings);
    case 'extrude':
      return generateExtrudeMesh(profile, settings);
    case 'path':
      return generatePathMesh(profile, settings);
    default:
      return generateLatheMesh(profile, settings);
  }
}

// Export profile mesh to STL with proper scaling
export function exportProfileToSTL(
  profile: ProfilePoint[],
  settings: ProfileSettings
): Blob {
  const geometry = generateMesh(profile, settings);
  
  // Apply scale for export (1 unit = 1mm)
  const scaledGeometry = geometry.clone();
  scaledGeometry.scale(settings.scale, settings.scale, settings.scale);
  
  const mesh = new THREE.Mesh(scaledGeometry);
  
  const exporter = new STLExporter();
  const stlString = exporter.parse(mesh, { binary: false });
  
  geometry.dispose();
  scaledGeometry.dispose();
  
  return new Blob([stlString], { type: 'application/octet-stream' });
}

// Download STL file
export function downloadProfileSTL(
  profile: ProfilePoint[],
  settings: ProfileSettings,
  filename: string = 'custom-profile.stl'
): void {
  const blob = exportProfileToSTL(profile, settings);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Generate G-code layers for profile
export interface ProfileGCodeLayer {
  z: number;
  paths: { x: number; y: number }[][];
}

export function generateProfileGCodeLayers(
  profile: ProfilePoint[],
  settings: ProfileSettings,
  printSettings: PrintSettings
): ProfileGCodeLayer[] {
  const sortedProfile = [...profile].sort((a, b) => a.y - b.y);
  const layers: ProfileGCodeLayer[] = [];
  
  // For lathe mode, generate circular layers
  if (settings.generationMode === 'lathe') {
    const minY = sortedProfile[0].y;
    const maxY = sortedProfile[sortedProfile.length - 1].y;
    const layerCount = Math.ceil((maxY - minY) / printSettings.layerHeight);
    
    for (let layer = 0; layer <= layerCount; layer++) {
      const z = minY + layer * printSettings.layerHeight;
      
      let radius = 0;
      for (let i = 1; i < sortedProfile.length; i++) {
        if (sortedProfile[i].y >= z && sortedProfile[i - 1].y <= z) {
          const t = (z - sortedProfile[i - 1].y) / (sortedProfile[i].y - sortedProfile[i - 1].y);
          radius = sortedProfile[i - 1].x + t * (sortedProfile[i].x - sortedProfile[i - 1].x);
          break;
        }
      }
      
      if (radius <= 0) continue;
      
      const innerRadius = Math.max(0, radius - settings.wallThickness);
      const paths: { x: number; y: number }[][] = [];
      
      const outerPath: { x: number; y: number }[] = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        outerPath.push({
          x: radius * Math.cos(theta),
          y: radius * Math.sin(theta),
        });
      }
      paths.push(outerPath);
      
      if (innerRadius > 0) {
        const innerPath: { x: number; y: number }[] = [];
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          innerPath.push({
            x: innerRadius * Math.cos(theta),
            y: innerRadius * Math.sin(theta),
          });
        }
        paths.push(innerPath);
      }
      
      layers.push({ z, paths });
    }
  } else if (settings.generationMode === 'extrude') {
    // For extrude mode, generate layers along Z (extrusion direction)
    const layerCount = Math.ceil(settings.extrusionDepth / printSettings.layerHeight);
    
    for (let layer = 0; layer <= layerCount; layer++) {
      const z = layer * printSettings.layerHeight;
      const paths: { x: number; y: number }[][] = [];
      
      // Create outer perimeter path (mirrored profile shape)
      const outerPath: { x: number; y: number }[] = [];
      
      // Right side
      for (const p of sortedProfile) {
        outerPath.push({ x: p.x, y: p.y });
      }
      
      // Left side (mirrored) - use slice to avoid mutating original
      const reversedProfile = [...sortedProfile].reverse();
      for (const p of reversedProfile) {
        outerPath.push({ x: -p.x, y: p.y });
      }
      
      // Close the path
      outerPath.push({ ...outerPath[0] });
      paths.push(outerPath);
      
      // Create inner perimeter (offset by wall thickness)
      const innerPath: { x: number; y: number }[] = [];
      const minY = Math.min(...sortedProfile.map(p => p.y)) + settings.wallThickness;
      const maxY = Math.max(...sortedProfile.map(p => p.y)) - settings.wallThickness;
      
      const innerProfile = sortedProfile
        .filter(p => p.y >= minY && p.y <= maxY)
        .map(p => ({ x: Math.max(0.5, p.x - settings.wallThickness), y: p.y }));
      
      if (innerProfile.length >= 2) {
        for (const p of innerProfile) {
          innerPath.push({ x: p.x, y: p.y });
        }
        
        const reversedInner = [...innerProfile].reverse();
        for (const p of reversedInner) {
          innerPath.push({ x: -p.x, y: p.y });
        }
        
        innerPath.push({ ...innerPath[0] });
        paths.push(innerPath);
      }
      
      layers.push({ z, paths });
    }
  } else if (settings.generationMode === 'path') {
    // For path mode, the Z layers cut through the cross-section
    const radius = settings.crossSectionSize / 2;
    const layerCount = Math.ceil(settings.crossSectionSize / printSettings.layerHeight);
    
    for (let layer = 0; layer <= layerCount; layer++) {
      const z = layer * printSettings.layerHeight;
      const paths: { x: number; y: number }[][] = [];
      
      // Calculate cross-section radius at this Z height
      const zOffset = z - radius; // Center the cross-section
      let crossRadius = 0;
      
      if (settings.pathCrossSection === 'circle') {
        // Circle: radius varies with z
        if (Math.abs(zOffset) <= radius) {
          crossRadius = Math.sqrt(radius * radius - zOffset * zOffset);
        }
      } else {
        // Square: constant width within bounds
        if (Math.abs(zOffset) <= radius) {
          crossRadius = radius;
        }
      }
      
      if (crossRadius > 0) {
        // Path follows the profile points with offset for cross-section
        const path: { x: number; y: number }[] = sortedProfile.map(p => ({
          x: p.x,
          y: p.y
        }));
        paths.push(path);
      }
      
      layers.push({ z, paths });
    }
  }
  
  return layers;
}

// Generate full G-code
export function generateProfileGCode(
  profile: ProfilePoint[],
  settings: ProfileSettings,
  printSettings: PrintSettings
): string {
  const layers = generateProfileGCodeLayers(profile, settings, printSettings);
  
  const materialTemps: Record<string, { nozzle: number; bed: number }> = {
    PLA: { nozzle: 200, bed: 60 },
    PETG: { nozzle: 230, bed: 80 },
    ABS: { nozzle: 240, bed: 100 },
    TPU: { nozzle: 220, bed: 50 },
  };
  
  const temps = materialTemps[printSettings.material] || materialTemps.PLA;
  
  let gcode = '';
  gcode += '; Custom Profile G-code\n';
  gcode += `; Generation Mode: ${settings.generationMode}\n`;
  gcode += `; Material: ${printSettings.material}\n`;
  gcode += `; Layer Height: ${printSettings.layerHeight}mm\n`;
  gcode += `; Scale: ${settings.scale}\n`;
  gcode += '\n; Start G-code\n';
  gcode += `M104 S${temps.nozzle} ; Set nozzle temp\n`;
  gcode += `M140 S${temps.bed} ; Set bed temp\n`;
  gcode += 'G28 ; Home all axes\n';
  gcode += `M109 S${temps.nozzle} ; Wait for nozzle\n`;
  gcode += `M190 S${temps.bed} ; Wait for bed\n`;
  gcode += 'G92 E0 ; Reset extruder\n';
  gcode += 'G1 Z5 F3000 ; Lift nozzle\n\n';
  
  let e = 0;
  const extrusionMultiplier = 0.033 * settings.scale;
  
  layers.forEach((layer, layerIndex) => {
    gcode += `; Layer ${layerIndex}\n`;
    gcode += `G1 Z${(layer.z * settings.scale).toFixed(3)} F1000\n`;
    
    layer.paths.forEach(path => {
      if (path.length === 0) return;
      
      // Scale coordinates
      const scaledX = path[0].x * settings.scale;
      const scaledY = path[0].y * settings.scale;
      
      gcode += `G0 X${scaledX.toFixed(3)} Y${scaledY.toFixed(3)} F${printSettings.printSpeed * 60}\n`;
      
      for (let i = 1; i < path.length; i++) {
        const prevX = path[i - 1].x * settings.scale;
        const prevY = path[i - 1].y * settings.scale;
        const currX = path[i].x * settings.scale;
        const currY = path[i].y * settings.scale;
        
        const dx = currX - prevX;
        const dy = currY - prevY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        e += dist * extrusionMultiplier;
        gcode += `G1 X${currX.toFixed(3)} Y${currY.toFixed(3)} E${e.toFixed(4)} F${printSettings.printSpeed * 60}\n`;
      }
    });
  });
  
  gcode += '\n; End G-code\n';
  gcode += 'G1 E-2 F2400 ; Retract\n';
  gcode += 'G1 Z10 F3000 ; Lift\n';
  gcode += 'G28 X Y ; Home X/Y\n';
  gcode += 'M104 S0 ; Turn off nozzle\n';
  gcode += 'M140 S0 ; Turn off bed\n';
  gcode += 'M84 ; Disable motors\n';
  
  return gcode;
}

// Download G-code file
export function downloadProfileGCode(
  profile: ProfilePoint[],
  settings: ProfileSettings,
  printSettings: PrintSettings,
  filename: string = 'custom-profile.gcode'
): void {
  const gcode = generateProfileGCode(profile, settings, printSettings);
  const blob = new Blob([gcode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
