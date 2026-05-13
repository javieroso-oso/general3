# Drawing canvas: audit + add Raised support

## What works today

- Unwrap silhouette renders correctly with grid lines and height labels.
- Hover position with unwrap compensation is good.
- Pencil brush + symmetry mirror + undo/redo + clear all work.
- After the recent pathOffset fix, strokes land where you draw them.
- After the spiral-vase bake, engraved strokes physically carve the wall.

## What's broken or misleading

1. **Raised is unreachable.** The `Modo` (Mode) dropdown only lists `engraved`. The state `currentEffect` exists, `EFFECT_COLORS` defines all 5, but the `<SelectContent>` has only the one item. Then `extractStrokes()` hardcodes `effect: 'engraved'` anyway, ignoring whatever `currentEffect` is.
2. **Texture pattern dropdown is dead code.** It only renders when `currentEffect === 'texture'`, but you can't pick texture.
3. **Mixed ES / EN labels** — "Modo / Grabado / Trazo / dibuja dentro de la forma" beside English "Depth / Brush / Opacity / Symmetry / Clear". Pick one.
4. **Brush opacity does nothing useful.** It modulates the on-canvas stroke color alpha but never maps to per-point depth. Visually misleading — strokes look "lighter" but print at full depth.
5. **Per-stroke depth/thickness is locked to whatever the slider was at the moment of drawing.** No way to retune a stroke after the fact (only delete it).
6. **Stroke list shows effect but not depth/thickness.** No edit affordance.
7. **No print-safety hint.** If you set engraved depth ≥ wallThickness, the bake clamps silently — the user has no idea their 6mm engrave on a 1.6mm wall got squashed to 1.2mm.
8. **Brush thickness in mm is hidden.** Slider says "4 px" but the actual stroke geometry uses `brushWidth * 0.5` mm. Confusing.

## Plan

### 1. Wire up the Mode dropdown for Raised + Engraved

Cut to the two effects we actually support after the spiral-vase bake:

- `engraved` — wall pulled inward (orange swatch)
- `raised` — wall pushed outward (blue swatch)

Drop `cut`, `ribbon`, `texture` from the Mode picker entirely (they were unreachable / not vase-printable). The types stay so existing saved strokes don't break, but the UI only offers the two that work.

`extractStrokes()` now reads `currentEffect` instead of hardcoding `'engraved'`.

### 2. Per-stroke editing in the stroke list

Replace the read-only list rows with editable rows:

```text
[●] Stroke 1   [Engraved ▾]   Depth ▭▭▭▭▭ 2.0mm   Thick ▭▭ 2mm   [×]
[●] Stroke 2   [Raised   ▾]   Depth ▭▭ 0.8mm      Thick ▭ 1mm    [×]
```

Each control writes back to that stroke's `effect` / `depth` / `thickness` and triggers `onChange`. The bake recomputes automatically (cache invalidates on stroke fingerprint change).

### 3. Clearer brush controls

- Rename "Brush 4px" → "Thickness 2.0mm" (show real mm).
- Slider range: 0.5–6mm in 0.5mm steps. Internally still drives `freeDrawingBrush.width` for visual feedback (mm × ~3 px).
- Drop the Opacity slider — replace with a small "Hold Shift to draw straight line" hint (keeps the toolbar lean and removes the misleading control).

### 4. Print-safety badge per stroke

Compute on render: 
- engraved depth > `wallThickness − 0.4` → red badge "clamped to Xmm"
- raised depth > 1.2 → red badge "clamped to 1.2mm"

Tooltip explains why. This matches the clamps in `stroke-field.ts` so the UI tells the truth.

### 5. Localization cleanup

Pick **English** consistently (it's what the app's other panels use). Update labels in `SurfaceCanvas.tsx`:
- "Modo" → "Mode"
- "Grabado" → "Engraved"
- new: "Raised"
- "Trazo" → "Stroke"
- "dibuja dentro de la forma" → "Draw inside the silhouette"
- The shape-explainer subtitle → "Drawing maps proportionally to the body's surface."

### 6. Live in-canvas effect indication

Make the brush color follow `currentEffect` (it already does for engraved-orange, just enable it for raised-blue). So while you draw, the on-canvas line shows whether you're engraving (orange) or raising (blue).

## Out of scope on purpose

- Re-introducing ribbon/texture: they don't print as a vase mode wall, so the current "drop them" decision stands.
- Variable per-point depth driven by drawing pressure: nice but a bigger change. Note for later.
- Boolean image-stamp / icon stamps: separate feature.

## Files touched

- `src/components/drawing/SurfaceCanvas.tsx` — Mode dropdown (engraved + raised), `extractStrokes` honours `currentEffect`, brush color follows effect, mm-based thickness slider, drop opacity, English labels, editable stroke-list rows with safety badge.

No changes needed to:
- `src/lib/stroke-field.ts` — already handles engraved + raised correctly
- `src/lib/surface-stroke-generator.ts` — only used for ribbon/texture floating preview now
- `src/lib/body-profile-generator.ts` — already wired up

## After this

You'll be able to draw any combination of engraved + raised strokes, see them in the right color while drawing, retune any stroke later, and get a clear warning when a depth was clamped for printability — all printing correctly through the spiral-vase G-code.
