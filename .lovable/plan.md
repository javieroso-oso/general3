

## Plotter Workflow Simplification Plan

### Current Problems

1. **Confusing design capture flow**: Users must design in Vase/Lamp/Sculpture tab, then switch to Plotter, then switch to "3D Projection" mode, then optionally click "Capture Design". Too many steps.

2. **Redundant object types for plotter use**: Vase, Lamp, and Sculpture share 95% of the same parametric controls. For 2D plotting, there's no functional difference between them.

3. **Invisible plotter tab**: The inactive tab text color (`text-text-secondary`) has poor contrast against the light background.

---

### Proposed Solution

#### Option A: Streamlined Dual-Mode Interface (Recommended)

Simplify to two main tabs:
- **Shape** - Design your 3D parametric form (combines Vase/Lamp/Sculpture)
- **Plotter** - Convert shape to 2D art OR use generative patterns

The plotter automatically uses the current shape parameters in real-time when in projection mode. No "capture" step needed.

#### Option B: Keep Current Tabs, Fix UX

Keep Vase/Lamp/Sculpture/Plotter but:
- Auto-sync the 3D design to plotter projection (no capture button)
- Live preview of projection updates as you switch tabs
- Fix visibility issues

---

### Recommended Implementation: Option A

#### 1. Merge Object Types

Combine Vase, Lamp, and Sculpture into a single "Shape" type with a sub-selector for specialized features:

```text
[Shape]  [Plotter]
    |
    v
Shape Mode: [Vase] [Lamp] [Sculpture]
(Only affects 3D-specific features like sockets/stands)
```

#### 2. Live Projection Sync

Remove the "Capture Design" mechanism. Instead:
- Plotter projection always uses current `params`
- When user edits shape parameters, projection updates immediately
- Shape params are passed directly to plotter components

#### 3. Fix Tab Visibility

Update `ObjectTypeTabs.tsx` to use higher contrast colors:

```css
/* Change from text-text-secondary to text-muted-foreground */
activeType !== tab.type ? 'text-muted-foreground hover:text-foreground'
```

---

### File Changes

| File | Changes |
|------|---------|
| `src/types/parametric.ts` | Add `shapeStyle: 'vase' | 'lamp' | 'sculpture'` to `ParametricParams`. Simplify `ObjectType` to `'shape' | 'plotter'` |
| `src/components/controls/ObjectTypeTabs.tsx` | Reduce to 2 tabs: Shape, Plotter. Fix text contrast. |
| `src/pages/Index.tsx` | Remove `last3DParams`/`last3DObjectType` capture logic. Pass live `params` to plotter. Add shape style selector in left panel. |
| `src/components/plotter/PlotterControls.tsx` | Remove capture button. Simplify props since live params always available. |
| `src/hooks/usePlotterDrawing.ts` | Update to use live params directly instead of captured mesh. |
| `src/lib/plotter/projection.ts` | No changes needed - already uses `ParametricParams`. |

---

### New User Flow

1. Open app → **Shape** tab is active
2. Design your form using all parametric controls
3. Optional: Select shape style (Vase/Lamp/Sculpture) for specialized 3D features
4. Click **Plotter** tab
5. Choose mode: Generative OR 3D Projection
6. In projection mode, see your shape sliced immediately
7. Adjust projection settings (slice count, view angle, projection type)
8. Export SVG/G-code

---

### Visual Changes

**Tab Bar**
```text
Before: [Vase] [Lamp] [Sculpture] [Plotter]
After:  [Shape] [Plotter]
```

**Plotter Panel (Projection Mode)**
```text
Before:
  [Capture Current Design] button
  "Captured: vase" label
  (stale data until re-captured)

After:
  Live preview synced to current shape
  Direct projection controls
  No capture step needed
```

---

### Technical Details

**Simplified Type Structure**

```typescript
// parametric.ts
export type ObjectType = 'shape' | 'plotter';

export interface ParametricParams {
  // Existing shape params...
  height: number;
  baseRadius: number;
  // etc...
  
  // New: which 3D style to apply
  shapeStyle: 'vase' | 'lamp' | 'sculpture';
}
```

**Live Projection in Index.tsx**

```typescript
// No more capture state
// const [last3DObjectType, setLast3DObjectType] = useState(...)
// const [last3DParams, setLast3DParams] = useState(...)

// Just pass current params to plotter
<PlotterControls
  params={plotterParams}
  drawing={plotterDrawing}
  onParamsChange={setPlotterParams}
  meshParams={params}  // Live, always current
  shapeStyle={params.shapeStyle}  // For projection
/>
```

**PlotterControls Changes**

```typescript
// Remove capture functionality
// const captureCurrentDesign = useCallback(() => {...}, []);

// Direct access to live params
interface PlotterControlsProps {
  params: PlotterParams;
  drawing: PlotterDrawing | null;
  onParamsChange: (params: PlotterParams) => void;
  meshParams: ParametricParams;  // Always live
  shapeStyle: 'vase' | 'lamp' | 'sculpture';
}
```

---

### Benefits

1. **Clearer mental model**: Shape = what you're making, Plotter = how to draw it
2. **Fewer clicks**: No capture step, instant projection preview
3. **Live updates**: Edit shape → see projection change in real-time (when switching back to plotter)
4. **Better discoverability**: "Plotter" tab is more prominent with only 2 tabs
5. **Future-proof**: Easy to add more shape styles without cluttering the tab bar

