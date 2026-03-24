

# Export Base Plate + LED Puck Light Recess

## Overview

Add a new exportable **Base Plate** component: a flat disc matching the bottom cross-section of the shape, with an optional circular recess for LED puck lights. This lets the shade print in spiral vase mode while the base prints separately with regular infill.

```text
  Side view:
  ╭───────────╮  ← shade (spiral vase, open bottom)
  │           │
  │    LED↑   │
  ├═══════════╤  ← base plate (regular print)
  │  ○ recess │  ← puck light pocket
  └───────────┘
```

## Changes

### 1. Add base plate params to `src/types/parametric.ts`
Add to `ParametricParams` interface and `createDefaultParams`:
- `basePlateEnabled: boolean` (default false)
- `basePlatePuckDiameter: number` (default 70mm)
- `basePlatePuckDepth: number` (default 10mm)
- `basePlateThickness: number` (default 15mm)

### 2. Create `src/lib/base-plate-generator.ts` (new file)
- Generate a solid disc geometry matching `getBodyRadius(params, 0, angle)` around 360 degrees
- Cut a centered circular pocket for the puck light (configurable diameter/depth)
- Add a small lip/ridge on the top edge (2mm inset, 3mm tall) so the shade sits snugly
- Uses Three.js BufferGeometry with proper normals
- Apply Y-up to Z-up rotation and build plate normalization (matching existing STL convention)

### 3. Add export function in `src/lib/stl-export.ts`
- Add `exportBasePlateToSTL(params)` function that calls the generator and exports via STLExporter
- Same rotation/normalization pattern as other exports

### 4. Update `src/types/export-options.ts`
- Add `includeBasePlate: boolean` to `ExportOptions` interface and `DEFAULT_EXPORT_OPTIONS`

### 5. Update `src/components/ExportOptionsDialog.tsx`
- Add "Base Plate" checkbox (enabled when `basePlateEnabled` is true on any item)
- Show `base_plate.stl` in file preview

### 6. Update `src/lib/batch-export.ts`
- Add `hasBasePlate` to `analyzeDrawerItems`
- Include `base_plate.stl` in ZIP when enabled

### 7. Update `src/components/controls/ParameterControls.tsx`
- Add "Base Plate" section (between Cord Hole and Legs sections, around line 1529) with:
  - Enable toggle
  - Puck light diameter slider (30-120mm)
  - Recess depth slider (5-25mm)
  - Plate thickness slider (8-25mm)

## Files Summary

| File | Change |
|------|--------|
| `src/types/parametric.ts` | Add 4 base plate params + defaults |
| `src/lib/base-plate-generator.ts` | **New** - disc mesh with puck recess |
| `src/lib/stl-export.ts` | Add `exportBasePlateToSTL` |
| `src/types/export-options.ts` | Add `includeBasePlate` |
| `src/components/ExportOptionsDialog.tsx` | Add checkbox + file preview |
| `src/lib/batch-export.ts` | Include base plate in ZIP |
| `src/components/controls/ParameterControls.tsx` | Add Base Plate UI section |

