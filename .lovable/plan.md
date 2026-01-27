

# Shape-Influenced Line Fill Mode

## What You Want
Fill the entire page with lines (horizontal, vertical, or at an angle) that **curve and bend** as they pass through or near your 3D shape - like the object is distorting a field of parallel lines around it.

## Visual Concept

```text
Normal parallel lines:     Shape-distorted lines:
─────────────────          ────────╭────────
─────────────────          ───────╭ ╮───────
─────────────────          ──────(   )──────
─────────────────          ───────╰ ╯───────
─────────────────          ────────╰────────
```

The lines wrap around the silhouette of your lamp/vase, creating a beautiful interplay between geometric order and organic form.

---

## New Projection Type: "Line Field"

Add a fourth projection type alongside the existing three:

| Type | Description |
|------|-------------|
| Cross-Section | Slices at multiple heights |
| Silhouette | Outer boundary outline |
| Contour Stack | Layered slices with offset |
| **Line Field** *(new)* | Full-page lines distorted by shape |

---

## Line Field Settings

| Setting | Description | Range |
|---------|-------------|-------|
| **Line Count** | How many lines fill the page | 10-100 |
| **Line Angle** | Direction of lines (0°=horizontal, 90°=vertical) | 0-180° |
| **Distortion Strength** | How much the shape bends the lines | 0-2 |
| **Distortion Falloff** | How far the distortion reaches | 0.5-3 |
| **Wrap Mode** | How lines interact with shape: `around` (flow around), `through` (distort through center), `outline` (trace the edge) | selection |
| **Line Extension** | Extend lines beyond paper edges for cleaner edge treatment | toggle |

---

## How It Works

### Algorithm: Shape Field Distortion

1. **Project the 3D shape to 2D** (same as silhouette mode - uses view angle)
2. **Sample the shape boundary** to create a distance field
3. **Generate base lines** spanning the page at the chosen angle and spacing
4. **For each point on each line:**
   - Calculate distance to nearest point on shape boundary
   - Calculate the direction to push the point (perpendicular to shape surface)
   - Apply distortion based on distance and strength settings
5. **Output curved paths** that flow around the shape

### Distortion Modes

**Around Mode:**
Lines curve to flow around the outside of the shape, never crossing inside. Creates a "force field" effect.

**Through Mode:**
Lines pass through the shape but distort/compress as they do. Creates a "lens" or "gravity well" effect.

**Outline Mode:**
Lines trace the edge when they hit the shape boundary, then continue on the other side. Creates a "contour emphasis" effect.

---

## Implementation

### Type Changes (`src/types/plotter.ts`)

```typescript
// Add new projection type
export type ProjectionType = 'crossSection' | 'silhouette' | 'contourStack' | 'lineField';

// Add line field parameters to ProjectionParams
export interface ProjectionParams {
  // ... existing fields ...
  
  // Line field settings
  lineFieldCount: number;        // 10-100
  lineFieldAngle: number;        // 0-180 degrees
  lineFieldStrength: number;     // 0-2 distortion multiplier
  lineFieldFalloff: number;      // 0.5-3 distance falloff
  lineFieldMode: 'around' | 'through' | 'outline';
  lineFieldExtend: boolean;      // extend lines past paper edges
}
```

### Generator Function (`src/lib/plotter/projection.ts`)

New function: `generateLineField(options: ProjectionOptions): PlotterDrawing`

**Algorithm outline:**
1. Generate silhouette boundary points (reuse existing code)
2. Create distance field by sampling boundary
3. For each line from edge to edge:
   - Start at left/top edge (based on angle)
   - Step along the line direction
   - At each step, calculate distortion from shape proximity
   - Offset the point perpendicular to line direction
   - Collect all points into a path
4. Return all line paths

### UI Controls (`src/components/plotter/PlotterControls.tsx`)

Add new controls when `lineField` projection type is selected:
- Line Count slider
- Line Angle slider with visual indicator
- Distortion Strength slider
- Falloff Distance slider
- Wrap Mode selector (Around / Through / Outline)
- Extend Lines toggle

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/plotter.ts` | Add `'lineField'` to `ProjectionType`, add line field params to `ProjectionParams` and defaults |
| `src/lib/plotter/projection.ts` | Add `generateLineField()` function, update `generateProjection()` dispatcher |
| `src/components/plotter/PlotterControls.tsx` | Add Line Field option to projection type selector, add line field controls |

---

## User Flow

1. Design your shape in the Shape tab
2. Switch to Plotter tab
3. Select "3D Projection" mode
4. Choose "Line Field" projection type
5. Adjust line count, angle, and distortion settings
6. See the full-page lines curve around your design
7. Export to SVG or G-code

---

## Visual Examples

**Horizontal lines around a vase:**
```text
─────────────────────────────
────────────╭─────╮──────────
───────────╱       ╲─────────
──────────╱         ╲────────
──────────│         │────────
──────────│         │────────
──────────╲         ╱────────
───────────╲       ╱─────────
────────────╰─────╯──────────
─────────────────────────────
```

**Diagonal lines through shape (lens effect):**
```text
╲   ╲   ╲   ╲   ╲   ╲   ╲   ╲
 ╲   ╲   ╲   ╲   ╲   ╲   ╲   ╲
  ╲   ╲   ╲╲ ╱╱   ╲   ╲   ╲
   ╲   ╲ ╲  │  ╱ ╱   ╲   ╲
    ╲   ╲   │   ╱   ╱   ╲
     ╲   ╱  │  ╲   ╱   ╲
      ╲╱╱   │   ╲╲╱   ╲
       ╲    │    ╱   ╲
        ╲   │   ╱   ╲
```

