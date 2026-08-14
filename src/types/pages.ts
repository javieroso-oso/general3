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

export interface BookCovers {
  enabled: boolean;
  thickness: number;   // mm — several perimeters
  overhang: number;    // mm — how far covers extend past the pages
  front: PageContent;
  back: PageContent;
}

export interface BookParams {
  // Page geometry (mm)
  pageWidth: number;
  pageHeight: number;
  pageThickness: number;

  // Spine geometry (mm)
  spineThickness: number;  // legacy; kept for backward compatibility
  spineWallThickness: number; // solid spine slab wall thickness
  spineExtra: number;      // spine block height before pages begin
  pageGap: number;         // gap between adjacent pages along the spine

  // End rails (for coverless books)
  endRails: boolean;
  endRailHeight: number;

  // Covers
  covers: BookCovers;

  // Default per-page relief (used when a page doesn't override)
  defaultReliefHeight: number;

  // Pages
  pages: PageContent[];
}

export const createEmptyPage = (type: PageContentType = 'text'): PageContent => ({
  id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  type,
  text: type === 'text' ? '' : undefined,
  fontSize: 18,
  fontFamily: 'sans-serif',
  align: 'center',
  drawing: type === 'drawing' ? { strokes: [] } : undefined,
  imageInvert: false,
  imageThreshold: 0.15,
  imageContrast: 1.2,
  imageFit: 'contain',
  reliefHeight: 0.4,
  faces: 'front',
});

export const defaultBookParams: BookParams = {
  pageWidth: 60,
  pageHeight: 90,
  pageThickness: 0.42,    // single nozzle wall — vase-mode-thin
  spineThickness: 0.6,
  spineWallThickness: 1.6,
  spineExtra: 3.0,
  pageGap: 1.6,
  endRails: false,
  endRailHeight: 6,
  covers: {
    enabled: true,
    thickness: 1.2,
    overhang: 1.5,
    front: { ...createEmptyPage('text'), id: 'cover_front', text: 'My Book', fontSize: 12, faces: 'front' },
    back: { ...createEmptyPage('text'), id: 'cover_back', text: '', fontSize: 12, faces: 'back' },
  },
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

/** Fills in fields missing from older saved books. */
export const normalizeBookParams = (b: BookParams): BookParams => ({
  ...defaultBookParams,
  ...b,
  covers: { ...defaultBookParams.covers, ...(b?.covers ?? {}) },
});

