# Bake Base Drawing Into the Shape

Confirmed your suspicion: today the base strokes are independent swept tubes glued onto a still-open bottom. They don't fuse with the body. This plan replaces them with **a real floor that is part of the body**, with the strokes lifting that floor upward — one continuous, watertight solid.

## What changes for you

- The moment you add a base stroke, the body gets a real bottom face automatically (or reuses an existing one — cord-hole floor, base plate, leg pedestal — when present).
- Strokes raise that floor where they pass, like pressing letters from underneath into clay. No more floating ribs.
- Visually you stop seeing a separate blue tube; you see the floor itself swelling to form your drawing.
- Spiral-vase mode is automatically blocked while base strokes exist (closed bottom + non-monotonic Z aren't compatible) — same UX pattern as the existing "needs floor" guards.

## Technical plan

**Floor field (new lib)** `src/lib/base-stroke-field.ts`
- Build an SDF over the base disc: for each query point in normalized base-radius coords, return distance to the nearest stroke segment.
- Convert SDF → height: `h(x,y) = max over strokes of strokeHeight * smoothstep(thickness/2, 0, dist)`. Rounded edges, no z-fighting.

**Floor mesh generator (new lib)** `src/lib/base-floor-generator.ts`
- Triangulate the base silhouette (sample `getBodyRadius(t=0, theta)` around the perimeter) into a fan/grid of vertices at high density (e.g. 1mm cell or ~120 radial × 96 angular).
- Each vertex's `y = baseFloorThickness + h(x,y)` so the top side carries the drawing relief, the bottom stays flat at `y=0`.
- Stitch outer ring to body's bottom ring (same theta samples) so they share vertices — truly fused, watertight.
- Add a flat underside disc + side wall ring connecting top to bottom (only the first vertical mm — relief sits above that).

**Hook into body export** `src/lib/stl-export.ts`
- Replace the current `generateBaseStrokeGeometry` merge in `exportBodyToSTL` with: if `baseStrokes.length > 0` and no existing closed floor, swap the open-bottom mesh for one that calls the new floor generator and welds it to the body's bottom ring.
- If a floor already exists (`needsCordHoleFloor`, `basePlateEnabled`, leg pedestal), apply the same height field to **its** vertices instead of generating a duplicate floor. For the cord-hole floor case, modify `generateFullBodyWithCordHoleFloor` to displace its floor vertices through the field. For external base plate (`base-plate-generator.ts`), apply the field to the top disc vertices.
- Force `printMode = 'standard'` (no spiral vase) when base strokes are present.

**Preview parity** `src/components/3d/ParametricMesh.tsx`
- Drop the standalone `BaseStrokeMesh` (the floating tube preview).
- Have the main body mesh include the new fused floor at scene scale (0.01) so what you see is exactly what exports.

**Canvas (no change to UX)** `src/components/drawing/BaseCanvas.tsx`
- Same drawing experience. Internally the strokes now feed the height field instead of the tube generator.

**Cleanup**
- Delete `src/lib/base-stroke-generator.ts` after the new pipeline is wired (or repurpose its tube code as a fallback debug view).

## Out of scope

- Engraved/cut into the floor (still raised-only, for print integrity).
- Drawing outside the base silhouette (clamped, as today).
- Spiral-vase support for base-stroke designs (impossible by definition — needs closed bottom).

Approve to build.
