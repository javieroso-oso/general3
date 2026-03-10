

# Fix: Spine-Based Geometry Discrepancy Between Preview and Export

## Root Cause Identified

The "bending" distortion in exported STLs is caused by **fundamentally different spine handling** between the preview and export code paths:

| Aspect | Preview (`ParametricMesh.tsx`) | Export (`stl-export.ts`) |
|--------|--------------------------------|--------------------------|
| **Spine Mode** | Simple lateral offset | Full Frenet frame rotation |
| **Cross-sections** | Stay horizontal | Rotate with curve tangent |
| **Visual Effect** | Elegant S-curves, shape unchanged | Cross-sections tilt and distort |
| **Rim Waves** | Applied correctly | **MISSING** in `generateBodyMesh` |

### The Technical Problem

**Preview (lines 306-317):**
```typescript
// SPINE-BASED: Simple lateral offset without Frenet rotation
const localX = Math.cos(theta) * r;
const localZ = Math.sin(theta) * r;
x = localX + frame.position.x;  // Just add position offset
z = localZ + frame.position.z;
finalY = frame.position.y;
```

**Export (lines 274-282):**
```typescript
// SPINE-BASED: Position vertex using Frenet frame
const localX = Math.cos(theta);
const localZ = Math.sin(theta);
// Uses normal/binormal to ROTATE the cross-section
x = frame.position.x + frame.normal.x * localX * r + frame.binormal.x * localZ * r;
finalY = frame.position.y + frame.normal.y * localX * r + frame.binormal.y * localZ * r;
z = frame.position.z + frame.normal.z * localX * r + frame.binormal.z * localZ * r;
```

The export uses Frenet frame rotation which rotates each cross-section to be perpendicular to the spine tangent. This causes the "bending" distortion where circles become ellipses tilted along the curve.

### Additional Issue: Missing Rim Waves

The `generateBodyMesh` function in `stl-export.ts` **does NOT apply rim wave effects** after computing vertices, unlike the preview which adds rim waves at lines 372-380.

---

## Solution

### Step 1: Fix Spine Handling in STL Export

Update `generateBodyMesh()` in `stl-export.ts` to use **simple lateral offset** (matching preview) instead of Frenet frame rotation.

**Before:**
```typescript
if (useSpine && spineFrames[i]) {
  const frame = spineFrames[i];
  const localX = Math.cos(theta);
  const localZ = Math.sin(theta);
  
  x = frame.position.x + frame.normal.x * localX * r + frame.binormal.x * localZ * r;
  finalY = frame.position.y + frame.normal.y * localX * r + frame.binormal.y * localZ * r;
  z = frame.position.z + frame.normal.z * localX * r + frame.binormal.z * localZ * r;
}
```

**After:**
```typescript
if (useSpine && spineFrames[i]) {
  // SPINE-BASED: Simple lateral offset without Frenet rotation
  // Cross-sections stay horizontal, only position shifts along the curved path
  // This matches the preview behavior in ParametricMesh.tsx
  const frame = spineFrames[i];
  const localX = Math.cos(theta) * r;
  const localZ = Math.sin(theta) * r;
  
  x = localX + frame.position.x;
  z = localZ + frame.position.z;
  finalY = frame.position.y;
}
```

### Step 2: Add Missing Rim Wave Effects

Add rim wave Y-offset to `generateBodyMesh()` after melt effects:

```typescript
// After melt effect block, add:
// Rim waves: modify Y position for top rows (matches ParametricMesh.tsx)
const { rimWaveCount, rimWaveDepth } = params;
if (rimWaveCount > 0 && rimWaveDepth > 0) {
  const rimZone = 0.1; // Top 10% of height
  const rimT = Math.max(0, (t - (1 - rimZone)) / rimZone);
  if (rimT > 0) {
    const waveOffset = Math.sin(theta * rimWaveCount) * rimWaveDepth * height * rimT;
    finalY += waveOffset;
  }
}
```

### Step 3: Apply Same Fix to Inner Wall Vertices

The inner wall generation (lines 322-381) has the same Frenet frame issue and also lacks rim waves. Apply identical fixes there.

---

## Files to Modify

1. **`src/lib/stl-export.ts`**
   - Lines 274-282: Change Frenet frame rotation to simple lateral offset (outer wall)
   - Lines 335-343: Change Frenet frame rotation to simple lateral offset (inner wall)
   - Lines 316-318: Add rim wave effect (after melt, before push to outerVerts)
   - Lines 376-378: Add rim wave effect (after melt, before push to innerVerts)

---

## Technical Details

### Why Frenet Frame Causes Distortion

The Frenet frame consists of three orthonormal vectors at each point on the curve:
- **Tangent (T)**: Direction of travel along curve
- **Normal (N)**: Points toward center of curvature  
- **Binormal (B)**: T × N

When you position cross-section vertices using `normal * x + binormal * z`, you're rotating the circle to lie in a plane perpendicular to the tangent. This works well for tubes (like pipes), but for vases/lamps it creates unwanted distortion because the "top" and "bottom" of the object tilt with the curve.

The preview's approach of simple lateral offset (`position.x + localX`, `position.z + localZ`) keeps cross-sections horizontal (parallel to ground), which is what users expect for vases/lamps.

### Rim Wave Formula (matching preview)

```typescript
rimZone = 0.1           // Top 10% of height
rimT = (t - 0.9) / 0.1  // Normalized position within rim zone (0 at 90% height, 1 at 100%)
waveOffset = sin(theta * rimWaveCount) * rimWaveDepth * height * rimT
finalY += waveOffset    // Add to Y position
```

---

## Verification Plan

After implementation:
1. Create a shape with **spineEnabled** and non-zero **spineAmplitudeX/Z**
2. Enable **rimWaveCount** with non-zero **rimWaveDepth**
3. Verify preview shows S-curve with wavy rim
4. Export to STL and open in slicer
5. Compare shape - should be identical to preview (no tilted/distorted cross-sections)

---

## Risk Assessment

**Low risk** - Changes are localized to vertex positioning in `generateBodyMesh()`:
- Preview code is unchanged (already correct)
- Only modifying export to match preview behavior
- No changes to radius calculation (shared `getBodyRadius()` is untouched)

