

# Kiosk Mode: "Bold Exhibition" Design (Option C)

## Vision
Transform the kiosk into a statement art-gallery experience: dark-tinted control panel, full-width material strip at bottom, floating semi-transparent action buttons over the 3D viewport, refined serif/geometric header.

## Changes

### 1. Bottom bar → Full-width material strip + floating buttons (`src/pages/Index.tsx`)
- Remove the current glass-panel bottom bar in exhibit mode
- Replace with a **full-width horizontal scroll strip** of 10-12 large color/material swatches at the very bottom of the screen (no border-radius, edge-to-edge, ~64px tall). Each swatch shows a colored circle + material name below ("Ceramic", "Coral", "Midnight", etc.)
- **"Randomize" and "Print This!"** become large, semi-transparent floating pill buttons positioned **bottom-right corner**, stacked vertically or side-by-side, directly over the 3D viewport (not in a bar)
- Remove the `<input type="color">` entirely — colors come from the curated swatches

### 2. Curated exhibit colors + materials (`src/types/materials.ts`)
- Add `EXHIBIT_SWATCHES` array: ~12 entries, each with `{ color: string, label: string, material: MaterialPreset }` — curated for PLA printing (e.g., "Arctic White" #f5f5f5/ceramic, "Coral" #e8735a/matte-clay, "Midnight" #2a2a3a/glossy-plastic, "Sage" #8fae8b/matte-clay, "Terracotta" #c4725c/terracotta, etc.)

### 3. Dark-tinted left panel in exhibit mode (`src/pages/Index.tsx` + `src/index.css`)
- In exhibit mode, swap the left panel's `glass-panel` class for a new `.kiosk-panel` class: darker background (`bg-[#1a1a24]/92`), lighter text, high-contrast slider tracks — gives a "control room" aesthetic without looking like a developer tool
- Widen to 380px, increase slider track height to `h-2` for touch

### 4. Exhibition header (`src/pages/Index.tsx`)
- Replace "Design Your Own" with a refined geometric sans treatment: larger text (`text-2xl`), letter-spaced, with an optional subtle exhibit subtitle line (e.g., "Interactive Sculpture Generator")
- Semi-transparent dark background to match the panel aesthetic

### 5. Floating action buttons (`src/index.css`)
- New `.kiosk-action` class: large rounded pill, semi-transparent dark background with white text, backdrop-blur, subtle border, scale-up on tap
- "Print This!" gets a warm accent glow (subtle box-shadow in primary color)

## Files

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Dark panel class in exhibit mode, full-width swatch strip replacing bottom bar, floating action buttons over viewport, refined header |
| `src/index.css` | Add `.kiosk-panel`, `.kiosk-action`, `.kiosk-swatch` component classes |
| `src/types/materials.ts` | Add `EXHIBIT_SWATCHES` array with 12 curated color/material combos |

## Result
The kiosk feels like a MoMA digital exhibit — dark control panel, curated color palette as a tactile strip, floating translucent action buttons, refined typography. No developer UI elements visible.

