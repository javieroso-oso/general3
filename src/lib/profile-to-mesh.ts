import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { ProfilePoint, ProfileSettings } from '@/types/custom-profile';
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

// Generate lathe geometry from profile points
export function generateLatheMesh(
  profile: ProfilePoint[],
  settings: ProfileSettings
): THREE.BufferGeometry {
  const { wallThickness, segments, smoothing, baseThickness } = settings;
  
  // Smooth the profile
  const smoothedProfile = smoothing > 0 
    ? smoothProfile(profile, Math.floor(profile.length * (1 + smoothing * 10)))
    : profile;
  
  // Ensure profile starts from bottom
  const sortedProfile = [...smoothedProfile].sort((a, b) => a.y - b.y);
  
  // Generate outer and inner wall points
  const outerPoints: THREE.Vector2[] = [];
  const innerPoints: THREE.Vector2[] = [];
  
  sortedProfile.forEach(p => {
    outerPoints.push(new THREE.Vector2(p.x, p.y));
    innerPoints.push(new THREE.Vector2(Math.max(0.1, p.x - wallThickness), p.y));
  });
  
  // Create lathe geometry for outer wall
  const outerGeometry = new THREE.LatheGeometry(outerPoints, segments);
  
  // Create lathe geometry for inner wall (inverted normals)
  const innerGeometry = new THREE.LatheGeometry(innerPoints, segments);
  
  // Merge geometries
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  
  // Add outer wall
  const outerPos = outerGeometry.getAttribute('position');
  const outerNorm = outerGeometry.getAttribute('normal');
  const outerIdx = outerGeometry.getIndex();
  
  for (let i = 0; i < outerPos.count; i++) {
    positions.push(outerPos.getX(i), outerPos.getY(i), outerPos.getZ(i));
    normals.push(outerNorm.getX(i), outerNorm.getY(i), outerNorm.getZ(i));
  }
  
  if (outerIdx) {
    for (let i = 0; i < outerIdx.count; i++) {
      indices.push(outerIdx.getX(i));
    }
  }
  
  // Add inner wall (with inverted normals)
  const innerPos = innerGeometry.getAttribute('position');
  const innerNorm = innerGeometry.getAttribute('normal');
  const innerIdx = innerGeometry.getIndex();
  const offset = outerPos.count;
  
  for (let i = 0; i < innerPos.count; i++) {
    positions.push(innerPos.getX(i), innerPos.getY(i), innerPos.getZ(i));
    // Invert normals for inner wall
    normals.push(-innerNorm.getX(i), -innerNorm.getY(i), -innerNorm.getZ(i));
  }
  
  if (innerIdx) {
    // Reverse winding order for inner wall
    for (let i = 0; i < innerIdx.count; i += 3) {
      indices.push(
        innerIdx.getX(i) + offset,
        innerIdx.getX(i + 2) + offset,
        innerIdx.getX(i + 1) + offset
      );
    }
  }
  
  // Add bottom cap (solid base)
  const baseY = sortedProfile[0].y;
  const baseOuterRadius = sortedProfile[0].x;
  const baseInnerRadius = Math.max(0, baseOuterRadius - wallThickness);
  
  // Bottom ring vertices
  const bottomOffset = positions.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    
    // Outer ring
    positions.push(baseOuterRadius * cos, baseY, baseOuterRadius * sin);
    normals.push(0, -1, 0);
    
    // Inner ring (or center if solid)
    positions.push(baseInnerRadius * cos, baseY, baseInnerRadius * sin);
    normals.push(0, -1, 0);
  }
  
  // Bottom faces
  for (let i = 0; i < segments; i++) {
    const a = bottomOffset + i * 2;
    const b = bottomOffset + i * 2 + 1;
    const c = bottomOffset + (i + 1) * 2;
    const d = bottomOffset + (i + 1) * 2 + 1;
    
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  
  // Add top rim
  const topY = sortedProfile[sortedProfile.length - 1].y;
  const topOuterRadius = sortedProfile[sortedProfile.length - 1].x;
  const topInnerRadius = Math.max(0, topOuterRadius - wallThickness);
  
  const topOffset = positions.length / 3;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    
    // Outer ring
    positions.push(topOuterRadius * cos, topY, topOuterRadius * sin);
    normals.push(0, 1, 0);
    
    // Inner ring
    positions.push(topInnerRadius * cos, topY, topInnerRadius * sin);
    normals.push(0, 1, 0);
  }
  
  // Top faces
  for (let i = 0; i < segments; i++) {
    const a = topOffset + i * 2;
    const b = topOffset + i * 2 + 1;
    const c = topOffset + (i + 1) * 2;
    const d = topOffset + (i + 1) * 2 + 1;
    
    indices.push(a, b, c);
    indices.push(b, d, c);
  }
  
  // Create final geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  outerGeometry.dispose();
  innerGeometry.dispose();
  
  return geometry;
}

// Export profile mesh to STL
export function exportProfileToSTL(
  profile: ProfilePoint[],
  settings: ProfileSettings
): Blob {
  const geometry = generateLatheMesh(profile, settings);
  const mesh = new THREE.Mesh(geometry);
  
  const exporter = new STLExporter();
  const stlString = exporter.parse(mesh, { binary: false });
  
  geometry.dispose();
  
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
  
  const minY = sortedProfile[0].y;
  const maxY = sortedProfile[sortedProfile.length - 1].y;
  const layerCount = Math.ceil((maxY - minY) / printSettings.layerHeight);
  
  for (let layer = 0; layer <= layerCount; layer++) {
    const z = minY + layer * printSettings.layerHeight;
    
    // Find radius at this height by interpolating profile
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
    
    // Outer perimeter
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
    
    // Inner perimeter
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
  gcode += `; Material: ${printSettings.material}\n`;
  gcode += `; Layer Height: ${printSettings.layerHeight}mm\n`;
  gcode += '\n; Start G-code\n';
  gcode += `M104 S${temps.nozzle} ; Set nozzle temp\n`;
  gcode += `M140 S${temps.bed} ; Set bed temp\n`;
  gcode += 'G28 ; Home all axes\n';
  gcode += `M109 S${temps.nozzle} ; Wait for nozzle\n`;
  gcode += `M190 S${temps.bed} ; Wait for bed\n`;
  gcode += 'G92 E0 ; Reset extruder\n';
  gcode += 'G1 Z5 F3000 ; Lift nozzle\n\n';
  
  let e = 0;
  const extrusionMultiplier = 0.033;
  
  layers.forEach((layer, layerIndex) => {
    gcode += `; Layer ${layerIndex}\n`;
    gcode += `G1 Z${layer.z.toFixed(3)} F1000\n`;
    
    layer.paths.forEach(path => {
      if (path.length === 0) return;
      
      // Move to start
      gcode += `G0 X${path[0].x.toFixed(3)} Y${path[0].y.toFixed(3)} F${printSettings.printSpeed * 60}\n`;
      
      // Extrude along path
      for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x;
        const dy = path[i].y - path[i - 1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        e += dist * extrusionMultiplier;
        gcode += `G1 X${path[i].x.toFixed(3)} Y${path[i].y.toFixed(3)} E${e.toFixed(4)} F${printSettings.printSpeed * 60}\n`;
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
