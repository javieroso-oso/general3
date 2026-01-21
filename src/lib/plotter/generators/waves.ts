import { PlotterPath, WaveParams, PlotterDrawing, PAPER_SIZES } from '@/types/plotter';
import { seedNoise, noise2D } from '../noise';

export interface WaveOptions {
  params: WaveParams;
  width: number;
  height: number;
  margin: number;
  seed?: number;
}

// Generate parallel wave lines
export function generateWaves(options: WaveOptions): PlotterDrawing {
  const { params, width, height, margin, seed = 0 } = options;
  
  seedNoise(seed);
  
  const paths: PlotterPath[] = [];
  const spacing = (height - 2 * margin) / params.waveCount;
  
  for (let i = 0; i < params.waveCount; i++) {
    const baseY = margin + spacing * (i + 0.5);
    const points: { x: number; y: number }[] = [];
    
    // Individual wave phase offset
    const wavePhase = i * params.phaseOffset;
    
    // Amplitude decay from edges or center
    const normalizedPos = i / (params.waveCount - 1);
    const distFromCenter = Math.abs(normalizedPos - 0.5) * 2;
    const amplitudeMultiplier = 1 - distFromCenter * params.decay * 10;
    
    for (let x = margin; x <= width - margin; x += 1) {
      const wave1 = Math.sin(x * params.frequency + wavePhase) * params.amplitude;
      
      // Add secondary wave for complexity
      const wave2 = Math.sin(x * params.frequency * 2.3 + wavePhase * 1.5) * params.amplitude * 0.3;
      
      // Add noise for organic feel
      const noiseVal = noise2D(x * 0.01, i * 0.5) * params.amplitude * 0.2;
      
      const y = baseY + (wave1 + wave2 + noiseVal) * Math.max(0.1, amplitudeMultiplier);
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

// Generate interference pattern (two wave sources)
export function generateInterference(options: WaveOptions): PlotterDrawing {
  const { params, width, height, margin } = options;
  
  const paths: PlotterPath[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Two wave sources
  const source1 = { x: centerX - 40, y: centerY };
  const source2 = { x: centerX + 40, y: centerY };
  
  // Generate contour lines of constant phase difference
  const contourLevels = params.waveCount;
  
  for (let level = 0; level < contourLevels; level++) {
    const targetPhase = (level / contourLevels) * Math.PI * 2;
    
    // March around finding points at this phase
    const points: { x: number; y: number }[] = [];
    
    for (let angle = 0; angle <= Math.PI * 2; angle += 0.02) {
      // Search outward from center
      for (let r = 10; r < Math.min(width, height) / 2 - margin; r += 2) {
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        
        // Calculate distance to each source
        const d1 = Math.sqrt((x - source1.x) ** 2 + (y - source1.y) ** 2);
        const d2 = Math.sqrt((x - source2.x) ** 2 + (y - source2.y) ** 2);
        
        // Phase difference
        const phaseDiff = ((d1 - d2) * params.frequency) % (Math.PI * 2);
        
        if (Math.abs(phaseDiff - targetPhase) < 0.1) {
          points.push({ x, y });
          break;
        }
      }
    }
    
    if (points.length >= 3) {
      paths.push({
        points,
        penDown: true,
      });
    }
  }
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

// Generate for paper
export function generateWavesForPaper(
  paperSize: string,
  orientation: 'portrait' | 'landscape',
  marginMm: number,
  params: WaveParams,
  seed?: number
): PlotterDrawing {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const width = orientation === 'landscape' ? paper.height : paper.width;
  const height = orientation === 'landscape' ? paper.width : paper.height;
  
  return generateWaves({
    params,
    width,
    height,
    margin: marginMm,
    seed,
  });
}
