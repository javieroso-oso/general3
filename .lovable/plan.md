

# Organic Wireframe Mode

## Idea

Add organic deformation options to the wireframe generator so ribs and rings look hand-bent, natural, or sculptural rather than perfectly geometric. Three approaches layered together:

1. **Rib noise displacement** — Each rib gets per-vertex noise displacement (radial + angular), making ribs wobble organically like bent wire or tree branches
2. **Ring irregularity** — Horizontal rings get noise-based radius variation so they aren't perfect circles — more like hand-formed wire loops
3. **Variable thickness** — Tube radius varies along each rib/ring using noise, creating thicker/thinner sections like hand-blown glass rods or natural branches

## New Parameters

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `wireframeOrganic` | number | 0–1 | Master organic intensity (0 = geometric, 1 = very organic) |
| `wireframeOrganicSeed` | number | 0–999 | Random seed for reproducible organic variation |
| `wireframeThicknessVariation` | number | 0–1 | How much tube thickness varies along length |

## Changes

### `src/types/parametric.ts`
Add the 3 new parameters + defaults.

### `src/lib/wireframe-lamp-generator.ts`
- Import the existing `noise2D`/`fbm2D` from `src/lib/plotter/noise.ts`
- **Rib generation**: After computing each rib point via `getSurfacePoint`, displace it radially and tangentially using noise seeded by rib index + height. Displacement magnitude = `wireframeOrganic * tubeRadius * 3`.
- **Ring generation**: After computing ring points, apply per-point radial noise displacement. Also jitter ring height slightly so rings aren't at perfectly even intervals.
- **Variable thickness**: When creating tubes, vary the radius per-segment using 1D noise along the curve. This means switching from single-radius `TubeGeometry` to a custom approach that samples radius at each step — or simpler: generate multiple short tube segments with slightly different radii.
- **Ring height jitter**: Offset each ring's t-value by `noise * wireframeOrganic * 0.05` so rings sit at slightly uneven heights.

### `src/components/controls/ParameterControls.tsx`
Add an "Organic" subsection inside the Shade Frame controls:
- Organic intensity slider (0–1)
- Seed number input
- Thickness variation slider (0–1)

## Implementation Detail: Variable Thickness

Rather than a complex custom geometry, the simplest effective approach: split each rib/ring curve into short segments, each with a slightly different tube radius derived from noise. This creates visible thickness variation with minimal code complexity. ~4-6 sub-segments per rib section is enough.

