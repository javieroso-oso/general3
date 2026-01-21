import { PlotterPath, SpiralParams, PlotterDrawing, PAPER_SIZES } from '@/types/plotter';
import { seedNoise, noise2D } from '../noise';

export interface SpiralOptions {
  params: SpiralParams;
  width: number;
  height: number;
  margin: number;
}

// Generate an Archimedean spiral
export function generateSpiral(options: SpiralOptions): PlotterDrawing {
  const { params, width, height, margin } = options;
  
  seedNoise(params.seed);
  
  const paths: PlotterPath[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Calculate max radius based on paper size
  const maxRadius = Math.min(width - 2 * margin, height - 2 * margin) / 2;
  
  const points: { x: number; y: number }[] = [];
  const totalAngle = params.turns * Math.PI * 2;
  const angleStep = 0.05; // radians per step
  
  for (let angle = 0; angle <= totalAngle; angle += angleStep) {
    // Archimedean spiral: r = a + b*theta
    const baseRadius = params.startRadius + (angle / (Math.PI * 2)) * params.spacing;
    
    // Add variation using noise
    let radius = baseRadius;
    if (params.variation > 0) {
      const noiseVal = noise2D(angle * 0.5, params.seed * 0.01);
      radius += noiseVal * params.variation * 5;
    }
    
    // Clamp to max radius
    if (radius > maxRadius) break;
    
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    
    points.push({ x, y });
  }
  
  if (points.length >= 2) {
    paths.push({
      points,
      penDown: true,
    });
  }
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

// Generate concentric circles with optional distortion
export function generateConcentricCircles(options: SpiralOptions): PlotterDrawing {
  const { params, width, height, margin } = options;
  
  seedNoise(params.seed);
  
  const paths: PlotterPath[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width - 2 * margin, height - 2 * margin) / 2;
  
  const circleCount = Math.floor(maxRadius / params.spacing);
  
  for (let i = 1; i <= circleCount; i++) {
    const baseRadius = params.startRadius + i * params.spacing;
    if (baseRadius > maxRadius) break;
    
    const points: { x: number; y: number }[] = [];
    const angleStep = 0.05;
    
    for (let angle = 0; angle <= Math.PI * 2 + angleStep; angle += angleStep) {
      let radius = baseRadius;
      
      // Add variation
      if (params.variation > 0) {
        const noiseVal = noise2D(
          Math.cos(angle) * 2 + i * 0.1,
          Math.sin(angle) * 2 + params.seed * 0.01
        );
        radius += noiseVal * params.variation * 10;
      }
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      points.push({ x, y });
    }
    
    paths.push({
      points,
      penDown: true,
    });
  }
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

// Generate for paper
export function generateSpiralForPaper(
  paperSize: string,
  orientation: 'portrait' | 'landscape',
  marginMm: number,
  params: SpiralParams
): PlotterDrawing {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const width = orientation === 'landscape' ? paper.height : paper.width;
  const height = orientation === 'landscape' ? paper.width : paper.height;
  
  return generateSpiral({
    params,
    width,
    height,
    margin: marginMm,
  });
}
