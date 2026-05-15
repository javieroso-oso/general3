/**
 * Builds a 2D height field (Float32 grid) for a single page.
 *
 * Coordinates: u in [0,1] across pageWidth (left→right), v in [0,1] across
 * pageHeight (top→bottom — note: matches drawing canvas convention).
 *
 * Text pages: rasterize via offscreen 2D canvas, treat alpha as relief mask.
 * Drawing pages: rasterize each polyline via cheap distance-to-segment per cell.
 */

import { PageContent, PageDrawingStroke } from '@/types/pages';

export interface PageHeightField {
  width: number;  // grid cells across u
  height: number; // grid cells across v
  data: Float32Array; // length = width*height, value = relief in mm
  hasAny: boolean;
}

const DEFAULT_DPI = 6; // grid cells per mm — 6/mm ≈ 150 DPI; good balance for STL

export interface BuildOptions {
  pageWidthMm: number;
  pageHeightMm: number;
  cellsPerMm?: number;
}

export function buildPageHeightField(
  page: PageContent,
  opts: BuildOptions,
): PageHeightField {
  const cellsPerMm = opts.cellsPerMm ?? DEFAULT_DPI;
  const W = Math.max(8, Math.round(opts.pageWidthMm * cellsPerMm));
  const H = Math.max(8, Math.round(opts.pageHeightMm * cellsPerMm));
  const data = new Float32Array(W * H);
  const relief = page.reliefHeight;
  let hasAny = false;

  if (page.type === 'text' && page.text && page.text.trim().length > 0) {
    hasAny = rasterizeText(page, opts, W, H, data, relief);
  } else if (page.type === 'drawing' && page.drawing && page.drawing.strokes.length > 0) {
    hasAny = rasterizeStrokes(page.drawing.strokes, opts, W, H, data, relief);
  }

  return { width: W, height: H, data, hasAny };
}

function rasterizeText(
  page: PageContent,
  opts: BuildOptions,
  W: number,
  H: number,
  data: Float32Array,
  relief: number,
): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  const pxPerMm = W / opts.pageWidthMm;
  const fontPx = Math.max(8, (page.fontSize ?? 18) * pxPerMm);
  ctx.font = `bold ${Math.round(fontPx)}px ${page.fontFamily ?? 'sans-serif'}`;
  ctx.textBaseline = 'middle';
  const align = page.align ?? 'center';
  ctx.textAlign = align as CanvasTextAlign;

  // Word-wrap by lines (split on \n only — simple)
  const lines = (page.text ?? '').split('\n');
  const lineHeight = fontPx * 1.15;
  const totalH = lineHeight * lines.length;
  const startY = (H - totalH) / 2 + lineHeight / 2;
  const x = align === 'left' ? W * 0.08 : align === 'right' ? W * 0.92 : W / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight);
  }

  const img = ctx.getImageData(0, 0, W, H).data;
  let any = false;
  // Use the red channel: 0=background, 255=glyph. Apply slight smoothing
  // (linear from intensity) so anti-aliased edges become tapered relief.
  for (let i = 0, j = 0; i < img.length; i += 4, j++) {
    const v = img[i] / 255;
    if (v > 0.05) {
      data[j] = v * relief;
      any = true;
    }
  }
  return any;
}

function rasterizeStrokes(
  strokes: PageDrawingStroke[],
  opts: BuildOptions,
  W: number,
  H: number,
  data: Float32Array,
  relief: number,
): boolean {
  let any = false;
  const pxPerMmU = W / opts.pageWidthMm;
  const pxPerMmV = H / opts.pageHeightMm;

  for (const s of strokes) {
    if (!s.points || s.points.length < 2) continue;
    const halfW_u = (s.thickness * 0.5) * pxPerMmU; // half-thickness in cells
    // For each segment, splat a thick line into the grid
    for (let i = 0; i < s.points.length - 1; i++) {
      const ax = s.points[i].u * (W - 1);
      const ay = s.points[i].v * (H - 1);
      const bx = s.points[i + 1].u * (W - 1);
      const by = s.points[i + 1].v * (H - 1);
      const minX = Math.max(0, Math.floor(Math.min(ax, bx) - halfW_u - 1));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + halfW_u + 1));
      const minY = Math.max(0, Math.floor(Math.min(ay, by) - halfW_u - 1));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by) + halfW_u + 1));
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x - ax;
          const py = y - ay;
          let t = (px * dx + py * dy) / len2;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          const cx = ax + dx * t;
          const cy = ay + dy * t;
          const ex = x - cx;
          const ey = y - cy;
          const dist = Math.sqrt(ex * ex + ey * ey);
          if (dist >= halfW_u) continue;
          const k = 1 - dist / halfW_u;
          // Smooth crown
          const eased = 0.5 - 0.5 * Math.cos(k * Math.PI);
          const contrib = relief * eased;
          const idx = y * W + x;
          if (contrib > data[idx]) {
            data[idx] = contrib;
            any = true;
          }
        }
      }
    }
  }
  return any;
}

export function sampleField(field: PageHeightField, u: number, v: number): number {
  if (!field.hasAny) return 0;
  const fx = u * (field.width - 1);
  const fy = v * (field.height - 1);
  const x = Math.max(0, Math.min(field.width - 1, Math.round(fx)));
  const y = Math.max(0, Math.min(field.height - 1, Math.round(fy)));
  return field.data[y * field.width + x];
}
