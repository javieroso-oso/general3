
User wants roundness to go FULL — meaning at roundness=1, the body should fully close into a sphere/dome (radius → 0 at the ends), not stop at the average radius. Currently the superellipse envelope already goes to 0 at t=0 and t=1, BUT:

1. There's a `radius = Math.max(radius, printConstraints.minBaseRadius * scale * 0.5)` clamp at line 226 that prevents true closure
2. There's also `r = Math.max(r, wall * 2)` at the end that prevents tip closure
3. The flat-bottom feature (default ON) blends back to baseline near t=0

User explicitly says "doesn't matter we need supports" — so they want to bypass printability clamps when roundness is high. The cleanest fix:
- When roundnessTop or roundnessBottom is high (e.g. > 0.9 or just always when > 0), skip the min-radius clamps in the corresponding half so the shape can actually close to a point
- Also auto-disable flat-bottom influence when roundnessBottom is high (or just respect the user's flatBottom toggle — if they want a bubble they'll turn it off themselves)

Actually simplest: just remove/relax the hard min clamps so roundness can drive radius → 0. Keep them only as a floor when roundness is low.

Plan: lerp the min-radius floor toward 0 based on the local roundness amount in each half. So at roundness=1, the floor disappears entirely and the body closes into a true sphere/dome.

Single file edit, ~5 lines.
