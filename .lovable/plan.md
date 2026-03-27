

# Add Exhibit/Kiosk Mode Toggle

## Problem
Currently you can only enter kiosk mode by manually adding `?exhibit=true` to the URL. There's no way to toggle it from within the app or easily preview it.

## Solution
Add an "Exhibit Mode" toggle button to the Header navigation (visible only on the main generator page). When toggled on, it updates the URL parameter and activates kiosk mode without a page reload.

## Changes

### 1. `src/pages/Index.tsx`
- Change `isExhibitMode` from a static `useMemo` to a `useState` so it can be toggled dynamically
- Pass `isExhibitMode` and `setIsExhibitMode` as props or use URL search params with `useSearchParams` from react-router
- Still respect the URL param on initial load

### 2. `src/components/layout/Header.tsx`
- Add an "Exhibit Mode" toggle switch (only shown on the `/` route)
- When toggled, update the URL search param `exhibit=true/false` and trigger a state change
- Use a small `Monitor` or `Tv` icon + switch for the toggle

### 3. Alternative: Simpler approach
- Add a small "Kiosk" toggle button directly in the generator toolbar (next to existing controls)
- This avoids needing to pass state through the Header

## Recommended: Toolbar toggle approach
Add a small toggle in the top toolbar of the Index page itself — keeps it self-contained, no cross-component state needed.

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Convert `isExhibitMode` to state, add toggle button in toolbar, sync with URL param |

