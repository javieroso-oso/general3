# Funky Skin — XY Surface Texturing

A1-safe surface textures via XY-only path perturbation. Same primitive as Bambu's fuzzy skin: jitter the wall outward/inward, never touch Z. Six modes, baked into the mesh so it appears in the viewport, the STL export, and the G-code automatically.

## How it plugs in (one injection point)

`getBodyRadius(params, t, theta)` in `src/lib/body-profile-generator.ts` is the single source of truth. The 3D mesh, the profile generator, and the G-code generator all call it. Adding the texture there means **viewport, STL, and G-code stay in lockstep with no extra wiring**.

New function `getSkinPerturbation(t, theta, layerIdx, settings) → mm` is added to the end of `getBodyRadius`, multiplied by `scale`, and added to the final radius. Returns 0 when mode is `off` so existing prints are unchanged.

## The six modes

All operate as `radialDelta = f(theta, t, seed) * amplitude`, with optional layer-index input for vertical patterns.

1. **Fuzz** — pseudo-random jitter via hashed `(theta, layerIdx, seed)`. Direction bias control: outward / inward / both. Our take on fuzzy skin.
2. **Knurl** — `sin(theta * countA + t * pitchA) * sin(theta * countB - t * pitchB)`. Diamond grip pattern.
3. **Scales** — hex-cell distance field in `(theta, t)` space. Each cell bumps out, fading toward edges. Reptile / pinecone look.
4. **Ribs** — `cos(theta * count)`. Pure vertical fluting, but path-time so it stacks with everything else cleanly.
5. **Brushed** — anisotropic 2D value noise: high frequency on Z axis, low on theta. Brushed-metal grain.
6. **Pixel** — quantize `(theta, t)` to a grid; each cell hashes to a discrete bump (0 / amp / 2×amp). 8-bit voxel look.

## Settings (one shared block)

Stored on `ParametricParams` as `skinTexture`:

```
mode: 'off' | 'fuzz' | 'knurl' | 'scales' | 'ribs' | 'brushed' | 'pixel'
amplitude: number      // 0..0.8 mm (hard cap)
density: number        // pattern-specific frequency / cell count
direction: 'outward' | 'inward' | 'both'   // fuzz/pixel only
startHeightPct: number // 0..0.3, skip first N% so brim/first-layer stays clean
endHeightPct: number   // 0..0.3, skip last N% so rim stays clean
seed: number
```

Defaults: `mode: 'off'`, all zero. Existing designs unaffected.

## Safety rails

- Hard cap amplitude at **0.8 mm** in the slider.
- Warning toast if `amplitude > wallThickness * 0.5` (risks perforating the wall).
- Auto-disable inside the `flatBottomHeight` zone (don't disturb first-layer adhesion).
- Auto-disable in the top 5% if `lipFlare > 0` (preserve clean rims).
- For Fuzz mode, sample density is rate-limited so we never emit G-code points closer than 0.2 mm apart (Bambu firmware planner stays smooth).

## UI

New collapsible **"Funky Skin"** section in `ParameterControls.tsx`, placed under the existing organic-deformations group (this is a *design* choice, not a print setting). Contains:

- Mode tabs (Off / Fuzz / Knurl / Scales / Ribs / Brushed / Pixel) with small SVG icons
- Amplitude slider (0–0.8 mm) with the wall-thickness warning live
- Density slider (label changes per mode: "Jitter rate" / "Diamond count" / "Cell size" / "Rib count" / "Grain scale" / "Pixel size")
- Direction segmented control (only shown for Fuzz / Pixel)
- Range sliders: Start height %, End height %
- Seed input + dice button (re-randomize)
- Mini live preview swatch showing a strip of the texture at the current settings (rendered to a small canvas)

Standard slider components from `ParameterSlider`. Electric-pop colors per memory.

## Where the math lives

New file `src/lib/skin-texture-generator.ts`:

- `getSkinPerturbation(t, theta, layerIdx, settings, options) → number` — main entry point, returns radial delta in mm
- One pure function per mode (`fuzzDelta`, `knurlDelta`, `scalesDelta`, `ribsDelta`, `brushedDelta`, `pixelDelta`)
- Reuses the existing seeded `noise3D` from `body-profile-generator.ts` for Fuzz / Brushed
- Pure, no Three.js / DOM dependencies → cheap to call from G-code generator

## Files touched

- `src/types/parametric.ts` — add `SkinTextureSettings` interface, extend `ParametricParams`, add defaults.
- `src/lib/skin-texture-generator.ts` — NEW. All six modes + entry point.
- `src/lib/body-profile-generator.ts` — call `getSkinPerturbation` at the end of `getBodyRadius`, add scaled delta to final radius.
- `src/components/controls/ParameterControls.tsx` — new "Funky Skin" collapsible panel.
- `src/components/controls/SkinTextureControls.tsx` — NEW. The panel itself with mode tabs, sliders, mini preview swatch.

## Out of scope (call-outs for later)

- Stacking two textures with a blend slider (mentioned earlier — feasible since modes are pure functions, but adds UI complexity; do as v2 once we know which combos people want).
- Per-region masking ("only fuzz the upper half of one side").
- Texture export as a separate displacement map for use in other tools.
- Applying skin to inner wall (currently outer-only; inner stays smooth for now).

## Why this is the right move (short version)

- Zero risk on Bambu A1 — it's just XY moves, every printer handles this.
- Slices normally in Bambu Studio because it's baked into the STL geometry.
- One injection point in `getBodyRadius` keeps viewport, STL, and G-code automatically consistent — no parity bugs.
- Six modes ship in one PR because they're all the same shape: `f(theta, t, seed) → mm`.
