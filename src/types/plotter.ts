// Paper size presets (dimensions in mm)
export interface PaperSize {
  name: string;
  width: number;
  height: number;
}

export const PAPER_SIZES: Record<string, PaperSize> = {
  a4: { name: 'A4', width: 210, height: 297 },
  a3: { name: 'A3', width: 297, height: 420 },
  a5: { name: 'A5', width: 148, height: 210 },
  letter: { name: 'Letter', width: 216, height: 279 },
  tabloid: { name: 'Tabloid', width: 279, height: 432 },
  square_8: { name: '8" Square', width: 203, height: 203 },
  square_12: { name: '12" Square', width: 305, height: 305 },
};

// Plotter modes
export type PlotterMode = 'generative' | 'image' | 'projection';

// Generative pattern types
export type GenerativePattern = 
  | 'flowField' 
  | 'particles' 
  | 'spiral' 
  | 'lissajous' 
  | 'waveFunctions'
  | 'concentricCircles'
  | 'voronoi';

// Hatching styles for image conversion
export type HatchStyle = 'parallel' | 'crosshatch' | 'stipple' | 'contour';

// Projection types for 3D to 2D
export type ProjectionType = 'crossSection' | 'silhouette' | 'contourStack' | 'lineField' | 'contourLines';

// Line field wrap modes
export type LineFieldMode = 'around' | 'through' | 'outline';

// Line field geometry modes
export type LineFieldGeometry = 'parallel' | 'radial';

// A single path segment with pen state
export interface PlotterPath {
  points: Array<{ x: number; y: number }>;
  penDown: boolean;
  layer?: number;
  color?: string;
}

// Complete plotter drawing
export interface PlotterDrawing {
  paths: PlotterPath[];
  width: number;
  height: number;
  units: 'mm' | 'px';
}

// Flow field parameters
export interface FlowFieldParams {
  noiseScale: number;        // 0.001 - 0.05
  noiseOctaves: number;      // 1 - 4
  particleCount: number;     // 50 - 500
  lineLength: number;        // 10 - 200
  stepSize: number;          // 1 - 10
  curvature: number;         // 0.5 - 2
  seed: number;
}

// Particle system parameters
export interface ParticleParams {
  particleCount: number;
  lifespan: number;
  trailLength: number;
  gravity: { x: number; y: number };
  attractors: Array<{ x: number; y: number; strength: number }>;
  seed: number;
}

// Spiral parameters
export interface SpiralParams {
  turns: number;
  spacing: number;
  startRadius: number;
  variation: number;
  seed: number;
}

// Lissajous parameters
export interface LissajousParams {
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  amplitude: number;
  points: number;
}

// Wave function parameters
export interface WaveParams {
  frequency: number;
  amplitude: number;
  waveCount: number;
  phaseOffset: number;
  decay: number;
}

// Image processing parameters
export interface ImageToPathParams {
  style: HatchStyle;
  lineSpacing: number;      // mm between lines
  angle: number;            // degrees for hatching
  densityResponse: number;  // 0.5 - 2 (gamma curve)
  contourLevels: number;    // for contour mode
  stippleDots: number;      // for stipple mode
  minBrightness: number;    // threshold
  maxBrightness: number;
}

// 3D projection parameters
export interface ProjectionParams {
  type: ProjectionType;
  sliceCount: number;
  sliceSpacing: number;
  viewAngle: { x: number; y: number };
  scale: number;
  showHiddenLines: boolean;
  // New settings
  lineDetail: number;        // Angular segments (32-128) - higher = smoother curves
  strokeWeight: number;      // Suggested stroke weight in mm (0.1-1.0)
  perspective: number;       // Perspective amount for contour stack (0-1)
  centerOffset: { x: number; y: number }; // Offset from center in mm
  simplifyTolerance: number; // Path simplification (0=none, higher=more)
  // Line field settings - Core
  lineFieldCount: number;        // 10-100 - how many lines fill the page
  lineFieldAngle: number;        // 0-180 degrees - direction of lines
  lineFieldStrength: number;     // 0-2 distortion multiplier
  lineFieldFalloff: number;      // 0.5-3 distance falloff
  lineFieldMode: LineFieldMode;  // How lines interact with shape
  lineFieldExtend: boolean;      // Extend lines beyond paper edges
  
  // Line field settings - Enhanced
  lineFieldGeometry: LineFieldGeometry; // parallel or radial lines
  lineFieldWobble: number;       // 0-1 organic noise amount
  lineFieldWobbleScale: number;  // 0.01-0.1 noise frequency
  lineFieldDensityVar: boolean;  // Variable density near shape
  lineFieldBreakInside: boolean; // Break lines inside shape (negative space)
  lineFieldWaveAmp: number;      // 0-20 wave modulation amplitude
  lineFieldWaveFreq: number;     // 1-10 wave frequency
  lineFieldOverlayCount: number; // 1-4 number of angle layers
  lineFieldOverlayOffset: number;// 15-90 degrees between layers
  lineFieldFillInside: boolean;  // Fill shape with different pattern
  lineFieldFillDensity: number;  // 1-3 fill pattern density multiplier
}

// Machine presets for G-code
export interface PlotterMachine {
  name: string;
  penUpZ: number;
  penDownZ: number;
  travelSpeed: number;
  drawSpeed: number;
  acceleration?: number;
}

export const PLOTTER_MACHINES: Record<string, PlotterMachine> = {
  axidraw: {
    name: 'AxiDraw',
    penUpZ: 60,
    penDownZ: 40,
    travelSpeed: 3000,
    drawSpeed: 1000,
  },
  generic: {
    name: 'Generic CNC',
    penUpZ: 5,
    penDownZ: 0,
    travelSpeed: 2000,
    drawSpeed: 800,
  },
  custom: {
    name: 'Custom',
    penUpZ: 5,
    penDownZ: 0,
    travelSpeed: 2000,
    drawSpeed: 1000,
  },
};

// Captured 3D mesh parameters for projection mode (legacy, kept for compatibility)
export interface CapturedMeshParams {
  params: Record<string, unknown>; // ParametricParams - stored as generic to avoid circular dep
  objectType: string;
  capturedAt: number; // timestamp
}

// Live 3D mesh parameters for projection mode (new: always-synced)
export interface LiveMeshParams {
  params: Record<string, unknown>; // ParametricParams
  shapeStyle: 'vase' | 'lamp' | 'sculpture';
}

// Preview color settings
export interface PlotterPreviewColors {
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  paperTint: 'white' | 'cream' | 'kraft' | 'black';
  multiPen: boolean;
  penColors: string[];
}

export const PAPER_PRESETS: Record<string, { background: string; stroke: string; label: string }> = {
  white: { background: '#ffffff', stroke: '#000000', label: 'White' },
  cream: { background: '#f5f0e1', stroke: '#1a1a1a', label: 'Cream' },
  kraft: { background: '#c4a882', stroke: '#2d1f10', label: 'Kraft' },
  black: { background: '#1a1a1a', stroke: '#ffffff', label: 'Black' },
};

export const defaultPreviewColors: PlotterPreviewColors = {
  strokeColor: '#000000',
  backgroundColor: '#ffffff',
  strokeWidth: 0.5,
  paperTint: 'white',
  multiPen: false,
  penColors: ['#000000', '#e63946', '#457b9d', '#2a9d8f'],
};

// Complete plotter parameters
export interface PlotterParams {
  // Paper settings
  paperSize: string;
  orientation: 'portrait' | 'landscape';
  marginMm: number;
  
  // Mode selection
  mode: PlotterMode;
  
  // Generative settings
  pattern: GenerativePattern;
  flowField: FlowFieldParams;
  particles: ParticleParams;
  spiral: SpiralParams;
  lissajous: LissajousParams;
  wave: WaveParams;
  
  // Image settings
  imagePath: ImageToPathParams;
  imageData?: string; // base64 encoded image
  
  // Projection settings
  projection: ProjectionParams;
  capturedMesh?: CapturedMeshParams; // Legacy: Captured 3D design for projection
  liveMesh?: LiveMeshParams; // New: Always-synced 3D design for live projection
  
  // Export settings
  machinePreset: string;
  optimizePaths: boolean;
}

// Default parameters
export const defaultFlowFieldParams: FlowFieldParams = {
  noiseScale: 0.008,
  noiseOctaves: 2,
  particleCount: 150,
  lineLength: 80,
  stepSize: 2,
  curvature: 1,
  seed: Math.floor(Math.random() * 10000),
};

export const defaultParticleParams: ParticleParams = {
  particleCount: 100,
  lifespan: 200,
  trailLength: 50,
  gravity: { x: 0, y: 0.1 },
  attractors: [],
  seed: Math.floor(Math.random() * 10000),
};

export const defaultSpiralParams: SpiralParams = {
  turns: 10,
  spacing: 5,
  startRadius: 5,
  variation: 0,
  seed: Math.floor(Math.random() * 10000),
};

export const defaultLissajousParams: LissajousParams = {
  freqX: 3,
  freqY: 2,
  phaseX: 0,
  phaseY: Math.PI / 2,
  amplitude: 80,
  points: 1000,
};

export const defaultWaveParams: WaveParams = {
  frequency: 0.05,
  amplitude: 20,
  waveCount: 20,
  phaseOffset: 0.2,
  decay: 0.02,
};

export const defaultImageToPathParams: ImageToPathParams = {
  style: 'parallel',
  lineSpacing: 2,
  angle: 45,
  densityResponse: 1,
  contourLevels: 8,
  stippleDots: 5000,
  minBrightness: 0,
  maxBrightness: 255,
};

export const defaultProjectionParams: ProjectionParams = {
  type: 'crossSection',
  sliceCount: 20,
  sliceSpacing: 5,
  viewAngle: { x: 0, y: 0 },
  scale: 1,
  showHiddenLines: false,
  lineDetail: 64,
  strokeWeight: 0.3,
  perspective: 0.3,
  centerOffset: { x: 0, y: 0 },
  simplifyTolerance: 0,
  // Line field defaults - Core
  lineFieldCount: 40,
  lineFieldAngle: 0,
  lineFieldStrength: 1,
  lineFieldFalloff: 1.5,
  lineFieldMode: 'around',
  lineFieldExtend: true,
  
  // Line field defaults - Enhanced
  lineFieldGeometry: 'parallel',
  lineFieldWobble: 0,
  lineFieldWobbleScale: 0.03,
  lineFieldDensityVar: false,
  lineFieldBreakInside: false,
  lineFieldWaveAmp: 0,
  lineFieldWaveFreq: 3,
  lineFieldOverlayCount: 1,
  lineFieldOverlayOffset: 45,
  lineFieldFillInside: false,
  lineFieldFillDensity: 2,
};

export const defaultPlotterParams: PlotterParams = {
  paperSize: 'a4',
  orientation: 'portrait',
  marginMm: 10,
  mode: 'generative',
  pattern: 'flowField',
  flowField: defaultFlowFieldParams,
  particles: defaultParticleParams,
  spiral: defaultSpiralParams,
  lissajous: defaultLissajousParams,
  wave: defaultWaveParams,
  imagePath: defaultImageToPathParams,
  projection: defaultProjectionParams,
  machinePreset: 'axidraw',
  optimizePaths: true,
};
