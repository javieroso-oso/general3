

# Expand Surface Art: Full Drawing Board with Engrave, Emboss, Cut & Texture

The Surface Art feature already exists with raised/engraved/ribbon effects and a Fabric.js canvas. The user wants to expand this into a more complete drawing tool with all four operations: **engrave**, **emboss**, **cut** (boolean subtract through the wall), and **texture** (repeating pattern fill along the stroke path).

## What Changes

### 1. Expand `SurfaceStroke.effect` type
Add `'cut'` and `'texture'` to the existing `'raised' | 'engraved' | 'ribbon'` union type in `src/types/parametric.ts`.

### 2. Update SurfaceCanvas drawing UI (`src/components/drawing/SurfaceCanvas.tsx`)
- Add **cut** (red) and **texture** (green) color mappings
- Add those options to the effect dropdown
- Add a **texture pattern** selector (only shown when effect = texture): options like dots, crosshatch, zigzag
- Add a **symmetry** toggle — mirror strokes horizontally (left/right on the unwrapped surface) for balanced designs
- Add a stroke **opacity** slider to allow layered drawing visibility
- Improve the toolbar with grouped icon buttons instead of plain text

### 3. Update geometry generator (`src/lib/surface-stroke-generator.ts`)
- **Cut**: Generate the same tube geometry as raised, but flag it for boolean subtraction. In the 3D preview, render it as a translucent red mesh to indicate material removal.
- **Texture**: Instead of a single swept tube, repeat small geometry instances (spheres for dots, crossed tubes for crosshatch, zigzag tubes) along the stroke path at regular intervals. The `SurfaceStroke` gets an optional `texturePattern` field.

### 4. Update ParametricMesh integration (`src/components/3d/ParametricMesh.tsx`)
- Color-code meshes by effect type: blue for raised, orange for engraved, red translucent for cut, green for texture
- Cut strokes render with transparent material to clearly show where material will be removed

### 5. STL export consideration
- For now, raised/engraved/ribbon/texture strokes merge additively into the export mesh
- Cut strokes are flagged but full CSG boolean subtraction is deferred (complex) — a warning toast will note this limitation

## Files Modified
- `src/types/parametric.ts` — expand `SurfaceStroke` interface
- `src/components/drawing/SurfaceCanvas.tsx` — add new effects, symmetry, texture pattern
- `src/lib/surface-stroke-generator.ts` — cut + texture geometry generation
- `src/components/3d/ParametricMesh.tsx` — updated material colors per effect

