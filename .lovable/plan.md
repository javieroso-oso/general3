# Fix: Surface drawings land in wrong place (pushed to lower base)

## What's actually wrong

In `src/components/drawing/SurfaceCanvas.tsx`, `extractStrokes()` reads each Fabric `Path` point and multiplies by `obj.calcTransformMatrix()` to get its absolute canvas position.

Fabric `Path` stores its raw `pathData` in path-local space, then renders with a `pathOffset` (the bbox center of the path) subtracted at draw time. `calcTransformMatrix()` does **not** include that offset.

So today:
```
absolute = matrix * pathLocal             ← wrong (what we do)
absolute = matrix * (pathLocal - pathOffset)  ← correct (what Fabric actually renders)
```

The result: every stroke is captured shifted by `(pathOffset.x, pathOffset.y)`. For freehand strokes drawn anywhere on the canvas, the bbox center is roughly in the middle of the stroke, so all points get pulled diagonally — typically downward and to one side. That matches exactly the "drawing falls onto the lower base / off the silhouette" symptom.

This also explains why straight lines drawn near the top still appear correctly proportioned but **anchored too low** on the 3D body.

## The fix (one file)

`src/components/drawing/SurfaceCanvas.tsx` — `extractStrokes()` only:

1. Read `obj.pathOffset` once per path (Fabric exposes it as `{x, y}`).
2. Subtract it from `px, py` *before* multiplying by the matrix:
   ```ts
   const lx = px - (obj.pathOffset?.x ?? 0);
   const ly = py - (obj.pathOffset?.y ?? 0);
   const transformed = {
     x: matrix[0] * lx + matrix[2] * ly + matrix[4],
     y: matrix[1] * lx + matrix[3] * ly + matrix[5],
   };
   ```
3. Then the existing `u = x/width`, `v = 1 - y/height` mapping works correctly.

That's the whole fix for the placement bug.

## Sanity-check pass while we're in there

Two small follow-ups to harden things, only if you want them in the same change:

- **Symmetry mirror also needs pathOffset awareness** — `mirrorPath()` rebuilds a new Path from mirrored raw commands; the new Path will compute its own pathOffset, so the mirror is already self-consistent. No change needed, just confirming.
- **Re-extract after undo/redo** — already done, will benefit automatically from the fix.

## What it should look like after

- Draw a small circle near the top of the unwrap silhouette → it appears near the **rim** of the 3D body, not on the base.
- Draw a horizontal line across the middle → it wraps around the body's belly, not the foot.
- Strokes near the edge of the silhouette stay inside the silhouette in 3D instead of clipping off.

## Files touched

- `src/components/drawing/SurfaceCanvas.tsx` — `extractStrokes()` only (~3 lines changed).

No changes to `surface-stroke-generator.ts`, `surface-unwrap.ts`, or the 3D mesh.
