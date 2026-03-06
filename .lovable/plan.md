

# Merge Vase/Lamp/Sculpture into Single "Shape"

## What Changes

The three shape styles (vase, lamp, sculpture) become one unified "Shape" mode. All lamp-specific features (socket mount, light patterns, wireframe shade frame) become available to any shape — they're just optional sections the user can toggle on. The style selector UI is removed entirely.

## Key Observations

- **Sculpture** has zero unique logic — no code checks for `shapeStyle === 'sculpture'` anywhere
- **Lamp** gates ~4 features: wireframe mode, light patterns, socket mount, and some export naming
- **Vase** is the default with no special gating
- Merging means: remove the selector, make lamp features always available, update type system

## Changes

### 1. `src/types/parametric.ts`
- Remove `ShapeStyle` type and `ObjectType3D` alias
- Remove `shapeStyle` from `ParametricParams`
- Collapse `defaultShapeParams` record into a single `defaultParams` object (use current vase defaults)
- Update `Preset` type to remove the `type: ShapeStyle` field

### 2. `src/components/controls/ParameterControls.tsx`
- Remove the "Object Type" selector (lines 581–607)
- Remove all `params.shapeStyle === 'lamp'` guards on Shade Frame and Light Patterns sections — make them always visible
- Update any references to `params.shapeStyle` in labels/text

### 3. `src/components/3d/ParametricMesh.tsx`
- Remove `shapeStyle === 'lamp'` checks — wireframe and light pattern logic should just check their own toggle (`wireframeMode`, `lightPatternEnabled`)

### 4. `src/lib/stl-export.ts`
- Same: replace `shapeStyle === 'lamp'` guards with direct feature toggle checks
- Update export filenames from `params.shapeStyle` to `'shape'`

### 5. `src/lib/batch-export.ts`
- Remove `shapeStyle === 'lamp'` check; use `params.lightPatternEnabled` or similar instead

### 6. `src/pages/Index.tsx`
- Remove `shapeStyle` references in export naming, plotter integration
- Use `'shape'` as the label string where needed

### 7. `src/components/controls/PresetGallery.tsx`
- Remove type filtering — show all presets together
- Remove `type: ShapeStyle` prop

### 8. `src/pages/About.tsx`
- Update description text

### 9. Minor cleanup across drawer types, plotter hooks, mold detector — replace `ShapeStyle` references with simple strings or remove them

