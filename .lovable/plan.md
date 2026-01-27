

## Enhanced Plotter Generator with 3D-to-2D Projection

### What We're Building
Transform your 3D lamp designs into beautiful 2D plotter art by adding a **3D Projection mode** that creates cross-section contours, silhouettes, and stacked slice drawings from your parametric objects.

### Current Situation
The plotter currently only generates abstract patterns (flow fields, spirals, waves). There's no way to connect it to your existing 3D designs.

### Solution Overview

**Add three input modes to the plotter:**
1. **Generative** (existing) - Abstract patterns like flow fields, spirals
2. **3D Projection** (new) - Convert your lamps/vases/sculptures to 2D line art
3. **Image** (future) - Convert photos to hatched/stippled drawings

---

### Mode 1: 3D Projection Types

**Cross-Section Slices**
- Slice your 3D object horizontally at multiple heights
- Each slice becomes a closed contour path
- Stacked slices create a topographic-style drawing
- Great for visualizing organic deformations

**Silhouette Outline**
- Extract the outer edge of your object from a specific view angle
- Single continuous path showing the profile
- Adjustable rotation to capture different angles

**Contour Stack**
- Similar to cross-sections but rendered with visual offset
- Creates a 3D layered effect on paper
- Spacing and overlap controls

---

### New UI Controls

**Mode Selection**
- Tabs at top: Generative | 3D Projection
- Clear visual separation between modes

**3D Projection Settings**
- **Source Design**: Shows current parametric params preview
- **Projection Type**: Cross-Section / Silhouette / Contour Stack
- **Slice Count**: 5-50 horizontal slices
- **View Rotation**: Rotate the 3D object before projection
- **Scale**: Fit to paper size
- **Line Density**: How detailed the contours are

**Design Sync**
- Button to "Capture Current Design" from your 3D editor
- The plotter remembers the 3D params you were working on
- Switch between Plotter and Vase/Lamp tabs while keeping your design

---

### Technical Implementation

**New File: `src/lib/plotter/projection.ts`**
- `generateCrossSectionSlices()` - Use existing `getBodyRadius()` to sample contours at each height
- `generateSilhouette()` - Project 3D points to 2D from a view angle
- `generateContourStack()` - Cross-sections with visual offset

**Update: `src/hooks/usePlotterDrawing.ts`**
- Add projection mode detection
- Call projection generators when mode is 'projection'
- Pass through parametric params from the 3D editor

**Update: `src/components/plotter/PlotterControls.tsx`**
- Add mode tabs (Generative | 3D Projection)
- Add projection-specific sliders and controls
- Add "Capture Design" button

**Update: `src/pages/Index.tsx`**
- Pass current 3D params to plotter controls
- Allow syncing between 3D design and plotter projection

---

### User Experience Flow

1. Design a lamp in the Lamp tab with your preferred shape
2. Switch to Plotter tab
3. Click "Capture Current Design" or it auto-syncs
4. Select "3D Projection" mode
5. Choose "Cross-Section Slices" projection type
6. Adjust slice count, view angle, scale
7. See 2D preview update in real-time
8. Export to SVG or G-code for your plotter

---

### Visual Preview

The plotter preview will show:
- Paper bounds with margins
- All contour paths from the sliced 3D object
- Optional layer numbers or colors per slice
- Path statistics (total distance, estimated plot time)

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/plotter/projection.ts` | Create - Core 3D-to-2D algorithms |
| `src/hooks/usePlotterDrawing.ts` | Modify - Add projection mode |
| `src/components/plotter/PlotterControls.tsx` | Modify - Add mode tabs and projection controls |
| `src/pages/Index.tsx` | Modify - Sync 3D params to plotter |
| `src/types/plotter.ts` | Modify - Add captured 3D params to PlotterParams |

---

### Technical Details

**Cross-Section Algorithm**
```text
For each slice height (0 to object height):
  1. Sample getBodyRadius() at 64+ angles around the circumference
  2. Convert polar coordinates (radius, angle) to cartesian (x, y)
  3. Center on paper and apply scale
  4. Create closed path from the sampled points
  5. Add to drawing paths array
```

**Silhouette Algorithm**
```text
1. Apply rotation matrix based on view angle
2. Project all mesh vertices to 2D
3. Find convex hull or edge detection
4. Trace the outer boundary as a single path
```

**Scale Fitting**
```text
1. Calculate bounding box of all projected points
2. Compute scale factor to fit within paper margins
3. Apply uniform scale to preserve proportions
```

