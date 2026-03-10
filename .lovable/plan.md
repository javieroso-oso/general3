

# Surface Drawing Feature — Draw lines on a 2D canvas, project as tubular/embossed/engraved shapes onto the 3D body

## Concept

A new "Surface Art" panel in the main Shape editor where you draw strokes on a 2D cylindrical unwrap canvas. Each stroke gets projected onto the parametric body surface and converted into 3D geometry — raised tubes (like eyebrow ridges), engraved grooves, or flat ribbons. You choose the effect per stroke.

```text
┌─────────────────┐     ┌─────────────────┐
│  2D Canvas      │     │  3D Preview     │
│  (unwrapped     │ ──► │  (strokes       │
│   surface map)  │     │   become tubes  │
│                 │     │   on surface)   │
│  X = angle θ    │     │                 │
│  Y = height t   │     │                 │
└─────────────────┘     └─────────────────┘
```

## Data Model

New types in `src/types/parametric.ts`:

```typescript
interface SurfaceStroke {
  id: string;
  points: { u: number; v: number }[];  // u=0..1 (angle), v=0..1 (height)
  thickness: number;     // tube diameter in mm
  effect: 'raised' | 'engraved' | 'ribbon';
  depth: number;         // how far it protrudes or cuts in (mm)
}
```

Add `surfaceStrokes: SurfaceStroke[]` to `ParametricParams`.

## Implementation Steps

### 1. Types & State (`src/types/parametric.ts`)
- Add `SurfaceStroke` interface and `surfaceStrokes: SurfaceStroke[]` to `ParametricParams`
- Default to empty array

### 2. Surface Drawing Canvas (`src/components/drawing/SurfaceCanvas.tsx`)
- New Fabric.js canvas component (reuse pattern from existing `ProfileCanvas`)
- Canvas maps to unwrapped surface: X axis = angle (0–360°), Y axis = height (bottom to top)
- Faint grid overlay showing the cylindrical unwrap
- Freehand brush drawing with adjustable thickness
- Per-stroke controls: effect type (raised/engraved/ribbon), depth slider
- Undo/redo, clear, delete stroke
- Outputs `SurfaceStroke[]` on every change

### 3. Surface Stroke Geometry (`src/lib/surface-stroke-generator.ts`)
- Takes `SurfaceStroke[]` + `ParametricParams` → `THREE.BufferGeometry`
- For each stroke:
  - Convert (u, v) points to 3D positions on the body surface using `getBodyRadius()`
  - Calculate surface normal at each point
  - **Raised**: Generate tube geometry (circle cross-section swept along path, offset outward by depth)
  - **Engraved**: Same tube but offset inward (used as CSG subtract or visual indent)
  - **Ribbon**: Flat rectangular cross-section tangent to surface
- Use `TubeGeometry`-style approach: sample points, compute Frenet frames, sweep cross-section

### 4. Integrate into ParametricMesh (`src/components/3d/ParametricMesh.tsx`)
- Import surface stroke generator
- In the main `useMemo`, generate stroke geometries from `params.surfaceStrokes`
- Render as additional `<mesh>` children with matching material

### 5. UI Panel in Controls (`src/components/controls/ParameterControls.tsx`)
- New collapsible "Surface Art" section in the Shape controls
- Contains the `SurfaceCanvas` component
- Stroke list with per-stroke effect/depth controls
- Toggle to show/hide surface strokes on the 3D model

### 6. STL Export (`src/lib/stl-export.ts`)
- Merge surface stroke geometries into the exported body mesh
- For engraved strokes, use boolean subtraction or approximate by displacing vertices inward

## Key Technical Details

- **UV → 3D mapping**: `u` maps to `theta = u * 2π`, `v` maps to `t = v` (height parameter). Position = `getBodyRadius(params, t, theta) * [cos(theta), sin(theta)]` at height `t * height`. Surface normal = radial direction outward.
- **Tube sweep**: For each stroke path, resample to even spacing, compute tangent/normal/binormal at each sample, sweep a circular cross-section perpendicular to the tangent.
- **Canvas size**: ~400×300px, aspect ratio matches typical unwrapped cylinder proportions.
- Strokes persist in `ParametricParams` so they survive preset saves and drawer storage.

