## Plan

1. **Unify stroke UV mapping**
   - Update the baked export stroke field to use the same unwrap compensation as the 3D preview (`canvasUToRealU` / width fraction per height).
   - This should prevent strokes from being rasterized into the wrong/lower-resolution surface area during STL and spiral-vase export.

2. **Increase adaptive stroke field resolution**
   - Replace the fixed 256×128 stroke bake grid with an adaptive high-resolution grid when drawings exist.
   - Keep resolution bounded for performance, but make it scale with object circumference/height so strokes do not become blocky on taller or wider shapes.

3. **Match mesh/G-code sampling to stroke detail**
   - Raise STL angular sampling for baked drawings beyond the current 256 segments where needed.
   - Raise spiral-vase G-code points-per-revolution similarly so printed raised/engraved drawings are not faceted.
   - Keep non-drawing exports unchanged.

4. **Improve captured drawing paths**
   - Extract more points from Fabric quadratic path commands instead of storing only command endpoints.
   - This preserves curved hand-drawn strokes before they enter the 3D/export pipeline.

5. **Validate**
   - Run a targeted check of the updated stroke bake/export logic and inspect the affected code paths for preview/export parity.