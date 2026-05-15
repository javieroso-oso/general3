# Pages Mode — Printable Books & Planar Drawing Stacks

A new mode that produces a stack of flat "pages" joined at a spine, with raised relief (text or freehand drawings) on each page face. Same logic as surface art, but the surface is a flat plane instead of a curved body. Print orientation matches the Instagram reference: spine flat on the bed, pages standing vertical, layers going up along the page height — so every page prints in one continuous Z sweep with content already embedded as wall thickness variations.

## What it produces

- A spine bar (rectangular bead) with N pages attached perpendicular to it.
- Each page = a thin slab (default ~0.8–1.2 mm), with raised glyphs/strokes (default ~0.4 mm) on one or both faces.
- Optional front/back covers (thicker pages with their own art).
- STL is exported pre-oriented so the spine sits on Z=0 and pages rise in +Z — directly slicer-ready, no manual reorientation.

## How it fits the project

- New top-level mode alongside Shape and Plotter: **Pages** (object type tab).
- Reuses surface-art philosophy: a 2D height field per page, sampled into a triangulated slab. No new printing tech — standard FDM, same support-free constraints (raised relief on a vertical wall is overhang-free by definition).
- Honors the existing Electric Pop UI, drawer batch export (each book = one item), and the print-validation pipeline.

## User flow

1. Pick **Pages** from the object type tabs.
2. Set book parameters: page count, page size (W × H), page thickness, spine thickness, gap between pages, relief height.
3. For each page, choose content type:
   - **Text** — type a string, pick font (bundled subset), size, alignment. Rasterized to a height field.
   - **Drawing** — freehand canvas (reuse `SurfaceCanvas` styling) at page aspect ratio.
   - **Image** — upload, Sobel/threshold to relief (reuse `ImageToSurfaceStrokes` pipeline).
4. Live 3D preview shows the assembled book. Per-page thumbnails in a side strip; click to edit.
5. Export STL — pre-oriented, watertight, single solid.

## Technical notes (for implementer)

**New files**
- `src/types/pages.ts` — `BookConfig`, `PageContent` (`{ type: 'text'|'drawing'|'image', payload, reliefHeight, faces: 'front'|'back'|'both' }`).
- `src/lib/pages/page-height-field.ts` — given a `PageContent`, returns `(u,v) → height` over [0,1]². Text uses canvas 2D `fillText` rasterized to a Float32 grid; drawing reuses the stroke SDF from `base-stroke-field.ts`; image reuses Sobel pipeline.
- `src/lib/pages/page-slab-generator.ts` — builds one watertight `BufferGeometry` for a single page: dense grid on front face displaced by +height field, dense grid on back face displaced by −height field (or flat if single-sided), rim walls connecting them. Mirrors the watertight pattern from `base-floor-generator.ts`.
- `src/lib/pages/book-generator.ts` — composes spine bar + N page slabs at correct offsets, merges via `mergeGeometries`, applies the standard STL normalization (rotate −π/2 X, translate min Z to 0) so spine lands on bed.
- `src/components/pages/BookPreview.tsx` — R3F mesh.
- `src/components/pages/BookControls.tsx` — book params + page list.
- `src/components/pages/PageEditor.tsx` — per-page editor (tabs: Text / Drawing / Image), reusing `SurfaceCanvas` for drawing.

**Edits**
- `src/components/controls/ObjectTypeTabs.tsx` — add Pages tab.
- `src/lib/stl-export.ts` — branch on mode = 'pages' to call `book-generator.ts`.
- `src/lib/batch-export.ts` — treat a book as one item.
- App-level mode router (wherever Shape/Plotter switch lives) — add Pages route.

**Print-orientation guarantee**
`book-generator.ts` returns geometry already in the spine-down frame (spine along X at Z=0, pages rising in +Z, page faces parallel to YZ). Re-uses the existing STL normalization pass for safety.

**Defaults** (printable on a 0.4 nozzle):
- Page thickness 1.0 mm, relief height 0.4 mm, spine thickness 3 mm, page gap 1.2 mm, page size 60×90 mm, default 8 pages.

## Out of scope (this pass)

- Multi-color / AMS / per-letter color.
- True bound-book hinges (pages are rigid in this version — like a sculptural book, not a flippable one).
- Curved/folded pages.
- Importing PDF or multi-page documents (single string per page only — bulk import can come later).

## Open question (will ask after plan approval if needed)

Whether to default text relief to **both faces mirrored** (looks like ink bleeding through) or **front only** (cleaner, faster prints). I'll start with single-side and expose a per-page toggle.
