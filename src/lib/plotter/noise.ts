// Simplex noise implementation for flow fields
// Based on Stefan Gustavson's implementation

// Permutation table
const p = new Uint8Array(256);
const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);

// Gradient vectors for 2D
const grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];

// Initialize with seed
export function seedNoise(seed: number): void {
  // Simple seeded random
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed >>> 0) / 4294967296;
  };
  
  // Fill permutation table
  for (let i = 0; i < 256; i++) {
    p[i] = i;
  }
  
  // Shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  
  // Extend permutation table
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
}

// Initialize with default seed
seedNoise(0);

// 2D Simplex noise
export function noise2D(x: number, y: number): number {
  // Skewing factors
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  
  // Skew input space
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  
  // Unskew back
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  
  // Determine simplex
  let i1: number, j1: number;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  } else {
    i1 = 0;
    j1 = 1;
  }
  
  // Offsets for corners
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  
  // Hashed gradient indices
  const ii = i & 255;
  const jj = j & 255;
  const gi0 = permMod12[ii + perm[jj]];
  const gi1 = permMod12[ii + i1 + perm[jj + j1]];
  const gi2 = permMod12[ii + 1 + perm[jj + 1]];
  
  // Calculate contributions
  let n0 = 0, n1 = 0, n2 = 0;
  
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0);
  }
  
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1);
  }
  
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2);
  }
  
  // Scale to [-1, 1]
  return 70 * (n0 + n1 + n2);
}

// Fractal/octave noise
export function fbm2D(x: number, y: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  
  return value / maxValue;
}

// Curl noise for smooth flow fields (divergence-free)
export function curlNoise2D(x: number, y: number, epsilon: number = 0.0001): { x: number; y: number } {
  const dx = (noise2D(x, y + epsilon) - noise2D(x, y - epsilon)) / (2 * epsilon);
  const dy = (noise2D(x + epsilon, y) - noise2D(x - epsilon, y)) / (2 * epsilon);
  
  // Perpendicular to gradient for curl
  return { x: dx, y: -dy };
}
