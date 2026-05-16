## Goal

Make the spine read as a real saddle-stitched binding: a thin folded crease running along the bound edge of the pages, with visible stitch loops — not a solid block. Spine still prints flat on the bed.

## What changes

Only `src/lib/pages/book-generator.ts` and a couple of param defaults. No UI changes required (existing `spineExtra` slider repurposes cleanly as "spine height", `spineThickness` stays derived).

### New spine anatomy (replaces the single `BoxGeometry` bar)

1. **Fold ridge** — one continuous thin wall along X, single-perimeter thick (`= pageThickness`, ~0.42 mm), height = `spineExtra`. This is the "fold line" all pages share. Basically a tall thin fin sitting on the bed.

2. **Page feet that curve into the fold** — each page slab gets a short curved "foot" (bottom ~1.5 mm of its height) that bends inward toward x = page-center-line so its bottom edge lands ON the fold ridge instead of beside it. Adjacent pages meeting the same ridge from alternating offsets reads as nested folded signatures.
   - Implementation: in `page-slab-generator.ts`, when `j` is in the bottom foot band, offset vertex z toward 0 by a smoothstep curve. Foot height and curve amount are constants (`FOOT_MM = 1.5`, `FOOT_CURVE = pageT * 0.5`).
   - Optional: alternate the bend direction per page index so pages tent outward in a saddle pattern.

3. **Stitch loops** — small torus-like loops straddling the fold ridge at regular intervals along X (every ~`max(8, totalSpineX / 6)` mm). Each loop is a thin torus segment (`TorusGeometry`, tubeRadius ~0.4 mm, radius ~`spineExtra * 0.35`) rotated to wrap perpendicular to the fold. They visibly suggest thread without being functional holes.
   - Stitch loops can be toggled off later via a param; for now always on.

4. **Remove the wide BoxGeometry spine and `spineZ = pageT + 2*(maxRelief + 0.6)` padding.** The fold is now visually thin; relief no longer needs to be wrapped by the spine.

### Embed math

Pages no longer "sink" into a thick bar. Instead each page's foot meets the fold ridge at y = 0 with a 0.2 mm overlap so the slicer fuses them. `EMBED_DEPTH_MM` becomes `FOOT_OVERLAP = 0.2`.

### Param tweaks (`src/types/pages.ts`)

- `spineExtra` default stays 3.0 mm; relabel via `BookControls.tsx` only if the meaning shifts (here it's still "spine height", so leave the label).
- `spineThickness` derived = `pageThickness` (single wall). No UI.

### Printability notes (kept in `BookControls.tsx` hint, lightly reworded)

"Saddle-stitched fold prints as a single-wall ridge. Slicer: 1 wall, 0% infill, 0 top/bottom layers, spine flat on bed."

## Technical details

```text
Side view (looking down +X), one page:

      page body (vertical wall)
         |
         |
         |
          \           <- foot bend (1.5mm), z curves to 0
           \
   ─────────●─────────  <- fold ridge (thin fin along X), bed = y=0
            ↑
       page lands on ridge with 0.2mm overlap
```

```text
Top view (looking down -Y), several pages on the fold:

  ─────────────────────────  fold ridge (continuous, thin)
   ║   ║   ║   ║   ║   ║    page slabs perpendicular
        ⌒       ⌒       ⌒   stitch loops straddling ridge every ~N mm
```

## Files touched

- `src/lib/pages/book-generator.ts` — new fold ridge + stitch loops, drop the wide spine bar.
- `src/lib/pages/page-slab-generator.ts` — add `footMm` / `footCurve` params, curve bottom band of vertices toward z=0.
- `src/types/pages.ts` — no schema change; `spineThickness` becomes effectively unused but kept for back-compat.

## Out of scope

- Actual through-holes for real thread (would require CSG).
- Curved/rounded hardcover back (different option you rejected).
- Cover wrap.

## Validation

After implementing, regenerate the preview with the default 2-page book and confirm: (1) no thick block under the pages, (2) visible thin fin connecting all pages along their bottom, (3) small loop bumps along that fin, (4) STL export bounding box Z-min = 0 still holds.