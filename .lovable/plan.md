## Why the export looks pixelated

The drawings get baked into a 256×128 (theta, t) → Δr field, but the export geometry samples that field at much lower resolution than the preview:

- **STL export** (`generateFullBody` / `generateWallMountBody` in `src/lib/stl-export.ts`): hardcoded `segments = 64` (angular) and `heightSegments = ceil(height / 2)`. With a 256-cell angular bake, every stroke is averaged across ~4 cells per facet — that's the faceted/blocky look you see in the exported STL.
- **Spiral vase G-code** (`generateSpiralVaseLayers`): hardcoded `segments = 64` points per revolution. Drawings show up as low-poly polygons on each layer.
- **Preview mesh** (`ParametricMesh.tsx`): already auto-bumps to 256/600 segments when strokes are present, which is why the preview looks great.

In short: the bake is high-res, the preview is high-res, but export was never told to follow suit.

## Fix

Promote the export sampling to match the bake whenever surface strokes exist. No geometry math changes — just denser sampling of the existing `getBodyRadius` / `getRadiusAtHeight` calls.

### `src/lib/stl-export.ts` — STL body

In `generateBodyMesh` (around line 240), replace the hardcoded constants with a stroke-aware density:

```ts
const hasStrokes = (params.surfaceStrokes ?? []).some(
  s => s.effect === 'engraved' || s.effect === 'raised' || s.effect === 'cut'
);
const segments = hasStrokes ? 256 : 64;
const heightSegments = hasStrokes
  ? Math.max(Math.ceil(height / 0.4), 300)   // ~0.4 mm per ring, capped sensibly
  : Math.ceil(height / 2);
```

This matches the bake's angular resolution exactly, and gives the height axis ~2× the bake density so strokes drawn as thin horizontal lines remain crisp.

Optional safety: cap at e.g. `Math.min(heightSegments, 800)` so very tall vases don't explode triangle count.

### `src/lib/stl-export.ts` — spiral vase G-code

In `generateSpiralVaseLayers` (line 1393), do the same bump for `segments`:

```ts
const hasStrokes = (params.surfaceStrokes ?? []).some(
  s => s.effect === 'engraved' || s.effect === 'raised' || s.effect === 'cut'
);
const segments = hasStrokes ? 256 : 64;
```

`totalLayers` is already driven by `layerHeight`, so vertical resolution is fine — only the per-revolution point count needs the bump.

### Nothing else changes

- Bake (`stroke-field.ts`) stays at 256×128 — it's already the bottleneck-free piece.
- Preview (`ParametricMesh.tsx`) already adapts.
- No UI changes, no parameter changes, no behavior change for shapes without drawings (existing meshes export at the exact same resolution as before).

## Expected result

Exported STLs and spiral G-code will reproduce strokes with the same fidelity you see in the live preview — smooth curves instead of 64-sided polygons, fine details from the brush no longer collapsed into single facets.