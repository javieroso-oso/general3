
The user wants the new roundness/lobes features to optionally keep a flat bottom so the object still sits on the print bed. Right now `roundness=1` produces a sphere (curved bottom = unprintable, won't sit flat) and lobes can also curve under at the base.

Looking at `body-profile-generator.ts`:
- Roundness uses `envelope = (1 - |2t-1|^n)^(1/n)` — symmetric, so radius goes to zero at both t=0 and t=1
- Lobes use `dy = (t - center) / halfHeight` then `sqrt(1 - dy²)` — also pinches to zero near base if a lobe sits low

The fix is to add a "Flat Bottom" toggle (default ON for printability) that:
1. Clamps the roundness envelope so it doesn't shrink the radius below the linear baseline within a small bottom band (e.g. t < 0.05–0.15)
2. Same for lobes — blend the lobe radius back toward the linear baseline near t=0
3. Optionally exposes a "Flat Bottom Height" slider (0–0.2) to control how much of the base stays flat

Implementation is small and localized — one new boolean param, one optional slider, ~10 lines in `getBodyRadius`. Stays compatible with mold/STL/slicing.

Keep plan short — single focused feature.
