

# Kiosk Mode: Simplified Controls for Spiral Vase Printing

## Concept

In exhibit/kiosk mode, visitors only see controls that affect the shape's form — no construction, no accessories, no advanced print features. The shape is always configured for spiral vase mode (single wall, no infill, no supports), so everything prints without errors.

## What Changes

### 1. `src/components/controls/ParameterControls.tsx`
- Accept new prop `exhibitMode?: boolean`
- When `exhibitMode` is true, **only show** these sections:
  - **Dimensions**: height, baseRadius, topRadius (hide wallThickness or lock it to 1.6mm)
  - **Shape**: bulge, pinch, asymmetry, twist, profile curve + Advanced Shape subsection (wobble, spine, melt)
  - **Textures**: faceting, spiral grooves, horizontal ribs, fluting (hide organic noise subsection to keep it simple)
  - **Lip & Rim**: lip flare, lip height, rim waves
  - **Randomize button** (keep it — visitors love it)
- **Hide entirely**: Shade Frame, Light Patterns, Cord Hole, Legs/Stand, Base Plate, Surface Art, Ceramic Mold, Support-Free toggle, Base settings

### 2. `src/pages/Index.tsx`
- Pass `exhibitMode={isExhibitMode}` to `ParameterControls`
- When exhibit mode is on:
  - Force spiral-vase-compatible params on load: `wallThickness: 1.6`, `addLegs: false`, `cordHoleEnabled: false`, `wireframeMode: false`, `lightPatternEnabled: false`, `moldEnabled: false`, `basePlateEnabled: false`, `supportFreeMode: false`, `surfaceStrokes: []`
  - Hide the Print, Batch, Presets, Drawer tabs — only show the Design tab
  - Hide G-code view mode toggle in bottom bar
  - Keep material/color picker and auto-rotate in bottom bar (visual only, fun for visitors)

### 3. Wall Thickness Constraint
- In exhibit mode, wall thickness is fixed at 1.6mm (good for spiral vase with 0.4mm nozzle)
- Not shown as a slider — just set internally
- baseThickness set to 0 (spiral vase handles the base)

## Files

| File | Change |
|------|--------|
| `src/components/controls/ParameterControls.tsx` | Add `exhibitMode` prop, conditionally render sections |
| `src/pages/Index.tsx` | Pass prop, force vase-safe defaults, simplify tabs & bottom bar in exhibit mode |

## Result
Visitor sees: Dimensions + Shape + Textures + Lip/Rim + Randomize button. That's it. Every shape they create will print successfully in spiral vase mode.

