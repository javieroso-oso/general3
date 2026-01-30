
# Bulb Mounting Solutions for 3D Printed Lamp Shades

The core challenge: How does the bulb/socket stay in position inside your beautiful 3D printed shade, without complex 3D printed joinery that keeps breaking?

Based on research into Akari lamps, traditional lampshade fittings, and pendant light hardware, here are two comprehensive approaches.

---

## Current Situation

Your shade is essentially a hollow decorative shell. Right now you have:
- **Centering lip** - a ring at the bottom sized to a socket (E26, etc.)
- **Cord hole** - for wire routing
- **No internal structure** to actually hold anything in place

The problem: a socket sitting loosely on a flat ring can wobble, fall, or shift.

---

## Plan A: Analog/Hardware Solution (No 3D Printed Joinery)

**Philosophy**: Use off-the-shelf lamp hardware designed for this exact purpose. The shade becomes purely decorative; all structural/electrical work is handled by proven commercial components.

### The Akari Method

Akari lamps solve this elegantly with a **wire frame stretcher** that:
1. Holds the shade in shape
2. Provides a rigid mounting point for the socket
3. Is completely invisible inside the shade

```text
Cross-Section View:
                     
        ╭─────────────────╮  ← Shade (decorative)
       ╱                   ╲
      │                     │
      │    ┌───────┐        │
      │    │ BULB  │        │
      │    └───┬───┘        │
      │    ┌───┴───┐        │  ← Socket screwed to cross-bar
      │   ═╪═══════╪═       │  ← Wire cross-bar (hidden inside)
      │    ╲       ╱        │
       ╲    ╲     ╱        ╱   ← Wire legs extend to rim
        ╰────╲───╱────────╯
              └─┘  ← Cord exit
```

### Hardware Shopping List

| Component | Description | Where to Buy |
|-----------|-------------|--------------|
| **Spider Fitter** | Metal cross-bar with center hole for socket | Lamp parts suppliers, Amazon |
| **E26 Keyless Socket** | Threaded socket that screws onto fitter | Grand Brass, Home Depot |
| **Cord Grip / Strain Relief** | Holds cord at exit point | Electrical suppliers |
| **Pendant Cord Set** | Pre-wired cord with plug | Color Cord Company, Amazon |

### Three Hardware Options

**Option 1: Spider Fitter (Simplest)**
- Standard lamp hardware - 3 metal arms meet at center ring
- Socket threads into center ring
- Arms rest on shade rim or clip to internal loops
- Cost: $8-15

**Option 2: Harp + Finial (Table Lamps)**
- Traditional U-shaped harp attaches to socket base
- Shade sits on top, secured with decorative finial
- Works when shade opens upward (not pendant style)
- Cost: $5-12

**Option 3: Cross-Bar with Loops (Akari-Style)**
- Two or three rigid wire pieces form an X or Y inside shade
- Ends have loops that hook onto rim
- Center has threaded hole for socket
- Most invisible, most flexible
- Cost: DIY with hardware store materials ($5-10)

### What Changes in the App

1. **Remove** centering lip complexity - not needed with hardware
2. **Add** rim loop positions - small notches or holes where wire frame hooks
3. **Specify** rim diameter clearly - must match fitter span
4. **Generate** hardware shopping list based on shade size

### Implementation for App

Add a "Hardware Kit" info panel showing:
- Recommended spider fitter size based on shade bottom diameter
- Socket type (already have this)
- Assembly diagram
- Purchase links (Amazon search terms)

---

## Plan B: 3D Printed Solution (Minimal Joinery)

**Philosophy**: Print a simple internal socket cage that is geometrically stable and avoids complex interlocking features. Use **gravity and geometry**, not friction fits or snap-fits.

### Design: The Socket Cradle

Instead of trying to join body + base with printed joinery, print a simple **socket cage** that:
1. Drops into the shade from the bottom
2. Rests on the rim by its own geometry
3. Has the socket pre-installed

```text
Top View (looking down into shade):
         
    ╭─────────────────────╮
   ╱                       ╲  ← Shade rim
  │    ○─────────────○      │
  │    │             │      │  ← 3 or 4 radial arms
  │    │   ┌─────┐   │      │
  │    │   │SOCK │   │      │  ← Central socket holder
  │    │   └─────┘   │      │
  │    │             │      │
  │    ○─────────────○      │
   ╲                       ╱
    ╰─────────────────────╯

Side View:
                          
    Arms rest on rim    
    ════════╤═══╤════════   ← Flat arms (print flat!)
            │   │
            │ ○ │  ← Socket holder (cylinder)
            │   │
            └─┬─┘
              │    ← Cord exit
```

### Why This Works

1. **Prints flat** - No overhangs, no supports needed
2. **Drops in** - Gravity holds it, no clips or friction
3. **Self-centering** - Arms span the rim diameter exactly
4. **Separate print** - If it fails, just reprint the small cage

### Socket Cradle Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `rimDiameter` | Outer span of arms (matches shade rim) | From shade |
| `socketType` | E26, E12, GU10 etc. | E26 |
| `armCount` | 3 or 4 radial arms | 3 |
| `armWidth` | Width of each arm | 8mm |
| `armThickness` | Height/thickness of arms | 4mm |
| `holderDepth` | How deep socket sits in holder | 30mm |

### Implementation

1. **New component type**: Socket Cradle (separate STL)
2. **Auto-sized to shade**: Uses `baseRadius` from current params
3. **Export option**: "Include Socket Cradle" checkbox
4. **Simple geometry**: Just cylinders + flat bars, no Boolean operations

### Code Structure

```typescript
// New generator: src/lib/socket-cradle-generator.ts
interface SocketCradleParams {
  rimDiameter: number;      // mm - must match shade
  socketType: SocketType;
  armCount: 3 | 4;
  armWidth: number;
  armThickness: number;
  cordHoleDiameter: number;
}

function generateSocketCradle(params: SocketCradleParams): THREE.BufferGeometry {
  // 1. Create central cylinder (socket holder)
  // 2. Create radial arms (flat bars)
  // 3. Merge geometries
  // Return single printable mesh
}
```

---

## Comparison

| Aspect | Plan A: Hardware | Plan B: 3D Printed Cradle |
|--------|------------------|---------------------------|
| **Reliability** | Very high (commercial parts) | High (simple geometry) |
| **Cost** | $10-25 in parts | Just filament |
| **Assembly** | Some wiring skill needed | Drop-in |
| **Aesthetics** | Invisible when assembled | Visible inside shade |
| **Flexibility** | Works with any shade size | Must match rim exactly |
| **Print Difficulty** | N/A | Easy (flat, no supports) |
| **Heat Safety** | Metal parts handle heat | Must use LED only |

---

## Recommendation

**Start with Plan A (Hardware)** because:
1. Zero mesh complexity - your shade stays simple
2. Proven, safe electrical components
3. Easier for users to assemble
4. Works even if shade dimensions vary slightly

**Add Plan B (Cradle)** as optional feature for users who want all-printed solution

---

## Next Steps

1. **Update Hardware Shopping List**: Already have `generateShoppingList()` - enhance with spider fitter recommendations
2. **Add Rim Loop Notches**: Small semicircular notches at rim for wire frame hooks (optional)
3. **Create Socket Cradle Generator**: New simple geometry generator
4. **Update Export Options**: Add "Include Socket Cradle" option
5. **Assembly Guide**: Show both methods in UI/documentation

---

## Technical Changes Summary

### For Plan A (Hardware Focus)
- Enhance `generateShoppingList()` in `src/types/lamp.ts`
- Add spider fitter size calculator based on rim diameter
- Add optional rim notches to body generator (small modification)

### For Plan B (3D Printed Cradle)
- New file: `src/lib/socket-cradle-generator.ts`
- New type: `SocketCradleParams` in `src/types/lamp.ts`
- Update export dialog: add cradle inclusion option
- Simple geometry: cylinders + boxes, merged together
