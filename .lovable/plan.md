## Problem

The Surface Art drawing canvas auto-sizes its pixel width based on the body's circumference-to-height ratio and clamps to a hard range (320–900px). The canvas lives inside the left control sidebar, which is only ~310–340px wide and uses `overflow-hidden`. When the math picks anything larger than the sidebar, the right portion of the canvas is clipped offscreen — that's the "screen not showing the actual full drawing surface" you're seeing. Because Fabric.js still treats the hidden region as drawable, any stroke that crosses into it gets wrapped/clamped at the seam, which is what made it look like half the body wasn't being painted.

## Fix

Stop sizing the canvas in absolute pixels. Instead, measure the container and let it drive the canvas width. Keep the circumference:height aspect ratio so the unwrap silhouette stays accurate.

### Changes in `src/components/drawing/SurfaceCanvas.tsx`

1. Add a wrapper `div` ref around the canvas stack and measure its width with a `ResizeObserver`. Store `containerWidth` in state.
2. Replace the current `autoSize` memo:
   - `width = containerWidth` (fall back to 320 before first measure).
   - `aspect = (2π · rMax) / bodyHeight` from the unwrap profile.
   - `height = clamp(width / aspect, 200, 700)`.
   - Round both to integers.
3. Remove the `MIN_W / MAX_W` clamps — width is now whatever fits.
4. Re-init the Fabric canvas when `width` or `height` changes (already in the deps).
5. Caption stays "Full canvas width = full wrap around the body".

### Why this works

- The drawing surface always equals what the user can see and click.
- The unwrap silhouette outline still reflects the body's true proportions because we only change the *pixel size*, not the UV-to-circumference mapping.
- "Canvas width = 360°" is preserved, so a stroke from left edge to right edge still wraps the whole body.

### Validation

- Open Surface Art with default 120×80mm shape. Confirm the full canvas is visible inside the sidebar with no horizontal scroll/clipping.
- Draw a horizontal line edge-to-edge. Confirm the stroke wraps the entire 3D body (front and back).
- Resize the sidebar / collapse-expand panels and confirm the canvas re-fits without leaving artifacts.
- Existing saved strokes (stored as normalized 0..1 UV) should keep rendering correctly because only pixel dimensions change.

### Files touched

- `src/components/drawing/SurfaceCanvas.tsx`

No changes needed to `stroke-field.ts`, `surface-stroke-generator.ts`, or any baking/export code.
