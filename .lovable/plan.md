# How drawings interact with Spiral Vase printing — and why today they don't

## The short answer

**In spiral vase mode today, your drawings are not printed at all.** They show up in the 3D preview as separate floating ribbon/groove meshes, but the spiral toolpath never sees them. The printer just extrudes a smooth helix around the bare body shape.

Here's why, and what we'd need to do to make it real.

## What spiral vase actually is

A spiral vase print is **one continuous extrusion**:

```text
          ↑ Z climbs continuously
       __/
      /
     /   ← single-wall perimeter, ~0.4mm thick
    /
   /__   ← one ring per revolution, no top, no bottom, no infill
```

The nozzle never lifts, never retracts, just spirals up. Each revolution is ~one layer-height taller than the one below. The toolpath at every point is determined by exactly two things:

- `θ` (angle around the axis)
- `z` (height)

…fed into a single function `getRadiusAtHeight(t, theta)` that returns how far out the nozzle should be. That's it. There is no "second pass" to add detail later.

## What that means for surface drawings

For a stroke to physically exist on a spiral-vase print, the spiral itself has to **detour inward or outward at the right θ and z**. Three cases:

| Effect today | What it'd need in spiral mode | Possible? |
|---|---|---|
| **Engraved / cut** | Spiral pulls slightly *inward* (smaller radius) where the stroke passes | Yes — perimeter dips |
| **Raised** | Spiral pushes slightly *outward* (larger radius) where the stroke passes | Yes — perimeter bumps |
| **Ribbon (floating tube)** | Would need a separate wall + travel moves | **No** — breaks vase mode |
| **Texture (dots, cones, crosshatch)** | Same — needs detached extrusions | **No** — breaks vase mode |

So in spiral mode only **engraved** and **raised** can ever survive. Ribbon and texture are inherently incompatible with single-wall continuous extrusion — they'd require the nozzle to lift, travel, and re-extrude, which is exactly what spiral mode forbids.

## Where the bug lives in the codebase

```text
SurfaceCanvas → params.surfaceStrokes  (the user's UV polylines)
         │
         ├── PREVIEW: generateSurfaceStrokeGeometries() → separate THREE.BufferGeometry
         │   shown as floating ribbons in ParametricMesh   ✓ visible
         │
         └── PRINT: ......... (nothing) ............      ✗ not connected
                              │
                              ▼
                    getBodyRadius(t, θ)   ← never sees strokes
                              │
                              ▼
                    generateSpiralVaseLayers()
                              │
                              ▼
                       smooth helix ✗
```

`src/lib/body-profile-generator.ts` has zero references to `surfaceStrokes`. `src/lib/stl-export.ts` builds the spiral toolpath purely from `getRadiusAtHeight()`, which only knows about profile curves, twist, rim waves, organic deformations, etc. The strokes live in their own world.

## What it would take to make drawings actually print

The fix is a single new concept: a **radial-offset field** `Δr(θ, t)` that summarises all engraved/raised strokes as "how much should the wall move in or out at this point on the surface?". Then `getBodyRadius` consults it once at the end:

```text
finalRadius = baseRadius(profile + organic + …) + Δr_strokes(θ, t)
                                                  └─ negative = engraved
                                                     positive = raised
```

Mechanically:

1. **Bake strokes into a 2D field once per param change.** Walk every stroke, rasterise into a low-res `θ × t` grid (say 256 × heightLayers), with falloff = brush thickness, peak = ±depth (clamped to safe limits).
2. **Inject into `getBodyRadius`.** One extra term added at the end of the function. Now both the smooth STL body *and* the spiral G-code automatically carve/bump along the spiral. Preview parity stays intact (memory: scale 0.01, spine = lateral offset).
3. **Replace the floating-ribbon preview with a deformed body preview.** When strokes exist, the lathe mesh in `ParametricMesh.tsx` will already show the dips and bumps because it shares `getBodyRadius`. Drop the orange floating ribbons — they'd be misleading.
4. **Print-safety clamps.**
   - Engraved depth must stay below `wallThickness - 0.4mm` so the spiral doesn't punch through (single wall = no margin for error).
   - Raised height capped at ~1mm so overhangs stay printable as the spiral climbs.
   - In spiral mode, force-disable `ribbon` and `texture` effects in the UI with a tooltip explaining why.
5. **Spiral-aware angular smoothing.** Sharp θ-jumps become extrusion-width spikes (the nozzle can't teleport). Run a small 1D blur along θ proportional to nozzle diameter so engraved edges become printable ramps, not vertical cliffs.

## What changes in the print

```text
Today:                       After fix (engraved heart on side):
  ___                          ___
 /   \                        /   \
|     |                      |     |
|     |                      |  ❤  |   ← spiral genuinely dips inward
|     |                      |     |
 \___/                        \___/
```

The heart isn't a sticker. The wall itself thins inward where the heart is, so light shines through differently and you can feel it with your finger.

## Files we'd touch

- `src/lib/surface-stroke-generator.ts` — add `bakeStrokeOffsetField(params) → (θ, t) ⇒ Δr`
- `src/lib/body-profile-generator.ts` — accept optional `strokeField` and add it to the final radius
- `src/lib/stl-export.ts` — pass the baked field into `getRadiusAtHeight` for spiral + planar paths
- `src/components/3d/ParametricMesh.tsx` — drop floating ribbons when strokes are baked into the wall, keep them only for `texture` / `ribbon` (non-vase modes)
- `src/components/drawing/SurfaceCanvas.tsx` — disable ribbon/texture options when print mode = spiral vase

## Open questions for you

1. **Drop ribbon + texture from spiral mode entirely, or keep them as "preview only" with a warning?** I'd vote drop — they fundamentally can't print as a single-wall vase.
2. **Default engraved depth in spiral mode** — right now you can pick 0.5–8mm. With a 1.6mm wall (typical vase) and 0.4mm nozzle, the safe max is ~1.2mm. Should I auto-clamp the slider when spiral mode is on?
3. **Do you want raised at all?** Bumps on a spiraling single wall print OK up to ~0.8mm but anything bigger sags. Worth keeping as a separate effect or fold it into "engraved with negative depth"?

Once you answer those I can scope the actual implementation tightly. The bake-the-field architecture is the right move regardless.
