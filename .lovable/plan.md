

# Exploded View + New Plotter Projection Settings

## The Exploded/Dissected View

A new projection type called **"Exploded View"** that splits the object into horizontal bands and draws them separated vertically (and optionally laterally), like a technical illustration or assembly diagram. Each band is a cross-section slice range rendered as a mini-contour, spaced apart with configurable gap and optional lateral offset for a staggered look.

### How it works
- Divide the shape into N bands (reuse `sliceCount`)
- Each band is a group of 3-4 closely-spaced cross-section contours
- Bands are drawn with vertical gaps between them (`explodeSpread`)
- Optional lateral stagger: alternating bands shift left/right (`explodeStagger`)
- Optional connecting lines between bands (dashed "assembly lines")
- Each band gets its own layer index for multi-pen coloring

## Additional New Settings

Beyond exploded view, add these universally useful projection controls:

| Setting | Type | Range | What it does |
|---------|------|-------|-------------|
| `explodeSpread` | number | 0–50mm | Vertical gap between bands in exploded view |
| `explodeStagger` | number | 0–30mm | Lateral offset alternating per band |
| `explodeConnectors` | boolean | — | Draw dashed connector lines between bands |
| `lineWeight` | number | 0.1–2.0 | Override stroke weight hint per projection |
| `mirrorX` | boolean | — | Mirror the drawing horizontally |
| `mirrorY` | boolean | — | Mirror the drawing vertically |
| `repeatGrid` | number | 1–4 | Tile the projection in a grid (1=off, 2=2x2, etc.) |

## File Changes

### 1. `src/types/plotter.ts`
- Add `'exploded'` to `ProjectionType`
- Add `explodeSpread`, `explodeStagger`, `explodeConnectors`, `mirrorX`, `mirrorY`, `repeatGrid` to `ProjectionParams`
- Add defaults

### 2. `src/lib/plotter/projection.ts`
- Add `generateExplodedView()` function:
  - Split object into bands using `sliceCount`
  - For each band, generate 3 closely-spaced cross-section contours
  - Position bands with vertical spread gap
  - Apply lateral stagger
  - Optionally draw dashed connector lines between band centers
- Update `generateProjection()` to route `'exploded'` type
- Add post-processing for `mirrorX`/`mirrorY` (flip coordinates)
- Add `repeatGrid` tiling logic (duplicate and offset all paths)

### 3. `src/components/plotter/PlotterControls.tsx`
- Add "Exploded View" to projection type selector
- Show explode-specific controls when `type === 'exploded'`: spread slider, stagger slider, connectors toggle
- Add "Transform" section to projection accordion: mirror X/Y toggles, repeat grid selector
- Add stroke weight override slider (visible for all projection types)

### 4. `src/components/plotter/PlotterPreview.tsx`
- No changes needed — existing rendering handles any paths/layers

