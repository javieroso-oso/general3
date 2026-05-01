# Make Funky Skin actually look like skin

The current textures look like organic noise because (a) the mesh samples at 64×64 — way too coarse to resolve a real texture, (b) default frequencies are organic-shape low, and (c) every mode uses smooth math (sines, value-noise, soft bumps) instead of crisp edges.

## What changes

### 1. Sharpen the per-mode math (`src/lib/skin-texture-generator.ts`)

Rewrite all six mode functions for crisp output, and add a `crispness` parameter (0=current soft, 1=razor sharp) that biases each mode's curve via `sign(x) * pow(abs(x), 1 - crispness*0.9)`.

| Mode | New shape |
|---|---|
| Fuzz | Per-(layer, angular-bucket) hash, 512 buckets at density=1, no smoothing — true sandpaper |
| Knurl | `tri(theta*N + t*pitch) * tri(theta*N - t*pitch)` (triangle waves, not sines) → pyramid tips |
| Scales | Hex grid + arc-clipped half-circle shingle profile, fades outward edge to zero → fish/pinecone |
| Ribs | Triangle wave `(2/π) * asin(sin(theta*N))` → sharp flutes, not sine ripples |
| Brushed | Anisotropic noise kept, but with horizon streaks (long u, short v) |
| Pixel | Hard binary on/off (no 3-level quantize), 80 cells around at density=1, true voxel grid |

Default counts cranked up:
- Fuzz: 64 → 512 buckets
- Knurl: 8 → 32 diamonds
- Scales: 12×20 → 40×60 cells
- Ribs: 20 → 48 flutes
- Pixel: 24 → 80 cells

### 2. Two new modes

- **Hammered** — Poisson-ish dimple field via jittered grid hash. Each cell gets a circular concave dimple → beaten-copper look.
- **Threads** — Single helical groove: `tri(theta + t * pitchTurns * 2π)`. Looks like a literal screw thread; great for grippy lamp stems.

### 3. Adaptive preview mesh (`src/components/3d/ParametricMesh.tsx`)

When `skinTextureMode !== 'off'`, bump the main body lathe from `segments=64, heightSegments=64` to:
- `segments = 256` (or 384 for pixel/knurl/scales/threads)
- `heightSegments = max(64, round(height_mm / 0.3))` — roughly one ring per 0.3mm, matching layer height

Gate behind the skin-on check so the rest of the app stays fast. Add a small "High-detail preview" badge in `SkinTextureControls` when active so the user knows why the viewport got heavier.

### 4. UI updates (`src/components/controls/SkinTextureControls.tsx`)

- Add **Crispness** slider (0..1, default 0.7).
- Add the two new modes to the mode picker with mini-preview thumbnails.
- Raise amplitude cap from 0.8mm to **1.2mm** in both UI and `AMP_HARD_CAP_MM`.
- Update the canvas mini-preview to render at higher resolution (it currently smooths the same way the 3D mesh does).

### 5. Type + defaults (`src/types/parametric.ts`, `src/types/lamp.ts`)

- Extend `skinTextureMode` union with `'hammered' | 'threads'`.
- Add `skinTextureCrispness: number` (default 0.7).
- Add `skinTextureThreadPitch: number` (turns over full height, default 8) for Threads mode only.

## Files touched

- `src/lib/skin-texture-generator.ts` — rewrite all mode functions, add hammered + threads, add crispness, raise cap
- `src/types/parametric.ts` — extend mode union, add crispness + thread pitch, raise default amplitude headroom
- `src/types/lamp.ts` — same
- `src/components/3d/ParametricMesh.tsx` — adaptive segments when skin is on
- `src/components/controls/SkinTextureControls.tsx` — crispness slider, new modes, raised cap, sharper canvas preview
- `src/lib/body-profile-generator.ts` — no changes (chokepoint already injects perturbation)

## What it'll look like after

- Fuzz reads as **felt/sandpaper** instead of bumps
- Knurl reads as a **tool grip**
- Scales reads as a **pinecone/dragon hide**
- Ribs reads as a **Greek column**
- Pixel reads as **Minecraft**
- Hammered reads as **artisan copper**
- Threads reads as a **screw**

Print integrity stays intact: still XY-only, still wall-thickness clamped, still respects start/end height safety zones, still A1-safe.
