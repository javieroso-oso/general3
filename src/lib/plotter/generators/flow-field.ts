import { PlotterPath, FlowFieldParams, PlotterDrawing, PAPER_SIZES } from '@/types/plotter';
import { seedNoise, noise2D, fbm2D } from '../noise';

export interface FlowFieldOptions {
  params: FlowFieldParams;
  width: number;
  height: number;
  margin: number;
}

// Generate a single flow line starting from a point
function traceFlowLine(
  startX: number,
  startY: number,
  options: FlowFieldOptions
): { x: number; y: number }[] {
  const { params, width, height, margin } = options;
  const points: { x: number; y: number }[] = [];
  
  let x = startX;
  let y = startY;
  
  const maxSteps = Math.floor(params.lineLength / params.stepSize);
  
  for (let step = 0; step < maxSteps; step++) {
    // Check bounds
    if (x < margin || x > width - margin || y < margin || y > height - margin) {
      break;
    }
    
    points.push({ x, y });
    
    // Get noise value at current position
    const noiseVal = fbm2D(
      x * params.noiseScale,
      y * params.noiseScale,
      params.noiseOctaves
    );
    
    // Convert to angle
    const angle = noiseVal * Math.PI * 2 * params.curvature;
    
    // Move in direction of flow
    x += Math.cos(angle) * params.stepSize;
    y += Math.sin(angle) * params.stepSize;
  }
  
  return points;
}

// Check if a point is too close to existing lines
function isTooClose(
  x: number,
  y: number,
  existingPoints: Set<string>,
  minDistance: number
): boolean {
  const cellSize = minDistance;
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);
  
  // Check neighboring cells
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${cellX + dx},${cellY + dy}`;
      if (existingPoints.has(key)) {
        return true;
      }
    }
  }
  
  return false;
}

// Main flow field generator
export function generateFlowField(options: FlowFieldOptions): PlotterDrawing {
  const { params, width, height, margin } = options;
  
  // Seed the noise
  seedNoise(params.seed);
  
  const paths: PlotterPath[] = [];
  const occupiedCells = new Set<string>();
  const minDistance = Math.max(3, params.lineLength / 20);
  
  // Generate starting points using Poisson disk-like distribution
  const startPoints: { x: number; y: number }[] = [];
  const attempts = params.particleCount * 10;
  
  for (let i = 0; i < attempts && startPoints.length < params.particleCount; i++) {
    const x = margin + Math.random() * (width - 2 * margin);
    const y = margin + Math.random() * (height - 2 * margin);
    
    if (!isTooClose(x, y, occupiedCells, minDistance * 2)) {
      startPoints.push({ x, y });
      const cellX = Math.floor(x / minDistance);
      const cellY = Math.floor(y / minDistance);
      occupiedCells.add(`${cellX},${cellY}`);
    }
  }
  
  // Trace flow lines from each starting point
  for (const start of startPoints) {
    const points = traceFlowLine(start.x, start.y, options);
    
    if (points.length >= 2) {
      paths.push({
        points,
        penDown: true,
      });
      
      // Mark cells as occupied
      for (const pt of points) {
        const cellX = Math.floor(pt.x / minDistance);
        const cellY = Math.floor(pt.y / minDistance);
        occupiedCells.add(`${cellX},${cellY}`);
      }
    }
  }
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

// Generate with paper size
export function generateFlowFieldForPaper(
  paperSize: string,
  orientation: 'portrait' | 'landscape',
  marginMm: number,
  params: FlowFieldParams
): PlotterDrawing {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const width = orientation === 'landscape' ? paper.height : paper.width;
  const height = orientation === 'landscape' ? paper.width : paper.height;
  
  return generateFlowField({
    params,
    width,
    height,
    margin: marginMm,
  });
}
