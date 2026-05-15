## Goal

Make the book truly printable as a single thin-walled object with a **continuous** solid spine running the full length, and pages that are single-perimeter walls (~0.42 mm) standing up from it. Letters/drawings remain raised relief on those walls.

## Changes

### 1. Continuous spine (book-generator.ts)

Today the spine is a `BoxGeometry` and pages sit on top of it as separate slabs that interrupt the visual line. Switch to:

- One **solid bar** spanning the full book length, running uninterrupted from end to end.
- Pages **embedded into** the spine (their bottom edge sinks ~0.6–1.0 mm into the bar) so the spine reads as one continuous element and slicer fuses them as a single contour at every layer near the bed.
- Spine cross-section: thickness = `pageThickness + 2 × maxRelief` (so it's at least as wide as the widest page+relief), height = `spineExtra` (user-controlled).
- End caps: spine extends past the first/last page by `spinePadX` so it doesn't end flush with a page edge.

### 2. Single-wall page slabs (page-slab-generator.ts)

Replace the two-sided displaced grid (front face + back face + rim) with **one mid-surface sheet** that is exactly `pageThickness` thick everywhere — no relief displacement of the wall itself. Relief becomes **bumps grown outward from one (or both) faces**:

- Build the page as a thin extruded rectangle: a flat sheet at `z = 0` extruded to `±pageThickness/2`. With `pageThickness` defaulting to **0.42 mm** (one nozzle), this prints as a single perimeter — the slicer will lay one continuous wall per layer. No infill, no top/bottom layers needed in the slab itself.
- For relief: where the height field > 0, locally thicken the wall outward on the chosen face(s). Implementation: keep the displaced-grid approach but cap relief to add **on top of** the base wall rather than replacing it, so the wall is never thinner than `pageThickness` anywhere.

### 3. New defaults & controls (types/pages.ts, BookControls.tsx)

- `pageThickness` default → **0.42 mm**, slider range **0.4–1.6 mm** (was 0.6–3).
- New "Wall thickness" label in UI (rename from "Page thickness") to make intent clear.
- `spineThickness` becomes derived (auto from page thickness + relief) — remove from UI to reduce confusion. Keep `spineExtra` (height above bed) and `pageGap`.
- Add a small info hint: "Pages print as single perimeters — set slicer to 0 top/bottom layers, 0% infill, 1 wall."

### 4. Print orientation (book-stl-export.ts)

Unchanged — already rotates so spine sits flat on the bed and pages stand vertically. Confirm the normalization still produces `min Z = 0` after the new geometry.

### 5. Validation

- Read the slab + spine merge once with the new defaults to make sure `mergeGeometries` still succeeds (all parts position+normal indexed, matching attribute set).
- Visual check in BookPreview: spine should look like one continuous bar with pages slotted into it.

## Out of scope

- Spiral / vase mode G-code path generation (the geometry is the printable artifact; slicer settings live in user's slicer).
- Curved/round spine rod variant.
- Page rounding, hinges, or actual page-turning physics.

## Files touched

- `src/lib/pages/book-generator.ts` — continuous spine, embedded pages
- `src/lib/pages/page-slab-generator.ts` — guarantee minimum wall thickness, relief always additive outward
- `src/types/pages.ts` — new defaults (0.42 mm pages)
- `src/components/pages/BookControls.tsx` — relabel, drop spineThickness slider, add print-settings hint
