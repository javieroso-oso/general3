

# Kiosk Mode: Spiral Vase Safety Audit

## Problems Found

1. **Melt effect** shifts vertices downward — breaks spiral vase's monotonic Z requirement
2. **Lateral drag** shifts vertices sideways — creates extreme overhangs
3. **Spine curve** bends shape off-center — overhangs on one side
4. **Randomizer** can re-enable all three after the vase-safe `useEffect` runs
5. **Wobble/asymmetry** sliders have no exhibit-mode limits — visitors can push them to overhang-inducing extremes
6. **Organic noise** is hidden in UI but not forced to 0 — randomizer can set it (20% chance)

## Solution

### 1. Force-disable dangerous features on every param change in exhibit mode

**`src/pages/Index.tsx`** — Update the exhibit mode `useEffect` to also zero out:
- `meltAmount: 0`, `meltDragAmount: 0`
- `spineEnabled: false`, `spineAmplitudeX: 0`, `spineAmplitudeZ: 0`
- `organicNoise: 0`

### 2. Hide dangerous controls in exhibit mode

**`src/components/controls/ParameterControls.tsx`** — In the "Advanced Shape" subsection:
- Hide Melt Effect entirely when `exhibitMode`
- Hide Lateral Drag entirely when `exhibitMode`
- Hide Spine Curve entirely when `exhibitMode`
- Keep Wobble but cap max amplitude to 0.05

### 3. Create exhibit-safe randomizer

**`src/lib/random-generator.ts`** — Add `generateExhibitRandomParams()` function:
- No melt, no drag, no spine, no organic noise
- Cap wobble amplitude to 0.05
- Cap asymmetry to 0.08
- Cap lipFlare to 0.10
- Cap bulge to 0.15
- Ensure height isn't extreme (60–180mm)
- Ensure radii ratio stays reasonable (top/base between 0.5–1.2)
- Force wallThickness: 1.6, baseThickness: 0

### 4. Use exhibit-safe randomizer in kiosk mode

**`src/pages/Index.tsx`** — When randomize is called in exhibit mode, use `generateExhibitRandomParams()` instead of `generateRandomParams()`

### 5. Continuous enforcement

**`src/pages/Index.tsx`** — Add a guard in `setParams` wrapper: when in exhibit mode, clamp/zero dangerous values on *every* param update, not just on mode entry. This prevents any path (randomizer, undo, etc.) from setting unsafe values.

## Files

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Expanded force-reset, exhibit-safe randomizer call, continuous param clamping |
| `src/components/controls/ParameterControls.tsx` | Hide melt/drag/spine in exhibit mode, cap wobble/asymmetry sliders |
| `src/lib/random-generator.ts` | Add `generateExhibitRandomParams()` with safe limits |

## Safe Parameter Limits for Exhibit Mode

| Parameter | Normal Max | Exhibit Max | Reason |
|-----------|-----------|-------------|--------|
| meltAmount | 30 | **0 (disabled)** | Breaks monotonic Z |
| meltDragAmount | 30 | **0 (disabled)** | Extreme overhangs |
| spineEnabled | true | **false** | Off-center overhangs |
| organicNoise | 0.1 | **0 (disabled)** | Surface irregularities |
| wobbleAmplitude | 0.15 | **0.05** | Mild overhangs at high values |
| asymmetry | 0.35 | **0.08** | Overhangs on one side |
| lipFlare | 0.5 | **0.10** | Top overhang |
| bulgeAmount | 0.5 | **0.15** | Mid-body overhang |
| height | 300 | **180** | Practical print time |
| baseRadius | 80 | **60** | Bed size constraint |

