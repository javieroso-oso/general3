## Problem

The unwrap silhouette currently acts as a *clipping* shape: anything drawn outside it is visually shaded out, and `canvasUToRealU` re-stretches the silhouette's local width to a full 0..1 around the body. With the new auto-sized canvas, the silhouette often occupies only a fraction of the canvas width, so:

- Strokes drawn outside the silhouette get clamped to U=0 or U=1 and pile up on a single seam.
- The user perceives the canvas as "only accepting strokes on half of the shape", because the dark area visually disqualifies the rest of the canvas.

The whole canvas should always represent the full 0°–360° circumference, with the silhouette shown as a *guide* only.

## Plan

1. **Treat the entire canvas as the full circumference**
   - In `SurfaceCanvas.tsx`, drop the unwrap compensation when capturing strokes: store `u = transformed.x / width` directly (no `canvasUToRealU`). Same for the hover handler.
   - In `surface-stroke-generator.ts` (`applyStrokeTransforms`), remove the `canvasUToRealU` step and use the canvas-space U directly. Keep the `((u % 1) + 1) % 1` wrap so global U offset still rotates around the body.
   - In `stroke-field.ts` (`bake`), do the same: stop calling `canvasUToRealU` / `interpolateWidthFraction` on stroke points. The stored U is already real circumference U.

2. **Demote the silhouette to a visual guide**
   - Stop filling the area outside the silhouette with the dark shaded overlay.
   - Keep the silhouette outline (white stroke) so the user still sees the body's real proportions, plus the existing height markers and vertical guide lines.
   - Add a subtle hint that the full canvas width = 0°–360°.

3. **Keep the canvas auto-sized to circumference:height**
   - The previous resize change is correct in principle (canvas aspect = `2π · r_max : H`), so a stroke spanning the full canvas width corresponds to a full wrap around the widest part of the body. No change to that logic.

4. **Validate**
   - Draw a horizontal line across the full canvas width and confirm it wraps fully around the 3D body (meets back at the seam).
   - Draw a stroke entirely outside the old silhouette; it should still appear on the 3D body at the correct angle.
   - Confirm previously-saved drawings still render correctly (stored UV stays normalised 0..1).

## Technical notes

- This is a pure presentation/mapping change. No DB or business-logic changes.
- One subtle migration concern: any strokes saved while the silhouette-clipping logic was active have their U already collapsed to the silhouette range. They will still load and draw, just slightly compressed horizontally on shapes with strong taper. Acceptable trade-off for fixing the active drawing experience.
- Files touched: `src/components/drawing/SurfaceCanvas.tsx`, `src/lib/surface-stroke-generator.ts`, `src/lib/stroke-field.ts`.
