# Fix: Unify Preview and Export Mesh Generation

## ✅ COMPLETED

The "bending" distortion issue has been fixed by unifying the preview and export mesh generation code.

### Changes Made

1. **`src/components/3d/ParametricMesh.tsx`**
   - Added import for `getBodyRadius` from `@/lib/body-profile-generator`
   - Replaced ~150 lines of inline radius calculation with a single call to the shared `getBodyRadius()` function
   - Removed duplicate `radius` tracking lines (381-387)
   - Removed now-unused `noise3D` and `seededRandom` functions (42 lines)
   - Kept post-radius modifiers (spine, melt, rim waves) unchanged

2. **`src/lib/body-profile-generator.ts`**
   - Already had noise coordinate normalization to ensure consistent sampling regardless of scale

3. **`src/lib/stl-export.ts`**
   - Already delegates to shared `getBodyRadius()` function via `getRadiusAtHeight()` wrapper

### Architecture Now

| Component | Code Location | Uses Shared `getBodyRadius`? |
|-----------|---------------|------------------------------|
| 3D Preview | `ParametricMesh.tsx` | ✅ YES |
| STL Export | `stl-export.ts` | ✅ YES |
| Mold Generator | `mold-generator.ts` | ✅ YES |
| Mold Preview | `MoldMesh.tsx` | ✅ YES |

### Result

Preview and export now use **identical** radius calculation logic, ensuring:
- Organic noise patterns match exactly
- All parametric modifiers (wobble, ripple, asymmetry, etc.) are consistent
- No more "bending" or distortion in exported STLs compared to preview
