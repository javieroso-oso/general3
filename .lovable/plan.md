
# Light Perforations Feature

Add configurable cutout patterns to 3D shapes that let light pass through, enabling lamp shades and decorative objects with illuminated patterns.

---

## Overview

This feature adds perforations (holes) to the parametric mesh body that create decorative light effects when backlit. Users can choose from several pattern types, control density, size, and the zone where patterns appear.

---

## Pattern Types

| Pattern | Description | Visual Effect |
|---------|-------------|---------------|
| **Dots** | Circular holes in a grid or organic distribution | Clean, modern, starry |
| **Lines** | Horizontal or vertical slots | Art deco, blinds effect |
| **Organic** | Noise-distributed random holes | Natural, handcrafted feel |
| **Geometric** | Hexagonal honeycomb or triangular grid | Structured, architectural |
| **Spiral** | Holes following spiral grooves | Dynamic, flowing |

---

## User Controls

New "Light Patterns" section in Parameter Controls (only visible when `shapeStyle === 'lamp'`):

**Pattern Type** - Dropdown selector for pattern style

**Pattern Settings**:
- **Density** (0.1 - 1.0) - How many holes per area
- **Hole Size** (2mm - 15mm) - Diameter of each perforation
- **Zone Start** (0 - 0.9) - Height percentage where pattern begins
- **Zone End** (0.1 - 1.0) - Height percentage where pattern ends

**Advanced Options** (collapsible):
- **Randomness** (0 - 1) - Organic variation in placement
- **Scale with Height** - Holes get larger toward top
- **Avoid Rim** - Keeps holes away from top edge for structural integrity

---

## Implementation Approach

### Two-Phase Strategy

**Phase 1: Vertex-based Pattern Masking** (simpler, preview-friendly)
- Generate hole positions procedurally based on pattern type
- Store perforation data as metadata for STL export
- Visual preview shows pattern locations with material opacity variation
- Fast real-time preview without heavy CSG computation

**Phase 2: CSG Boolean Operations** (export-time)
- When exporting STL, apply CSG subtraction to create actual through-holes
- Uses existing `three-bvh-csg` library already in project
- Ensures watertight, printable geometry

---

## Technical Changes

### 1. Type Definitions (`src/types/parametric.ts`)

Add to `ParametricParams`:
```text
lightPatternEnabled: boolean;
lightPatternType: 'dots' | 'lines' | 'organic' | 'geometric' | 'spiral';
lightPatternDensity: number;      // 0.1-1 holes per unit area
lightPatternSize: number;         // 2-15mm hole diameter
lightPatternZoneStart: number;    // 0-0.9 height fraction
lightPatternZoneEnd: number;      // 0.1-1 height fraction
lightPatternRandomness: number;   // 0-1 placement variation
lightPatternScaleWithHeight: boolean;
lightPatternRimMargin: number;    // 0-0.2 avoid rim zone
```

### 2. New Pattern Generator (`src/lib/light-pattern-generator.ts`)

Creates hole positions based on pattern type:
- `generateDotPattern()` - Grid/hex layout with noise
- `generateLinePattern()` - Horizontal slot positions
- `generateOrganicPattern()` - Poisson disc sampling
- `generateGeometricPattern()` - Honeycomb tessellation
- `generateSpiralPattern()` - Along spiral groove paths

Returns array of `{ theta: number, t: number, size: number }` defining hole positions in cylindrical coordinates.

### 3. Mesh Generation Updates (`src/components/3d/ParametricMesh.tsx`)

**Preview Mode:**
- Generate pattern positions
- Create vertex colors or texture coordinates to visualize pattern
- Show holes as darker/transparent regions

**Export Mode:**
- Convert pattern positions to 3D cylinder brushes
- Apply CSG subtraction using `three-bvh-csg`
- Output clean, manifold geometry

### 4. STL Export Updates (`src/lib/stl-export.ts`)

Add CSG perforation step before export:
```text
if (params.lightPatternEnabled) {
  geometry = applyLightPerforations(geometry, params);
}
```

### 5. UI Controls (`src/components/controls/ParameterControls.tsx`)

New collapsible "Light Patterns" section:
- Only visible when `shapeStyle === 'lamp'`
- Pattern type selector (visual icons)
- Density and size sliders
- Zone start/end range slider
- Advanced options subsection

---

## Technical Considerations

### Print Safety
- **Minimum hole size**: 2mm to ensure printability
- **Minimum spacing**: Wall thickness × 2 between holes
- **Structural zones**: Automatic exclusion near base and rim
- **Wall thickness validation**: Holes only allowed if `wallThickness >= 1.6mm`

### Performance
- Pattern calculation is lightweight (runs in useMemo)
- CSG operations only on export (not real-time)
- Preview uses vertex coloring instead of actual geometry modification

### File Structure
```text
src/lib/light-pattern-generator.ts (new)
  ├── generateDotPattern()
  ├── generateLinePattern()
  ├── generateOrganicPattern()
  ├── generateGeometricPattern()
  ├── generateSpiralPattern()
  └── applyLightPerforations() (CSG for export)

src/types/parametric.ts (modify)
  └── Add lightPattern* properties

src/components/controls/ParameterControls.tsx (modify)
  └── Add Light Patterns section

src/lib/stl-export.ts (modify)
  └── Integrate perforation step

src/components/3d/ParametricMesh.tsx (modify)
  └── Add pattern visualization
```

---

## Visual Preview Approach

Since CSG is computationally expensive, the real-time preview will use a shader-based approach:

1. Generate pattern positions in cylindrical coordinates
2. Pass to shader as uniforms or vertex attributes
3. Fragment shader renders holes as transparent/dark spots
4. Gives instant feedback while designing

On export, actual CSG is applied for watertight mesh.

---

## Default Values

```text
lightPatternEnabled: false
lightPatternType: 'dots'
lightPatternDensity: 0.3
lightPatternSize: 5
lightPatternZoneStart: 0.2
lightPatternZoneEnd: 0.8
lightPatternRandomness: 0.2
lightPatternScaleWithHeight: false
lightPatternRimMargin: 0.1
```

---

## Future Enhancements

- **Custom pattern import**: SVG/image-based perforation masks
- **Voronoi patterns**: Organic cell-like structures
- **Gradient density**: Pattern density varies with height
- **Multi-layer patterns**: Different patterns at different heights
