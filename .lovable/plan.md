
The user is asking an open design question about making shapes feel rounder or fold into each other smoothly. Let me think about what this means in the context of the existing parametric generator.

Looking at `body-profile-generator.ts`, the current shape system is based on:
- A radial profile (radius as function of height + angle)
- Profile curves: linear, convex, concave, hourglass, wave
- Surface modifiers: ribs, fluting, ripples, facets, spiral grooves
- Organic modifiers: bulge, pinch, asymmetry, wobble, noise

Right now everything is **single-axis** (cylindrical around Y) and modifiers are **additive bumps**. There's no real way to get:
- True spherical/blob shapes
- Two lobes that merge smoothly
- A "folded" form where the surface tucks back into itself

Let me think about good approaches:

**Approach 1: Smooth-min (metaball) blending**
Combine multiple radial fields with a smooth-minimum function (`smin`). Each "lobe" is its own ellipsoid/sphere with center + radii, and `smin(a, b, k)` blends them into a single continuous skin — exactly the "fold into each other" effect, like blob sculptures. This is the standard SDF technique used in Blender/MagicaCSG.

**Approach 2: Superquadric / superellipsoid profile**
Replace the linear height profile with `r(t) = R * (1 - |2t-1|^n)^(1/n)` where n controls roundness. n=2 → sphere, n=1 → diamond, n=large → cylinder. Adds a single "Roundness" slider that morphs vase ↔ sphere ↔ pill.

**Approach 3: Folded profile (turn-and-tuck)**
Allow the radius profile to fold inward — i.e., let the surface have multiple radii at the same height by parameterizing along arc length instead of height. This gives mushroom caps, tucked rims, donut-like folds.

I think the most impactful + cohesive answer is to offer all three as a layered set, but lead with smooth-min blending (lobes) because that's literally "shapes folding into each other." The superquadric roundness slider is the cheapest win for "make it round."

Let me also consider: this needs to stay compatible with `getBodyRadius(t, theta)` so mold generation, STL export, and slicing all keep working. Smooth-min still returns a single radius per (t, theta) as long as lobes are arranged radially around the Y axis — good. Folded profiles would break that contract (multi-valued radius), so I'll flag that as a bigger architectural change.

I should ask the user which direction appeals before building, since these are quite different aesthetics.

Keep the plan short — this is a brainstorm/direction question, not a fully-spec'd task.
