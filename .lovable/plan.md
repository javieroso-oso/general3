

# Wireframe Lamp Generator

## Concept

A new mode within the Lamp shape style that generates structural ribs/frames instead of solid walls. The output is a 3D-printable skeleton — vertical ribs, horizontal rings, and optional decorative cross-members — designed to be covered with paper, fabric, or other translucent materials.

Think: Japanese lanterns, Noguchi-style lamps, mid-century modern shades.

## How It Works

The generator reuses the existing parametric profile (all the same shape controls — height, radii, profile curve, bulge, twist, etc.) but instead of producing a continuous wall, it samples the profile at discrete points to create:

1. **Vertical ribs** — Thin structural members running from bottom ring to top ring, following the body profile curve
2. **Horizontal rings** — Circular frames at regular height intervals that hold the ribs in place
3. **Top & bottom mounting rings** — Thicker rings at the top (for socket attachment) and bottom (for structural stability)

All pieces would be generated as solid printable geometry (extruded cross-sections along the profile curves), not just lines.

## New Parameters

Added to `ParametricParams`:

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `wireframeMode` | boolean | — | Enable wireframe lamp mode |
| `wireframeRibCount` | number | 4–24 | Number of vertical ribs |
| `wireframeRingCount` | number | 2–10 | Number of horizontal rings |
| `wireframeThickness` | number | 2–8 mm | Cross-section thickness of ribs/rings |
| `wireframeRibStyle` | enum | straight / curved / twisted | How ribs flow between rings |
| `wireframeMountRingHeight` | number | 3–15 mm | Height of top/bottom mounting rings |

## Architecture

### Files to modify:
1. **`src/types/parametric.ts`** — Add wireframe parameters to `ParametricParams`, defaults
2. **`src/components/3d/ParametricMesh.tsx`** — New geometry generation branch when `wireframeMode` is true: generate tube geometries along rib curves + torus rings instead of the solid body mesh
3. **`src/components/controls/ParameterControls.tsx`** — Add "Wireframe Lamp" section (visible when `shapeStyle === 'lamp'`) with the new sliders and toggle
4. **`src/lib/wireframe-lamp-generator.ts`** — New file: core geometry generation logic
5. **`src/lib/stl-export.ts`** — Add wireframe export path that generates the same rib/ring geometry for STL output

### Geometry generation approach (`wireframe-lamp-generator.ts`):

```text
For each vertical rib (i = 0..ribCount-1):
  angle = i * 2π / ribCount
  Sample body radius at N height points using getBodyRadius()
  Create a 3D curve: [(r*cos(θ), y, r*sin(θ)) for each height sample]
  Extrude a circular cross-section along this curve → TubeGeometry

For each horizontal ring (j = 0..ringCount-1):
  t = j / (ringCount - 1)
  Sample body radius at this height for all angles
  Create a closed 3D curve following the profile at height t
  Extrude circular cross-section → TubeGeometry

Top/bottom mounting rings:
  Same as horizontal rings but with larger cross-section
```

This reuses `getBodyRadius()` from `body-profile-generator.ts`, so all existing parametric deformations (twist, bulge, wobble, facets, etc.) automatically apply to the wireframe structure.

### Preview rendering:

When `wireframeMode` is true, `ParametricMesh` skips the solid body generation and instead renders the merged tube geometries. The existing material system applies normally.

### STL export:

A parallel code path in `stl-export.ts` detects `wireframeMode` and calls the same generator with `scale: 1` (mm units) instead of building the solid wall mesh.

## User experience

- User selects "Lamp" style
- New toggle appears: "Wireframe / Shade Frame Mode"
- When enabled, the solid body is replaced by the rib structure in the 3D preview
- All existing shape controls (profile curve, twist, bulge, etc.) continue to work — they now shape the ribs
- Socket mounting and legs still work normally
- Export produces printable rib structure

