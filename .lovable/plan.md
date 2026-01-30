
# Flexible Export Options

Add the ability to choose exactly which components you want when exporting designs - body, legs, base, molds - either separately or combined.

---

## How It Will Work

When you click "Export ZIP" from the drawer (or export from the main editor), a dialog will appear letting you choose:

```text
+---------------------------------------+
|  Export Options                       |
+---------------------------------------+
|                                       |
|  ☑ Body (shape/vase/lamp)            |
|  ☑ Legs/Base                         |
|  ☐ Mold parts                        |
|                                       |
|  ─────────────────────────            |
|  How to export:                       |
|  ○ Separate files                    |
|  ○ Body + Legs combined              |
|  ○ Everything merged                 |
|                                       |
|  [Cancel]              [Export ZIP]   |
+---------------------------------------+
```

---

## Export Combinations Available

| Selection | Merge Option | Result |
|-----------|--------------|--------|
| Body only | - | `body.stl` |
| Legs only | - | `legs_base.stl` |
| Body + Legs | Separate | `body.stl` + `legs_base.stl` |
| Body + Legs | Combined | `combined.stl` (single merged mesh) |
| All with mold | Separate | `body.stl` + `legs_base.stl` + `mold_A.stl` + `mold_B.stl` |
| All with mold | Combined | `combined.stl` + `mold_A.stl` + `mold_B.stl` |

---

## Changes Required

### New Component: ExportOptionsDialog

A dialog component with:
- Checkboxes for each component type (body, legs, molds)
- Radio buttons for merge mode (separate vs combined)
- Preview of what files will be generated
- Disabled options when components don't exist (e.g., no legs checkbox if design has no legs)

### Updated Export Logic

Extend `batch-export.ts` to support:
- Selective component export
- Merged/combined geometry generation
- Legs-only export (new capability)

### Integration Points

- Replace direct export calls in `DrawerPanel.tsx` with the options dialog
- Optionally add same dialog to main editor export buttons
- Store user's last export preferences in localStorage for convenience

---

## Technical Details

### New Types

```typescript
interface ExportOptions {
  includeBody: boolean;
  includeLegs: boolean;
  includeMolds: boolean;
  mergeMode: 'separate' | 'bodyWithLegs' | 'allMerged';
}
```

### Geometry Functions Needed

The codebase already has `exportCombinedToSTL()` which merges body + legs. This will be extended to support:
- Legs-only export (currently not available)
- All-merged option (body + legs + base as single mesh)

### Files to Modify

1. `src/components/ExportOptionsDialog.tsx` - New dialog component
2. `src/lib/batch-export.ts` - Add export options parameter
3. `src/lib/stl-export.ts` - Add legs-only export function
4. `src/components/drawer/DrawerPanel.tsx` - Use new dialog
5. `src/pages/Index.tsx` - Optionally integrate with main export buttons
