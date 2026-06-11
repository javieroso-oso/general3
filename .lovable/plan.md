# Stackable Shapes — Plan

Add a per-shape **Stackable** toggle so any Shape-mode object can be stacked on any other shape that uses the same rim diameter. Designed for spiral vase mode: pieces remain a single continuous open wall, no horizontal surfaces, no lids, no plugs.

## How it works (concept)

```text
        ┌──────── stackRimDiameter ────────┐
        │                                  │
   ─────┘   piece B (sits on top)          └─────   top opening = rim
        ╲                                  ╱
         ╲      organic belly / shape      ╱
        ─┘                                 └─        bottom opening = rim
        │                                  │
   ─────┘   piece A                        └─────
        ╲                                  ╱
         ╲                                ╱
```

Both ends of every stackable piece are forced to the **same** circular opening (`stackRimDiameter`). Pieces with matching rim diameters sit flush on top of each other like open tubes. The body in between can still bulge, pinch, twist, etc.

## Changes

### 1. Params (`src/types/parametric.ts`)
Add three fields to `ParametricParams` (defaults make it inert):

- `stackable: boolean` — default `false`
- `stackRimDiameter: number` — default `60` (mm)
- `stackRimWallThickness: number` — default `2.0` (mm), short straight collar height at each rim for clean mating

### 2. Geometry constraint (`src/components/3d/ParametricMesh.tsx` + body generator)
When `stackable` is on, before sampling the profile:

- Force `baseRadius = topRadius = stackRimDiameter / 2`
- Add a short straight cylindrical collar (height ~3 mm) at both `t=0` and `t=1` so the rim is perfectly circular and printable, even if `bulge`, `pinch`, `lobeCount`, `roundness*`, `lipFlare`, `meltAmount`, `flatBottom` would normally distort the end caps. Implementation: clamp the profile radius to `stackRimDiameter/2` for `t < collarFrac` and `t > 1 - collarFrac`, and suppress `lipFlare`/`lipHeight`, `meltAmount`/`meltDragAmount`, `flatBottom`, `basePlateEnabled`, and `centeringLipEnabled` while stackable is active.

No top or bottom cap is generated (vase mode prints the wall only). The bottom face stays open.

### 3. Controls (`src/components/controls/ParameterControls.tsx`)
New collapsible **Stacking** section:

- Switch: `Stackable`
- Slider: `Rim diameter` (20–150 mm), disabled when stackable is off
- Slider: `Collar height` (1–6 mm)
- Info chip: "Locks top & bottom to the same opening. Pairs with Spiral Vase print mode. Disables lip flare, melt, flat bottom, base plate, and centering lip."

When the toggle flips on:
- Force `printMode = 'vase_spiral'` in the print settings (with a note shown).
- Grey out `baseRadius` / `topRadius` sliders and show "locked by Stacking".

### 4. Preview affordance (`src/components/3d/Scene3D.tsx`)
Add a tiny stacked-ghost preview: when `stackable` is on, render a translucent copy of the same mesh offset by `+height` in Y so the user can visually confirm the rims meet. Toggleable via a small "Show stack preview" switch in the new Stacking section. No new parameters in storage.

### 5. Drawer / batch
No changes needed — existing per-item persistence already captures the new params, so a stacked set can be saved and batch-exported together.

### 6. Validation (`analyzePrint` in `src/types/parametric.ts`)
When `stackable` is on:
- Warn if `stackRimDiameter < 20` (too narrow for nozzle path quality).
- Warn if active `printMode !== 'vase_spiral'`.
- Info: "Stack-compatible — pieces with rim Ø {stackRimDiameter}mm will sit flush."

## Out of scope
- Mechanical interlock (lips, threads, magnets) — explicitly skipped per request.
- Lighting / cord routing between stacked pieces.
- Cross-mode stacking with Plotter or Pages.

## Files touched
- `src/types/parametric.ts` (params + defaults + analyze)
- `src/components/controls/ParameterControls.tsx` (Stacking section)
- `src/components/3d/ParametricMesh.tsx` (rim clamp + collar)
- `src/lib/body-profile-generator.ts` (collar clamp in profile sampling)
- `src/components/3d/Scene3D.tsx` (optional stacked ghost)
- `src/lib/stl-export.ts` (respect clamped profile — already driven by same params, just verify)
