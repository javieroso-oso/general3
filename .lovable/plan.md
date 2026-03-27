# Limit Kiosk Object Size for Faster Printing

## Current State

The exhibit safety clamp already caps `height` at 180mm and `baseRadius` at 60mm. At those sizes, a spiral-vase print can still take 45–60+ minutes.

## Proposal

Tighten the size constraints and add a `topRadius` cap so kiosk prints finish in ~15–20 minutes:


| Parameter    | Current Limit | New Limit | Rationale                                            |
| ------------ | ------------- | --------- | ---------------------------------------------------- |
| `height`     | 180mm         | 100mm     | Halves print time roughly proportionally             |
| `baseRadius` | 60mm          | 40mm      | Smaller footprint, faster perimeters                 |
| `topRadius`  | uncapped      | 45mm      | Prevent wide flared tops that slow down upper layers |


## Changes

### `src/pages/Index.tsx`

In `exhibitSafeParams`, update the three clamps:

```
height: Math.min(p.height, 100),
baseRadius: Math.min(p.baseRadius, 40),
topRadius: Math.min(p.topRadius, 45),
```

### `src/lib/random-generator.ts`

In `generateExhibitRandomParams`, tighten the random ranges to match:

- Height: random between 60–100 (was likely up to 180)
- Base radius: random between 20–40
- Top radius: random between 15–45

### `src/components/controls/ParameterControls.tsx`

In exhibit mode, cap the slider `max` values for height, baseRadius, and topRadius so visitors can't drag past the limits.

## Result

Objects stay compact (roughly palm-sized) and print in ~15–20 minutes on a standard printer with spiral vase mode.