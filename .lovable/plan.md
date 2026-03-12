

# Surface Art: Placement Preview & Enhanced Drawing Board

The user wants to see **where on the 3D surface** their drawing will land — a live placement guide that connects the 2D canvas to the 3D model. Like ceramic artists who mark placement before incising/drawing on clay.

## What to Build

### 1. Live placement indicator on the 3D model
When hovering or drawing on the 2D canvas, show a **highlight ring/band** on the 3D model indicating the corresponding height zone and angular position:
- A horizontal ring at the current V (height) position
- A vertical line at the current U (angle) position  
- These form a crosshair on the 3D surface showing exactly where the brush is

### 2. Ghost preview of the current stroke on the 3D model
As you draw on the 2D canvas, show a **real-time translucent preview** of the stroke being projected onto the 3D shape — so you see the tube/groove forming live before committing.

### 3. Zone markers on the 2D canvas
Overlay the canvas with a **silhouette outline** of the body's profile (radius at each height), so you can see which parts of the canvas correspond to the bulge, the lip, the base, etc. This gives spatial context to the flat unwrap.

### 4. Placement controls
Add controls to **reposition** and **scale** existing strokes after drawing:
- Vertical offset slider (shift stroke up/down on the body)
- Rotation offset slider (rotate stroke around the body)
- Scale slider (make the stroke bigger/smaller)

## Technical Approach

### Files to modify

**`src/components/drawing/SurfaceCanvas.tsx`**
- Add `onHover` callback that emits `{ u, v }` as mouse moves over canvas
- Draw body profile silhouette overlay (call `getBodyRadius` at multiple heights, scale to canvas width to show where the shape widens/narrows)
- Add per-stroke offset/rotation/scale controls in a stroke list below the canvas

**`src/components/3d/ParametricMesh.tsx`**
- New `SurfaceCrosshair` child component: takes `{ u, v }` hover position and renders two indicator rings (horizontal height ring + vertical angle line) on the body surface using `getBodyRadius`
- Update `SurfaceStrokeMeshes` to show ghost preview geometry for in-progress stroke

**`src/types/parametric.ts`**
- Add `offsetU`, `offsetV`, `scale` optional fields to `SurfaceStroke` for post-draw repositioning

**`src/lib/surface-stroke-generator.ts`**
- Apply `offsetU`, `offsetV`, `scale` transforms to stroke points before projecting to 3D

**`src/components/controls/ParameterControls.tsx`**
- Pass hover state between `SurfaceCanvas` and the 3D scene (lift state to parent)
- Add stroke list with per-stroke repositioning sliders

### Data flow

```text
SurfaceCanvas (mouse move) 
  → onHover({u, v}) 
  → ParameterControls lifts state 
  → passes to Index page 
  → ParametricMesh renders crosshair at {u, v}
```

### Profile silhouette on canvas
Sample `getBodyRadius(params, t, 0)` for t=0..1 at ~50 points. Normalize to canvas width. Draw as a faint curved line on the left edge and mirrored on the right edge, showing the body's cross-section profile as context.

