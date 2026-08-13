# Fix: books don't render in Pages mode

## What's happening

Switching to the Pages tab shows the controls panel and the floor grid, but no book — the 3D view is empty. Verified in the browser at both desktop and mobile widths.

The cause is in the book geometry assembly. The book is merged from three kinds of parts, and their vertex attributes don't match:

- Spine ridge box: position + normal + index
- Page slabs: position + normal + index
- Stitch loops (torus): position + index only (both `normal` and `uv` are deleted)

Three.js `mergeGeometries` requires every input to carry the exact same attribute set. With the loops missing `normal`, the merge returns `null`, the preview component renders nothing, and STL export returns nothing too.

## The fix

In the book generator, stop deleting the `normal` attribute from the stitch loops — delete only `uv`, matching the ridge box and slabs. Normals get recomputed after the merge anyway.

Add a guard so a future mismatch is visible instead of silent: if the merge returns null, log which part index caused it rather than quietly rendering an empty scene.

## Verification

- Reload Pages mode and confirm the book (spine ridge, page slabs, stitch loops) is visible and framed by the camera.
- Add a page and change page width/height, confirm the mesh updates.
- Export STL and confirm a non-empty file is produced.

## Files

- `src/lib/pages/book-generator.ts` — attribute fix + merge guard
- `src/components/pages/BookPreview.tsx` — only if camera framing needs adjusting after the mesh appears
