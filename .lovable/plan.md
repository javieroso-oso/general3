# Stackable Shapes v2 — Non-Circular Rims

Replace the forced-circle rim with a **silhouette-matched end profile**. The bottom cross-section of the shape (its full angular silhouette: lobes, ribs, fluting, ripples, facets, faceting, base curve…) is sampled once, then re-applied at the top through a short blend zone, so the two openings have **identical silhouettes** — no circle required, no visible "rim" added.

Two pieces stack physically when their bottom silhouettes match (same controlling params).

## Concept

```text
   ┌─ top opening  = silhouette(theta)  ─┐
   │  ▲ blends to end-profile (last ~5%) │
   │                                     │
   │   body free to bulge, twist, etc.   │
   │                                     │
   │  ▼ blends to end-profile (first ~5%)│
   └─ bottom opening = silhouette(theta) ┘
```

## Changes

### 1. End-profile sampling (`src/lib/body-profile-generator.ts`)
- Add `getEndProfileRadius(params, theta)` — computes the radius at `t = 0` with twist disabled and any t-multiplied modifier neutralized (asymmetry's vertical lean, pinch-top, lip-flare). It uses the user's actual lobes, ripples, ribs, fluting, facets, base radius, profile curve — i.e. the design's natural bottom silhouette.
- In `getBodyRadius`, when `stackable` is on:
  - Drop the circular rim clamp (no more forcing `baseRadius = topRadius = rim/2`).
  - At the end blend zones (`t < collarFrac` or `t > 1 - collarFrac`) blend the computed radius toward `getEndProfileRadius(params, thetaForBlend)` using smoothstep.
  - `thetaForBlend` removes twist so the two ends line up rotationally even if the body is twisted in between.

### 2. Twist & asymmetry policy (Stackable on)
Allow them but auto-clamp so stacking still works:
- **Twist**: snap to nearest multiple of `360° / N`, where `N = max symmetry order of the rim` (gcd of lobeCount, facetCount, rippleCount, flutingCount; defaults to 1 → snap to 360° multiples). Show a hint: "Twist snapped to 360° to keep stack alignment."
- **Asymmetry**: cap at `0.05` and zero out its vertical-lean term inside the blend zones so the rim stays flat.
- **Spine offset (lateral)**: forced to 0 inside the blend zones so the top opening sits centered over the bottom.

### 3. Remove rim-diameter UI (`src/components/controls/ParameterControls.tsx`)
- Drop "Rim Diameter" slider.
- Keep "Blend Zone Height" slider (1–10 mm, renamed from "Collar Height") — controls how gradually the body resolves into the matched silhouette at each end.
- Keep the explanation chip — update text:
  > "Mirrors the bottom silhouette to the top so any two pieces with the same shape settings stack flush. Disables lip flare, melt, flat bottom, base plate, and centering lip. Twist snaps to full turns; asymmetry capped at 5%."

### 4. Params (`src/types/parametric.ts`)
- Keep `stackable: boolean`, `stackRimCollarHeight` (rename in comments to "blend zone height", keep field for save compatibility).
- **Remove** runtime use of `stackRimDiameter` (keep field for back-compat — ignored when stackable is on).

### 5. Stack-compatibility hash (validation)
- Add `computeRimSignature(params)` → short string hash of the params that determine the end profile (baseRadius, profileCurve, lobeCount/blend, rippleCount/depth, fluting, facets, horizontalRibs evaluated at t=0, etc.).
- Show it in the Stacking section: `Stack key: A7F3` so the user can eyeball-match it across saved pieces; matching keys = pieces stack.

### 6. Files touched
- `src/lib/body-profile-generator.ts` — `getEndProfileRadius` + new blend logic + twist/asymmetry/spine handling under stackable.
- `src/components/controls/ParameterControls.tsx` — drop rim-diameter slider, rename collar, add stack-key chip.
- `src/types/parametric.ts` — keep fields, add `computeRimSignature` helper.

## Out of scope
- Surface drawings (`surfaceStrokes`) on the end caps — they're treated like any other deformation already; if a user draws across the rim it will show on both ends after mirroring, which is the intended behavior.
- Mechanical interlock / lips / dovetails.
- Cross-shape stacking with different lobe counts (the hash will simply not match).
