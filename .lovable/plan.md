# Rebuild the book spine so it actually prints

The current spine is a paper-thin ridge with decorative torus "stitch loops" sitting on top. On a real printer that ridge is a single unsupported wall — the pages meet it on a knife edge and the loops are floating rings that would print as spaghetti. The book has nothing holding it together.

## What the new spine is

A continuous solid spine bar that runs the full width of the book, printed flat on the bed as the first thing that comes off the printer, with every page rooted into it.

```text
   page  page  page  page  page        <- printed upward, thin walls
    |     |     |     |     |
  __|_____|_____|_____|_____|__
 |=============================|       <- spine slab, full width, on the bed
   ^ fillet where each page meets spine
```

Key properties:
- **Full width, full length**: the spine spans the entire page stack plus end margins, and runs the full page width (the book's depth direction), so it is a real base — a wide, stable first layer instead of a line.
- **Real thickness**: spine wall thickness becomes its own control (default ~1.6 mm, several perimeters), independent of the thin page walls. Pages stay single-perimeter thin; the spine is the one solid part.
- **Pages rooted, not butted**: each page enters the spine body and is joined with a small flared fillet at the junction, so the bond is a wedge of material rather than a butt joint. Page feet stop curving sideways — they go straight down into the spine.
- **Raised end walls**: a low rail at each end of the spine (across the page width) ties the first and last page in and stiffens the whole binding, acting like a book's board edges.
- **Stitch loops removed**: they are unprintable and add nothing structural. If you want the stitched look later it should be relief pressed into the spine surface, not floating rings.

## Covers (worth adding)

Yes — covers make the binding better, not just prettier. They replace the end rails with something structural: two full-size panels, one at each end of the stack, printed in the same pass and rooted into the spine exactly like the pages, but thicker (default ~1.2 mm, a few perimeters). They brace the first and last page, stop the stack from splaying, and give the spine two stiff walls at its ends.

- Front and back cover panels, same width/height as pages, own thickness control.
- Covers can carry relief content too (title text, drawing, image) using the existing page editor — the front cover is just a page with a different thickness.
- Optional slight overhang: covers extend 1–2 mm beyond page height/width so they protect the page edges, like a real hardback.
- With covers on, the spine's end margin grows to seat them, and the end rails become unnecessary (kept as an option for coverless books).

## Controls added to the Pages panel

- **Spine thickness** (0.8–4 mm) — wall solidity of the binding.
- **Spine height** (existing, retuned) — how tall the spine block is before pages begin.
- **Covers** on/off, with cover thickness and overhang sliders, plus front/back content editors.
- **End rails** on/off with a height slider (for coverless books).


Slicer note in the panel updates: spine prints solid, pages print as single walls — so the recommended profile becomes 1 wall / 0 infill with the spine's extra thickness carrying the strength.

## Technical detail

- `src/lib/pages/book-generator.ts`: replace the thin ridge box + torus loop loop with a spine slab sized `totalSpineX × spineHeight × spineDepth`, where `spineDepth` is derived from `book.pageWidth` (full page width plus a small margin) rather than page thickness. Add two end-rail boxes. Add per-page fillet geometry (a short tapered box or lofted quad strip) at each page root.
- `src/lib/pages/page-slab-generator.ts`: keep `footMm` but drive it as a vertical flare (thickness ramp near y=0) instead of a lateral Z curve; add an optional `footFlareMm` so the page base widens into the spine.
- `src/types/pages.ts`: add `spineWallThickness`, `endRails`, `endRailHeight` to `BookParams` and defaults; keep existing fields for backward compatibility with saved books.
- `src/components/pages/BookControls.tsx`: add the new sliders/toggle and update the slicer hint text.
- Every merged part keeps matching attributes (position + normal, indexed, no uv) so `mergeGeometries` doesn't return null.
- `src/lib/pages/book-stl-export.ts` needs no change — the -PI/2 X rotation still puts the spine flat on Z=0.
