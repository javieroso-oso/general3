import { PlotterPath, LissajousParams, PlotterDrawing, PAPER_SIZES } from '@/types/plotter';

export interface LissajousOptions {
  params: LissajousParams;
  width: number;
  height: number;
  margin: number;
}

// Generate a Lissajous curve
export function generateLissajous(options: LissajousOptions): PlotterDrawing {
  const { params, width, height, margin } = options;
  
  const paths: PlotterPath[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Scale amplitude to fit paper
  const maxAmplitude = Math.min(width - 2 * margin, height - 2 * margin) / 2;
  const amplitude = Math.min(params.amplitude, maxAmplitude);
  
  const points: { x: number; y: number }[] = [];
  
  // Calculate how many points we need for a complete figure
  // For Lissajous, period is 2*PI * LCM(freqX, freqY) / (freqX * freqY)
  const tMax = Math.PI * 2 * Math.max(params.freqX, params.freqY);
  const tStep = tMax / params.points;
  
  for (let t = 0; t <= tMax; t += tStep) {
    const x = centerX + amplitude * Math.sin(params.freqX * t + params.phaseX);
    const y = centerY + amplitude * Math.sin(params.freqY * t + params.phaseY);
    points.push({ x, y });
  }
  
  // Close the curve
  if (points.length > 0) {
    points.push({ ...points[0] });
  }
  
  paths.push({
    points,
    penDown: true,
  });
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

// Generate a spirograph (epitrochoid/hypotrochoid)
export function generateSpirograph(options: LissajousOptions): PlotterDrawing {
  const { params, width, height, margin } = options;
  
  const paths: PlotterPath[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  
  const maxRadius = Math.min(width - 2 * margin, height - 2 * margin) / 2;
  
  // Spirograph parameters derived from Lissajous params
  const R = maxRadius * 0.6; // Fixed circle radius
  const r = R / params.freqX; // Rolling circle radius
  const d = r * (params.freqY / params.freqX); // Pen distance from center
  
  const points: { x: number; y: number }[] = [];
  
  // GCD to determine complete rotation
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const rotations = params.freqX / gcd(Math.round(params.freqX), Math.round(params.freqY));
  const tMax = Math.PI * 2 * rotations;
  const tStep = tMax / params.points;
  
  for (let t = 0; t <= tMax; t += tStep) {
    // Hypotrochoid equations
    const x = centerX + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = centerY + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    points.push({ x, y });
  }
  
  paths.push({
    points,
    penDown: true,
  });
  
  return {
    paths,
    width,
    height,
    units: 'mm',
  };
}

// Generate for paper
export function generateLissajousForPaper(
  paperSize: string,
  orientation: 'portrait' | 'landscape',
  marginMm: number,
  params: LissajousParams
): PlotterDrawing {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const width = orientation === 'landscape' ? paper.height : paper.width;
  const height = orientation === 'landscape' ? paper.width : paper.height;
  
  return generateLissajous({
    params,
    width,
    height,
    margin: marginMm,
  });
}
