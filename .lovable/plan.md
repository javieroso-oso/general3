

# Kiosk UI Design Upgrade

## Problem
The dark `.kiosk-panel` overrides CSS variables, but:
1. `--muted-foreground: 220 10% 60%` is too dim — slider labels are barely readable
2. `text-text-secondary` used on section headers isn't a valid Tailwind token tied to the CSS variable system, so it renders unpredictably on dark backgrounds
3. The overall kiosk still feels like a "dark-themed developer panel" rather than a curated exhibit experience

## Proposed Fixes + Design Upgrades

### 1. Fix readability in kiosk panel (`src/index.css`)
- Brighten `--muted-foreground` to `220 10% 72%` (readable on dark)
- Add `--text-secondary` override or map `text-text-secondary` to the foreground variable
- Brighten `--foreground` slightly to `0 0% 95%`
- Add explicit styling for section headers inside `.kiosk-panel`: lighter color, slightly larger text

### 2. Polish the left panel for exhibit use (`src/index.css` + `src/pages/Index.tsx`)
- Add subtle section dividers with a faint glow line instead of plain `border-border/50`
- Increase slider thumb size inside kiosk-panel to 20px (more touchable)
- Increase slider track height to `h-1.5` inside kiosk-panel
- Add a subtle gradient at the top/bottom of the scrollable area for visual polish (fade-to-panel-bg)

### 3. Upgrade the bottom swatch strip (`src/pages/Index.tsx`)
- Make swatches larger (56px circles instead of 48px)
- Add the currently-selected swatch's label as a floating text indicator above the strip
- Add a subtle glow ring around the active swatch (not just a white border)

### 4. Upgrade floating action buttons (`src/index.css` + `src/pages/Index.tsx`)
- Make "Print This!" larger (h-16, text-xl) with a pulsing glow animation when idle
- Add a subtle icon animation on "Randomize" (dice spin on tap)
- Round the buttons more (rounded-full pill shape)

### 5. Refine the header (`src/pages/Index.tsx`)
- Add a subtle bottom-edge gradient fade instead of a hard border
- Slightly increase letter-spacing for the subtitle

## Files

| File | Change |
|------|--------|
| `src/index.css` | Fix kiosk-panel color variables, add slider/thumb size overrides, add glow animation for Print button, section divider styling |
| `src/pages/Index.tsx` | Larger swatches with active label, bigger Print button, header gradient fade |

## Result
Slider labels become clearly readable. The panel feels intentionally dark and premium rather than broken. Touch targets are generous. The floating buttons invite interaction.

