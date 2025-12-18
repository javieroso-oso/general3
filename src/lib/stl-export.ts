import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { ParametricParams, ObjectType, PrintSettings, printConstraints } from '@/types/parametric';
import { generateLegsWithBase } from '@/lib/leg-generator';

// Scale factor: mm to scene units
const SCALE = 0.01;

// Deterministic noise
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

// Calculate radius at a given height t (0-1)
function getRadiusAtHeight(
  t: number,
  params: ParametricParams,
  type: ObjectType,
  theta: number = 0
): number {
  const {
    baseRadius,
    topRadius,
    wobbleFrequency,
    wobbleAmplitude,
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
    height,
  } = params;

  // Base profile
  let radius: number;
  if (type === 'lamp') {
    radius = baseRadius + (topRadius - baseRadius) * Math.pow(t, 0.6);
  } else if (type === 'sculpture') {
    const curve = Math.sin(t * Math.PI);
    radius = baseRadius * (1 - t * 0.3) + topRadius * t * 0.7 + curve * baseRadius * 0.2;
  } else {
    const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
    radius = baseRadius * (1 - t * 0.4) + topRadius * t * 0.6 + curve * baseRadius * 0.12;
  }

  // Organic bulge
  const bulgeDist = Math.abs(t - bulgePosition);
  radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * baseRadius;

  // Pinch
  const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
  const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
  radius *= (1 - pinchTop - pinchBottom);

  // Lip flare
  const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
  radius += lipT * lipT * lipFlare * baseRadius;

  // Min radius
  radius = Math.max(radius, printConstraints.minBaseRadius * 0.5);

  // Angular deformations
  if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
    const maxWobble = Math.min(wobbleAmplitude, 0.15);
    radius += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * baseRadius;
  }

  if (rippleCount > 0 && rippleDepth > 0) {
    const maxRipple = Math.min(rippleDepth, 0.1);
    radius += Math.sin(theta * rippleCount) * maxRipple * baseRadius;
  }

  if (asymmetry > 0) {
    const maxAsym = Math.min(asymmetry, 0.1);
    radius += Math.sin(theta) * Math.cos(t * Math.PI * 2) * maxAsym * baseRadius;
  }

  if (organicNoise > 0) {
    const maxNoise = Math.min(organicNoise, 0.1);
    const y = t * height;
    const nx = Math.cos(theta) * radius;
    const nz = Math.sin(theta) * radius;
    radius += noise3D(nx * 0.1, y * 0.1, nz * 0.1, noiseScale) * maxNoise * baseRadius;
  }

  return Math.max(radius, params.wallThickness * 2);
}

// Generate body mesh (open bottom, no base cap) for STL export
export function generateBodyMesh(
  params: ParametricParams,
  type: ObjectType
): THREE.BufferGeometry {
  const {
    height,
    wallThickness,
    twistAngle,
  } = params;

  const segments = 64;
  const heightSegments = Math.ceil(height / 2);

  const vertices: number[] = [];
  const indices: number[] = [];

  // Generate outer wall vertices
  const outerStart = 0;
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    const twistRad = (twistAngle * Math.PI / 180) * t;

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      const r = getRadiusAtHeight(t, params, type, theta);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      vertices.push(x, y, z);
    }
  }

  // Generate inner wall vertices
  const innerStart = vertices.length / 3;
  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const y = t * height;
    const twistRad = (twistAngle * Math.PI / 180) * t;

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      const outerR = getRadiusAtHeight(t, params, type, theta);
      const r = Math.max(outerR - wallThickness, wallThickness);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      vertices.push(x, y, z);
    }
  }

  // Outer wall faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = outerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Inner wall faces
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = innerStart + i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Bottom rim - connect outer to inner wall at base (no solid cap)
  for (let j = 0; j < segments; j++) {
    const outer1 = outerStart + j;
    const outer2 = outerStart + j + 1;
    const inner1 = innerStart + j;
    const inner2 = innerStart + j + 1;
    
    indices.push(outer1, inner1, outer2);
    indices.push(outer2, inner1, inner2);
  }

  // Top rim - connect outer to inner wall
  const topOuterStart = outerStart + heightSegments * (segments + 1);
  const topInnerStart = innerStart + heightSegments * (segments + 1);
  
  for (let j = 0; j < segments; j++) {
    const outer1 = topOuterStart + j;
    const outer2 = topOuterStart + j + 1;
    const inner1 = topInnerStart + j;
    const inner2 = topInnerStart + j + 1;
    
    indices.push(outer1, outer2, inner1);
    indices.push(inner1, outer2, inner2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

// Generate legs with base disc mesh for STL export
export function generateLegsWithBaseMesh(
  params: ParametricParams
): THREE.BufferGeometry {
  return generateLegsWithBase(
    params.baseRadius,
    params.legCount,
    params.legHeight,
    params.legSpread,
    params.legThickness,
    params.legTaper,
    params.legInset,
    params.baseThickness || 3,
    {
      wobbleFrequency: params.wobbleFrequency,
      wobbleAmplitude: params.wobbleAmplitude,
      rippleCount: params.rippleCount,
      rippleDepth: params.rippleDepth,
      asymmetry: params.asymmetry,
      organicNoise: params.organicNoise,
      noiseScale: params.noiseScale,
    },
    {
      plugHeight: params.plugHeight ?? 8,
      plugGap: params.plugGap ?? 0.25,
      lipWidth: params.lipWidth ?? 2,
      wallThickness: params.wallThickness,
      cordHoleEnabled: params.cordHoleEnabled,
      cordHoleDiameter: params.cordHoleDiameter,
    }
  );
}

// Legacy function for backwards compatibility
export function generatePrintableMesh(
  params: ParametricParams,
  type: ObjectType
): THREE.BufferGeometry {
  return generateBodyMesh(params, type);
}

// Export body mesh to STL
export function exportBodyToSTL(
  params: ParametricParams,
  type: ObjectType
): Blob {
  const geometry = generateBodyMesh(params, type);
  const mesh = new THREE.Mesh(geometry);
  
  const exporter = new STLExporter();
  const result = exporter.parse(mesh);
  
  return new Blob([result], { type: 'application/octet-stream' });
}

// Export legs+base mesh to STL
export function exportLegsWithBaseToSTL(
  params: ParametricParams
): Blob {
  const geometry = generateLegsWithBaseMesh(params);
  const mesh = new THREE.Mesh(geometry);
  
  const exporter = new STLExporter();
  const result = exporter.parse(mesh);
  
  return new Blob([result], { type: 'application/octet-stream' });
}

// Legacy export function
export function exportToSTL(
  params: ParametricParams,
  type: ObjectType
): Blob {
  return exportBodyToSTL(params, type);
}

// Download body STL
export function downloadBodySTL(
  params: ParametricParams,
  type: ObjectType,
  filename: string = 'body.stl'
): void {
  const blob = exportBodyToSTL(params, type);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Download legs+base STL
export function downloadLegsWithBaseSTL(
  params: ParametricParams,
  filename: string = 'legs_base.stl'
): void {
  const blob = exportLegsWithBaseToSTL(params);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Download both parts
export function downloadAllParts(
  params: ParametricParams,
  type: ObjectType,
  baseFilename: string = 'model'
): void {
  downloadBodySTL(params, type, `${baseFilename}_body.stl`);
  
  if (params.addLegs) {
    setTimeout(() => {
      downloadLegsWithBaseSTL(params, `${baseFilename}_legs_base.stl`);
    }, 100);
  }
}

// Legacy download function
export function downloadSTL(
  params: ParametricParams,
  type: ObjectType,
  filename: string = 'model.stl'
): void {
  downloadBodySTL(params, type, filename);
}

// Generate G-code toolpath data
export interface GCodeLayer {
  z: number;
  paths: Array<{ x: number; y: number; z?: number }[]>;  // z is for non-planar
}

// Generate spiral vase G-code layers (continuous Z movement)
export function generateSpiralVaseLayers(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): GCodeLayer[] {
  const layers: GCodeLayer[] = [];
  const { height, twistAngle } = params;
  const { layerHeight } = settings;
  
  const totalLayers = Math.ceil(height / layerHeight);
  const segments = 64; // Points per revolution
  const totalPoints = totalLayers * segments;
  
  // Single continuous spiral path
  const spiralPath: { x: number; y: number; z: number }[] = [];
  
  for (let i = 0; i <= totalPoints; i++) {
    const progress = i / totalPoints;
    const z = progress * height;
    const t = z / height;
    const revolutions = i / segments;
    const theta = revolutions * Math.PI * 2;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    const outerR = getRadiusAtHeight(t, params, type, theta + twistRad);
    
    spiralPath.push({
      x: Math.cos(theta + twistRad) * outerR,
      y: Math.sin(theta + twistRad) * outerR,
      z: z,
    });
  }
  
  // Return as single layer with spiral path
  layers.push({
    z: 0,
    paths: [spiralPath],
  });
  
  return layers;
}

export function generateGCodeLayers(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): GCodeLayer[] {
  // Use spiral mode if enabled
  if (settings.spiralVase || settings.printMode === 'vase_spiral') {
    return generateSpiralVaseLayers(params, type, settings);
  }
  
  const layers: GCodeLayer[] = [];
  const { height, wallThickness, twistAngle } = params;
  const { layerHeight, nozzleDiameter } = settings;
  
  const layerCount = Math.ceil(height / layerHeight);
  const segments = 48; // Points per perimeter
  
  for (let layer = 0; layer < layerCount; layer++) {
    const z = layer * layerHeight;
    const t = z / height;
    const twistRad = (twistAngle * Math.PI / 180) * t;
    
    const outerPath: { x: number; y: number }[] = [];
    const innerPath: { x: number; y: number }[] = [];
    
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2 + twistRad;
      const outerR = getRadiusAtHeight(t, params, type, theta);
      const innerR = Math.max(outerR - wallThickness, wallThickness);
      
      outerPath.push({
        x: Math.cos(theta) * outerR,
        y: Math.sin(theta) * outerR,
      });
      
      innerPath.push({
        x: Math.cos(theta) * innerR,
        y: Math.sin(theta) * innerR,
      });
    }
    
    layers.push({
      z,
      paths: [outerPath, innerPath],
    });
  }
  
  return layers;
}

// Generate actual G-code string
export function generateGCode(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings
): string {
  const layers = generateGCodeLayers(params, type, settings);
  const { printSpeed, layerHeight, material } = settings;
  const isSpiralVase = settings.spiralVase || settings.printMode === 'vase_spiral';
  const isNonPlanar = settings.printMode === 'non_planar';
  
  const lines: string[] = [];
  
  // G-code header
  lines.push('; Generated by Parametric 3D Generator');
  lines.push(`; Object Type: ${type}`);
  lines.push(`; Height: ${params.height}mm`);
  lines.push(`; Material: ${material}`);
  lines.push(`; Layer Height: ${layerHeight}mm`);
  lines.push(`; Print Mode: ${settings.printMode}`);
  if (isSpiralVase) {
    lines.push('; Mode: Spiral Vase (continuous Z movement)');
  }
  if (isNonPlanar) {
    lines.push(`; Non-Planar: Max Z Angle ${settings.nonPlanar.maxZAngle}°`);
    lines.push('; Note: Requires non-planar capable slicer/printer');
  }
  lines.push(`; Layers: ${isSpiralVase ? 'Continuous spiral' : layers.length}`);
  lines.push('');
  lines.push('G21 ; Set units to millimeters');
  lines.push('G90 ; Use absolute positioning');
  lines.push('M82 ; Use absolute extrusion');
  lines.push('G28 ; Home all axes');
  lines.push('G1 Z5 F3000 ; Lift nozzle');
  lines.push('');
  
  // Temperature settings based on material
  const temps: Record<string, { bed: number; nozzle: number }> = {
    PLA: { bed: 60, nozzle: 200 },
    PETG: { bed: 80, nozzle: 235 },
    ABS: { bed: 100, nozzle: 240 },
    TPU: { bed: 50, nozzle: 220 },
  };
  const temp = temps[material] || temps.PLA;
  
  lines.push(`M140 S${temp.bed} ; Set bed temperature`);
  lines.push(`M104 S${temp.nozzle} ; Set nozzle temperature`);
  lines.push(`M190 S${temp.bed} ; Wait for bed`);
  lines.push(`M109 S${temp.nozzle} ; Wait for nozzle`);
  lines.push('');
  
  // Print layers
  let e = 0; // Extrusion distance
  const filamentDiameter = 1.75;
  const nozzleDiameter = settings.nozzleDiameter;
  const extrusionMultiplier = (layerHeight * nozzleDiameter) / (Math.PI * Math.pow(filamentDiameter / 2, 2));
  
  if (isSpiralVase && layers.length > 0 && layers[0].paths.length > 0) {
    // Spiral vase mode - continuous Z movement
    lines.push('; Spiral Vase Mode - Continuous extrusion');
    const spiralPath = layers[0].paths[0];
    
    if (spiralPath.length > 0) {
      const firstPoint = spiralPath[0];
      lines.push(`G0 X${firstPoint.x.toFixed(3)} Y${firstPoint.y.toFixed(3)} Z${(firstPoint.z || 0).toFixed(3)} F3000`);
      
      for (let i = 1; i < spiralPath.length; i++) {
        const point = spiralPath[i];
        const prevPoint = spiralPath[i - 1];
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const dz = (point.z || 0) - (prevPoint.z || 0);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        e += dist * extrusionMultiplier;
        
        lines.push(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} Z${(point.z || 0).toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
      }
    }
  } else {
    // Standard layer-by-layer printing
    layers.forEach((layer, layerIndex) => {
      lines.push(`; Layer ${layerIndex + 1} / ${layers.length}`);
      lines.push(`G1 Z${layer.z.toFixed(3)} F1000`);
      
      layer.paths.forEach((path, pathIndex) => {
        if (path.length < 2) return;
        
        // Move to start
        lines.push(`G0 X${path[0].x.toFixed(3)} Y${path[0].y.toFixed(3)} F3000`);
        
        // Extrude along path
        for (let i = 1; i < path.length; i++) {
          const dx = path[i].x - path[i - 1].x;
          const dy = path[i].y - path[i - 1].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          e += dist * extrusionMultiplier;
          
          lines.push(`G1 X${path[i].x.toFixed(3)} Y${path[i].y.toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
        }
      });
    });
  }
  
  // G-code footer
  lines.push('');
  lines.push('; End G-code');
  lines.push('G1 E-2 F2400 ; Retract');
  lines.push(`G1 Z${params.height + 10} F3000 ; Lift nozzle`);
  lines.push('G28 X Y ; Home X and Y');
  lines.push('M104 S0 ; Turn off nozzle');
  lines.push('M140 S0 ; Turn off bed');
  lines.push('M84 ; Disable motors');
  
  return lines.join('\n');
}

// Download G-code file
export function downloadGCode(
  params: ParametricParams,
  type: ObjectType,
  settings: PrintSettings,
  filename: string = 'model.gcode'
): void {
  const gcode = generateGCode(params, type, settings);
  const blob = new Blob([gcode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
