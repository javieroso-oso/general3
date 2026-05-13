## Problem

The surface drawing canvas is hard-coded to 400×300 px in `SurfaceCanvas.tsx`, regardless of the shape it is supposed to wrap. The unwrap silhouette is then squeezed into that fixed box, so:

- For tall/narrow shapes the silhouette is short and stubby, and strokes get crammed into a tiny pixel area before being baked back onto a much larger 3D circumference.
- For wide/short shapes the silhouette runs out of horizontal room and the wrap looks like it does not cover the full 360°.
- Either way, the canvas pixel density per real millimetre of surface is wrong, which is the visual "the drawing doesn't fully wrap the shape" symptom.

## Plan

1. **Size the canvas from the shape's real proportions**
   - In `SurfaceCanvas.tsx`, compute the body's max circumference `C_max = 2π · r_max` and total height `H` from `params` / `unwrapProfile`.
   - Pick canvas dimensions whose aspect ratio matches `C_max : H` so the silhouette naturally fills the canvas width at the widest height and uses the full vertical space.
   - Clamp to a sensible pixel range (e.g. min 320, max ~900 wide; min 240, max ~700 tall) so the panel still fits the sidebar.

2. **Make width/height reactive to the shape**
   - Replace the fixed `CANVAS_W = 400 / CANVAS_H = 300` defaults with values derived from `params` via `useMemo`.
   - Re-init Fabric and the overlay canvas when those dimensions change (the existing init effect already depends on `width`/`height`).
   - Keep the optional `width` / `height` props as overrides so any caller passing explicit sizes keeps working.

3. **Keep stroke data shape-agnostic**
   - Strokes are stored in normalised UV (`u`, `v` ∈ 0..1) and unwrap compensation already runs through `canvasUToRealU` + `interpolateWidthFraction`, so resizing the canvas does not invalidate existing drawings.
   - No changes needed to `stroke-field.ts`, `body-profile-generator.ts`, or `stl-export.ts`.

4. **Validate**
   - Visually check tall/narrow and short/wide shapes: silhouette should hug the canvas edges, strokes drawn at the far left/right should map to ~0° / ~360° on the 3D body, and the export should look the same as the preview.

## Technical notes

- `getUnwrapProfile(params)` already gives `r(t)` and `widthFraction = r(t) / r_max`. Use the max radius from there (or `getMaxBodyRadius`) plus `params.height` for the aspect ratio.
- Aspect target: `aspect = (2π · r_max) / H`. Then e.g. `width = clamp(round(H_px · aspect), 320, 900)` with `H_px` chosen from a base height (e.g. 360 px) and clamped.
- No business-logic changes — purely a presentation/sizing fix in `SurfaceCanvas.tsx`.
