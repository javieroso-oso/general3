## Goal

Add image support to pages — third content type alongside text and drawing — using the same height-field-to-relief pipeline already used for surface art.

## Changes

### 1. Type extension (`src/types/pages.ts`)

- Extend `PageContentType` union to `'text' | 'drawing' | 'image'`.
- Add to `PageContent`:
  - `imageDataUrl?: string` — uploaded image as base64 data URL (so it persists in book params without external storage).
  - `imageInvert?: boolean` — flip dark/light mapping.
  - `imageThreshold?: number` — 0–1, intensities below this contribute zero relief (cleans up noisy backgrounds).
  - `imageContrast?: number` — 0.5–3, scales the gamma curve.
  - `imageFit?: 'contain' | 'cover' | 'stretch'` — how it maps onto the page rect.
- `createEmptyPage('image')` initializes sensible defaults.

### 2. Height-field rasterizer (`src/lib/pages/page-height-field.ts`)

- Add `rasterizeImage(page, opts, W, H, data, relief)` branch in `buildPageHeightField`:
  - Load the image from `imageDataUrl` via `new Image()` — synchronously decode using a cached `HTMLImageElement` keyed by data URL hash (mirrors how surface art handles uploads).
  - Draw onto an offscreen `W × H` canvas honoring `imageFit` (compute draw rect inside the page rect, fill outside with black).
  - Convert each pixel to luminance `0.299R + 0.587G + 0.114B`, normalize to 0–1, optionally invert.
  - Apply `threshold` cutoff and `pow(intensity, 1/contrast)` gamma.
  - Multiply by `relief` and write to `data` (max-blend so it composites cleanly).
  - Set `hasAny = true` if any pixel exceeds threshold.
- Because image decode is async, `buildPageHeightField` must become async OR we pre-decode into a synchronous bitmap cache. Plan: introduce a tiny module-level `imageBitmapCache: Map<string, ImageBitmap>` and a helper `ensureImageDecoded(dataUrl)` returning a promise. Slab generator stays sync, but `BookPreview` and `book-stl-export` await `ensureBookImagesDecoded(book)` before generating geometry. If a page's image isn't decoded yet, that page renders flat (no relief) and the preview re-renders once decode resolves.

### 3. Slab generator (`page-slab-generator.ts`)

No structural change — it already calls `buildPageHeightField` and `sampleField`. Image relief flows through automatically once the rasterizer branch exists.

### 4. UI (`src/components/pages/PageEditor.tsx`)

- Add `'image'` option to the content-type Select.
- When `page.type === 'image'`:
  - File input button: "Upload image" — accepts PNG/JPG, reads as data URL via `FileReader`, calls `update({ imageDataUrl: ... })`.
  - Thumbnail preview of the uploaded image.
  - Sliders: Threshold (0–1), Contrast (0.5–3), Invert toggle, Fit dropdown (contain/cover/stretch).
  - "Clear image" button.
- Reuses the same Relief-height + Faces controls already at the bottom of PageEditor.

### 5. Preview/export wiring

- `BookPreview.tsx`: in the `useMemo` that builds geometry, first call `ensureBookImagesDecoded(book)` and trigger a re-render (via a `useState` tick) when it resolves. Skip image relief if not yet decoded.
- `book-stl-export.ts`: make `exportBookToSTL` async, await `ensureBookImagesDecoded(book)` before generating geometry, update `downloadBookSTL` accordingly. Index.tsx's STL export branch awaits the result.

## Out of scope

- Multi-image collage per page
- SVG / vector image input (only raster)
- Edge-detect / Sobel mode (text and drawings already give clean line work)
- Color-aware relief — luminance only

## Files touched

- `src/types/pages.ts` — type extensions, defaults
- `src/lib/pages/page-height-field.ts` — `rasterizeImage`, image bitmap cache, `ensureBookImagesDecoded`
- `src/components/pages/PageEditor.tsx` — image upload UI + sliders
- `src/components/pages/BookPreview.tsx` — async decode tick
- `src/lib/pages/book-stl-export.ts` — async export awaiting decode
- `src/pages/Index.tsx` — await async export in the pages-mode export branch (only if currently called sync)
