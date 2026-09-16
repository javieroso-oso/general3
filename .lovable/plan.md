# Hide Pages mode and unify the controls panel

Two investor-prep changes: the book tool disappears from the site, and the shape controls always show everything (no Simple/Advanced split).

## 1. Hide the Pages (book) tool

The book code stays in the codebase — only its entry points are removed so it can be brought back after the demo.

- `src/components/controls/ObjectTypeTabs.tsx`: remove the `Pages` tab from the tab list, so only `Shape` and `Plotter` remain.
- `src/pages/Index.tsx`: add a small guard so if a saved session or shared link still has `objectType === 'pages'`, it falls back to `shape` instead of rendering the hidden book UI (the existing `objectType === 'pages'` branches stay in place, just unreachable).

Nothing else touches the book generator, controls, or STL export — re-enabling later is a one-line change.

## 2. Remove the Simple/Advanced toggle — one full panel

- `src/components/controls/ParameterControls.tsx`: delete the Simple/Advanced toggle row and the `advancedMode` state. Sections that were previously gated behind `advancedMode` (the block starting around line 1109) become always visible, in their current position and order.
- No sliders, options, or defaults change — everything that exists today is shown, just without the mode switch.

## Technical detail

- Both changes are frontend-only; no data, exports, or shared-link formats are affected.
- Verify after editing: Shape tab shows all sections without the toggle; Plotter tab unchanged; no `advancedMode` references remain (build must pass).
