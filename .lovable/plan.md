

# Wireframe Controls Enhancement + Light Pattern Fix

## Findings

### Wireframe: Missing Controls for Printability
The current wireframe generator has only 5 parameters. For 3D printing, key concerns are missing:
- **Cross-section shape**: Round tubes are hard to print vertically. Square/rectangular profiles print better and provide flat surfaces for gluing fabric.
- **Rib-ring joint reinforcement**: Where ribs meet rings, there's no extra material — joints will be weak.
- **Flat base for bed adhesion**: Tube geometry at the bottom ring is round, meaning poor bed contact.
- **Panel subdivision**: No way to control how many panels each section between ribs creates (affects how fabric panels are cut).
- **Ring profile**: Interior rings could be thinner than mount rings but thicker than ribs.

### Light Patterns: Completely Non-Functional
`applyLightPerforations()` in `light-pattern-generator.ts` is defined but **never called anywhere**. It's not imported in `stl-export.ts` or `ParametricMesh.tsx`. The UI controls exist and generate hole data, but:
- **No preview**: Holes are not visualized in the 3D preview
- **No export**: CSG subtraction is never applied during STL export

The preview should show holes as darkened vertex regions (lightweight), and export should apply CSG subtraction.

---

## Plan

### 1. Add New Wireframe Parameters (`src/types/parametric.ts`)

| Parameter | Range | Purpose |
|-----------|-------|---------|
| `wireframeCrossSection` | `'round' \| 'square' \| 'flat'` | Tube cross-section shape. Square/flat print better |
| `wireframeJointBulge` | 0–2 | Extra thickness multiplier at rib-ring intersections |
| `wireframeFlatBase` | boolean | Flatten bottom mount ring for bed adhesion |
| `wireframeRingThickness` | 0.5–1.5 (multiplier) | Interior ring thickness relative to rib thickness |
| `wireframeDiagonalBracing` | boolean | Add diagonal cross-braces between ribs for rigidity |
| `wireframeBraceFrequency` | 1–4 | How many diagonal pairs per section |

### 2. Update Wireframe Generator (`src/lib/wireframe-lamp-generator.ts`)

- Support square/flat cross-sections by using custom `ExtrudeGeometry` with rectangular profiles instead of `TubeGeometry`
- Add joint reinforcement: at each rib-ring intersection, add a small sphere or thickened tube section
- Add diagonal bracing: between adjacent ribs, add cross-members in an X or V pattern
- Flat base option: replace bottom mount ring tube with a flat rectangular profile torus

### 3. Add Wireframe Controls (`src/components/controls/ParameterControls.tsx`)

Add to the existing "Shade Frame" section:
- Cross-section selector (round/square/flat)
- Joint bulge slider
- Flat base toggle
- Ring thickness multiplier slider
- Diagonal bracing toggle + frequency slider
- Subsection "Print Tips" with static guidance text

### 4. Fix Light Pattern Preview (`src/components/3d/ParametricMesh.tsx`)

Add a lightweight vertex-based preview: during body geometry generation, darken vertices that fall within perforation hole positions. This avoids expensive CSG in real-time but gives visual feedback.

- Import `generateLightPattern` and `PerforationHole`
- After body geometry is built, if `lightPatternEnabled`, compute hole positions and set vertex colors to darken affected vertices
- Apply `vertexColors: true` to the material when patterns are active

### 5. Fix Light Pattern Export (`src/lib/stl-export.ts`)

- Import `applyLightPerforations` from `light-pattern-generator.ts`
- In `exportBodyToSTL`, after generating the body mesh (non-wireframe path), call `applyLightPerforations()` to CSG-subtract the holes
- Skip perforations when `wireframeMode` is enabled (wireframe has no solid walls to perforate)

### 6. Update Defaults (`src/types/parametric.ts`, `src/types/lamp.ts`)

Add sensible defaults for all new wireframe parameters.

