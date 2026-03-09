

# Plotter Preview Color Controls

## What It Does
Add controls to customize how the plotter preview is rendered — stroke color, background color (paper simulation), stroke width, and optional multi-pen color assignment by layer. This is purely for visualization; exported SVG/G-code stays as-is (or optionally uses the chosen colors).

## New Parameters

Add to `PlotterParams` in `src/types/plotter.ts`:

```
previewColors: {
  strokeColor: string;      // Default '#000000' — main pen color
  backgroundColor: string;  // Default '#ffffff' — paper color
  strokeWidth: number;       // 0.2–2.0, default 0.5
  paperTint: string;         // Preset: 'white', 'cream', 'kraft', 'black' (for white-ink look)
  multiPen: boolean;         // Assign colors by layer index
  penColors: string[];       // Array of pen colors for multi-pen mode
}
```

## Changes

### 1. `src/types/plotter.ts`
- Add `PlotterPreviewColors` interface with the fields above
- Add `previewColors` to `PlotterParams`
- Add defaults

### 2. `src/components/plotter/PlotterPreview.tsx`
- Accept `previewColors` from props or drawing params
- Use `backgroundColor` for SVG background and paper rect fill
- Use `strokeColor` / `strokeWidth` as defaults for paths
- In multi-pen mode, cycle through `penColors` array based on `path.layer`

### 3. `src/components/plotter/PlotterControls.tsx`
- Add a "Preview Colors" accordion section with:
  - Paper preset buttons (White, Cream, Kraft, Black)
  - Stroke color input (HTML color picker)
  - Stroke width slider (0.2–2.0)
  - Multi-pen toggle + color swatches (up to 4 pens)

### 4. `src/lib/plotter/export.ts`
- In `generateSVG`, optionally use preview colors for the exported SVG stroke colors (controlled by a flag)

## Paper Presets
| Name  | Background | Default Stroke |
|-------|-----------|---------------|
| White | #ffffff   | #000000       |
| Cream | #f5f0e1   | #1a1a1a       |
| Kraft | #c4a882   | #2d1f10       |
| Black | #1a1a1a   | #ffffff       |

