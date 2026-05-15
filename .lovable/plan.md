# Draw on the Base (Bottom Face)

Simple addition: a 2D top-down canvas that lets you draw **raised lines on the bottom surface** of the current shape. Works on whatever shape you've already designed — no new "flat mode," no subtypes.

## What you get

- A new **"Base Drawing"** canvas next to the existing Surface canvas — a circular top-down view sized to the base radius of the current shape.
- Draw freeform strokes; each stroke becomes a **raised rib** on the bottom face (printer-friendly — no overhangs, no engraving into the floor).
- Same controls you already know: thickness (mm), height (mm = how tall the rib stands above the base), undo/clear, scale/offset.
- Strokes rendered live in 3D on the bottom face, exported with the STL.

## Why bottom only and raised only

- Bottom face is already flat → ribs print cleanly as the first layers.
- Raised (not engraved) avoids cutting into the floor, which would break spiral-vase mode and add print failures.
- Whatever silhouette your shape has at `t=0`, the canvas mirrors it so strokes never go past the real edge.

## Technical plan (small)

- **Type** (`src/types/parametric.ts`): add `baseStrokes: BaseStroke[]` where `BaseStroke = { id, points: {x:-1..1, y:-1..1}[], thickness, height }`. Coords are normalized to base radius.
- **Canvas** (`src/components/drawing/BaseCanvas.tsx`, new): top-down circular canvas, draws current base silhouette as a guide, captures freeform strokes. Mirrors the existing SurfaceCanvas patterns (undo, clear, scale).
- **Geometry** (`src/lib/base-stroke-generator.ts`, new): for each stroke, build a swept tube of `thickness × height` sitting on top of the bottom face (`y = 0` in scene units, or `Z = 0` in export). Returns `THREE.BufferGeometry` to be merged with the body for export and rendered as a child mesh in preview.
- **Render**: add a `<BaseStrokesMesh>` inside `ParametricMesh.tsx` (preview only).
- **Export**: merge base-stroke geometries into the main STL right before the existing rotate -π/2 / Z=0 normalization.
- **Print mode guard**: if any base stroke exists, force standard print mode (disable spiral-vase) with a small inline notice — same pattern used elsewhere.
- **UI** (`src/components/controls/ParameterControls.tsx`): add a "Base Drawing" tab/section alongside the Surface drawing one.

## Out of scope

- Engraved/cut into the base.
- Drawing on the top face.
- Changing the silhouette of the base.

Approve and I'll build it.
