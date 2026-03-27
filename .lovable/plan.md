

# Fix: Disable Rim Waves in Exhibit Mode

## Problem
Rim waves create a non-monotonic Z top edge, which breaks spiral vase printing. Currently:
1. The exhibit-safe randomizer can randomly enable rim waves
2. The rim wave sliders are visible in kiosk mode UI
3. The safety enforcement function doesn't zero out `rimWaveCount`/`rimWaveDepth`

## Fix

### 1. `src/lib/random-generator.ts`
Remove `'rimWaves'` from the exhibit feature pool so the randomizer never picks it.

### 2. `src/pages/Index.tsx`
Add `rimWaveCount: 0, rimWaveDepth: 0` to the `exhibitSafeParams` enforcement function.

### 3. `src/components/controls/ParameterControls.tsx`
Hide the "Rim Waves" subsection when `exhibitMode` is active.

| File | Change |
|------|--------|
| `src/lib/random-generator.ts` | Remove `rimWaves` from exhibit feature pool |
| `src/pages/Index.tsx` | Zero `rimWaveCount`/`rimWaveDepth` in safety clamp |
| `src/components/controls/ParameterControls.tsx` | Hide rim wave controls in exhibit mode |

