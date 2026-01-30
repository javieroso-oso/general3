

# Fix: Unify Preview and Export Mesh Generation

## Problem Identified

The "bending" distortion in exported STLs happens because **the 3D preview and the STL export use completely different code paths** for calculating body shape:

| Component | Code Location | Uses Shared `getBodyRadius`? |
|-----------|---------------|------------------------------|
| 3D Preview | `ParametricMesh.tsx` lines 318-455 | ❌ NO - inline duplicate |
| STL Export | `stl-export.ts` → `getBodyRadius()` | ✅ YES |
| Mold Generator | `mold-generator.ts` | ✅ YES |
| Mold Preview | `MoldMesh.tsx` | ✅ YES |

The inline code in `ParametricMesh.tsx` has subtle differences from `getBodyRadius()`:
- Different noise coordinate calculations
- Different order of operations for some modifiers
- Duplicate lines at 381-387 (bug)
- Different handling of `effectiveTheta` vs `theta`

## Solution

Refactor `ParametricMesh.tsx` to use the shared `getBodyRadius()` function from `body-profile-generator.ts`, ensuring 100% parity between preview and export.

---

## Implementation Steps

### Step 1: Import the Shared Function
Add import to `ParametricMesh.tsx`:
```typescript
import { getBodyRadius } from '@/lib/body-profile-generator';
```

### Step 2: Replace Inline Radius Calculation
Replace the ~130 lines of inline radius calculation (lines 318-457) with a call to `getBodyRadius()`:

```typescript
for (let i = 0; i <= heightSegments; i++) {
  const t = i / heightSegments;
  const y = t * h;

  for (let j = 0; j <= segments; j++) {
    const baseTheta = (j / segments) * Math.PI * 2;
    
    // Use shared getBodyRadius for consistency with STL export
    const r = getBodyRadius(params, t, baseTheta, {
      scale: SCALE,        // Scene units (0.01)
      includeTwist: true,  // Apply twist inside getBodyRadius
      objectType: params.shapeStyle,
    });

    // Calculate final theta with twist for vertex positioning
    const twistRad = (twistAngle * Math.PI / 180) * t;
    const theta = baseTheta + twistRad;
    
    // Calculate vertex position
    let x = Math.cos(theta) * r;
    let z = Math.sin(theta) * r;
    let finalY = y;
    
    // ... continue with spine, melt, rim waves, etc.
  }
}
```

### Step 3: Keep Post-Radius Modifiers
These effects are applied AFTER radius calculation and remain in `ParametricMesh.tsx`:
- **Spine-based positioning** (lines 467-493)
- **Melt effect** (lines 498-531)
- **Rim waves** (lines 534-541)

These are positional offsets, not radius modifiers, so they stay separate.

### Step 4: Fix Duplicate Lines Bug
Remove the duplicate lines 385-387 that appear to be copy-paste errors.

### Step 5: Update Export for Parity
Ensure `stl-export.ts` also handles post-radius modifiers (melt, rim waves) consistently with the preview.

---

## Technical Details

### What Gets Removed from ParametricMesh.tsx
- Profile curve switch statement (lines 322-354)
- Organic bulge (lines 356-358)
- Pinch effect (lines 360-363)
- Lip flare (lines 365-369)
- Horizontal ribs (lines 371-379)
- Wobble (lines 408-412)
- Ripples (lines 414-418)
- Fluting (lines 420-429)
- Spiral grooves (lines 432-439)
- Asymmetry (lines 441-447)
- Organic noise (lines 449-455)
- Faceting logic (lines 392-404)

All of these are already correctly implemented in `getBodyRadius()`.

### What Stays in ParametricMesh.tsx
- Spine frame positioning (uses `spineFrames[i].position`)
- Melt vertical offset and drag
- Rim wave Y offset
- Bottom radii capture for base disc
- Overhang color calculation
- All mesh construction (vertices, indices, faces)

---

## Files to Modify

1. **`src/components/3d/ParametricMesh.tsx`**
   - Import `getBodyRadius` from shared utility
   - Replace inline radius calculation with function call
   - Remove duplicate lines 385-387
   - Keep spine/melt/rim modifiers

2. **`src/lib/stl-export.ts`** (if needed)
   - Verify melt and rim wave handling matches preview
   - Currently looks correct but should be verified

---

## Verification Plan

After implementation:
1. Create a shape with organic noise enabled
2. Verify preview looks correct
3. Export to STL
4. Open in a slicer (e.g., PrusaSlicer, Cura)
5. Compare shape to preview - should be identical
6. Test with various modifiers: asymmetry, ripples, twist, etc.

---

## Risk Assessment

**Low risk** - This is a refactor to use existing, tested code:
- `getBodyRadius()` is already used by molds, plotter, and STL export
- We're removing duplicate code, not adding new functionality
- Post-radius modifiers (melt, spine, rim) remain unchanged

