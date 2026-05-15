/**
 * Pages mode — 3D-printable books / planar drawing stacks.
 *
 * A book is a spine bar with N flat "page" slabs attached perpendicular to it.
 * Each page carries raised relief (text or freehand drawing) on one or both
 * faces. Print orientation: spine flat on the bed, pages standing vertically,
 * layers go up the page height — same trick as the reference Instagram book.
 */

export type PageContentType = 'text' | 'drawing' | 'image';

export interface PageDrawingStroke {
  // Normalized to the page rect: u in [0,1] (left→right), v in [0,1] (top→bottom)
  points: { u: number; v: number }[];
  thickness: number; // mm (in page-space)
}

export interface PageContent {
  id: string;
  type: PageContentType;

  // Text content
  text?: string;
  fontSize?: number;       // mm — actual cap height roughly
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';

  // Drawing content
  drawing?: { strokes: PageDrawingStroke[] };

  // Image content
  imageDataUrl?: string;
  imageInvert?: boolean;
  imageThreshold?: number;  // 0..1 cutoff
  imageContrast?: number;   // 0.5..3 gamma
  imageFit?: 'contain' | 'cover' | 'stretch';

  reliefHeight: number;    // mm raised above the page surface
  faces: 'front' | 'back' | 'both'; // which side(s) carry the relief
}

export interface BookParams {
  // Page geometry (mm)
  pageWidth: number;
  pageHeight: number;
  pageThickness: number;

  // Spine geometry (mm)
  spineThickness: number;  // extra thickness of spine vs pages
  spineExtra: number;      // how far the spine sticks out beyond the page edges (top/bottom)
  pageGap: number;         // gap between adjacent pages along the spine

  // Default per-page relief (used when a page doesn't override)
  defaultReliefHeight: number;

  // Pages
  pages: PageContent[];
}

export const defaultBookParams: BookParams = {
  pageWidth: 60,
  pageHeight: 90,
  pageThickness: 0.42,    // single nozzle wall — vase-mode-thin
  spineThickness: 0.6,    // derived padding around relief; not user-edited
  spineExtra: 3.0,
  pageGap: 1.6,
  defaultReliefHeight: 0.4,
  pages: [
    {
      id: 'p1',
      type: 'text',
      text: 'Hello',
      fontSize: 18,
      fontFamily: 'sans-serif',
      align: 'center',
      reliefHeight: 0.4,
      faces: 'front',
    },
    {
      id: 'p2',
      type: 'text',
      text: 'World',
      fontSize: 18,
      fontFamily: 'sans-serif',
      align: 'center',
      reliefHeight: 0.4,
      faces: 'front',
    },
  ],
};

export const createEmptyPage = (type: PageContentType = 'text'): PageContent => ({
  id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  type,
  text: type === 'text' ? '' : undefined,
  fontSize: 18,
  fontFamily: 'sans-serif',
  align: 'center',
  drawing: type === 'drawing' ? { strokes: [] } : undefined,
  reliefHeight: 0.4,
  faces: 'front',
});
