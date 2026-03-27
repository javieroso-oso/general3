

# Kiosk Mode UI Improvements

## Current State
The kiosk UI works but still looks like a developer tool with constraints, not a polished public exhibit experience. Key issues:

1. **Kiosk toggle pill visible to visitors** — the "Kiosk" switch in the top-right should be hidden in kiosk mode (only shown in normal mode for operators)
2. **Dimensions overlay** (top-right "180mm x Ø120mm") — technical, meaningless to visitors
3. **Left panel toggle chevron** — the collapsed-panel toggle arrow looks unfinished; in kiosk mode the panel should always be visible (no hide/show)
4. **Bottom bar clutter** — material picker, background selector, wireframe toggle, auto-rotate, color picker are all power-user tools. Visitors just need the "Print This!" button and a "Randomize" button
5. **No branding/title** — with the header hidden, there's no exhibit identity. A simple title like "Design Your Own" would orient visitors
6. **"Print This!" button size** — it's decent but could be bigger and more inviting for a touchscreen kiosk
7. **No Randomize button visible** — visitors might not realize they can randomize; a prominent shuffle/dice button next to "Print This!" would help
8. **Left panel width** — 340px is fine on desktop but on a kiosk tablet/touchscreen the sliders could be larger for finger use

## Proposed Changes

### 1. Hide kiosk toggle in kiosk mode (`src/pages/Index.tsx`)
Only render the toggle pill when `!isExhibitMode`. Operators enable it via URL (`?exhibit=true`) or before going live.

### 2. Hide dimensions overlay in kiosk mode (`src/pages/Index.tsx`)
Remove the "180mm x Ø120mm" badge — visitors don't need it.

### 3. Simplify bottom bar in kiosk mode (`src/pages/Index.tsx`)
In exhibit mode, the bottom bar shows only:
- A large "Randomize" button (dice icon)
- Material color picker (keep — it's fun and tactile)
- A large "Print This!" button
- Remove: view mode toggle, wireframe, auto-rotate, background preset, export buttons

### 4. Add exhibit branding header (`src/pages/Index.tsx`)
When in kiosk mode, show a minimal top bar with "Design Your Own" (or configurable text) centered, replacing the hidden Header.

### 5. Always show left panel in kiosk mode (`src/pages/Index.tsx`)
Remove the collapse chevron in exhibit mode — the controls panel is always visible.

### 6. Larger touch-friendly "Print This!" button
Increase to `h-14 px-8 text-xl` for touchscreen usability.

## Files

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Hide kiosk toggle when active, hide dimensions overlay, simplify bottom bar, add branding header, remove panel toggle, enlarge Print button |

