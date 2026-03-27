

# Remove "(limited)" Indicators + Exhibit Readiness Assessment

## The "(limited)" Problem

In exhibit mode, sliders for bulge, asymmetry, wobble, and lip flare show amber-colored labels with "(limited)" text, plus reduced opacity. Visitors shouldn't know constraints exist — the UI should feel intentionally designed, not restricted.

## Fix

### `src/components/controls/ParameterSlider.tsx`
- Remove the `constrained` prop entirely (or stop passing it in exhibit mode)
- No amber color, no "(limited)" text, no opacity reduction
- The slider still has its capped `max` value — it just doesn't advertise it

### `src/components/controls/ParameterControls.tsx`
- Stop passing `constrained={... || exhibitMode}` on the 4 affected sliders (bulge, asymmetry, wobble, lip flare)
- Keep `constrained` for `supportFreeMode` only (that's a different context where the user opted in and should know)

## Can You Run the Exhibit Today?

**Yes, mostly.** Here's the status:

| Feature | Status | Notes |
|---------|--------|-------|
| Kiosk toggle | Done | `?exhibit=true` or toolbar pill |
| Simplified controls | Done | Only shape/texture/lip visible |
| Spiral vase safety | Done | Melt/drag/spine/noise disabled, params capped |
| Safe randomizer | Done | `generateExhibitRandomParams()` in use |
| Print queue (submit) | Done | "Print This" button → name/email → queue entry |
| STL upload to storage | Done | Uploads to `print-files` bucket |
| Operator admin page | Done | `/exhibit-admin` with queue management |
| Header hidden in kiosk | Done | Clean fullscreen feel |

**What's missing for a polished exhibit:**
1. **Attract screen** — no idle timeout / "Touch to Start" screen yet. After someone submits, the kiosk just resets but there's no attract loop.
2. **Auto-reset timer** — after submission, the 10s countdown resets the dialog but doesn't randomize the shape for the next visitor.
3. **Fullscreen mode** — no F11/fullscreen API trigger; you'd need to manually fullscreen the browser.
4. **Direct printer integration** — currently operator manually downloads STL; no Bambu API connection yet.
5. **Queue position display** — works in the dialog but no persistent "your print is #X" screen.

**For today**: You can absolutely run it. Open `/?exhibit=true` in a fullscreen browser on the kiosk device, and `/exhibit-admin` on your phone/laptop. Visitors design → tap Print → you download STLs from admin and send to the Bambu slicer.

## Files

| File | Change |
|------|--------|
| `src/components/controls/ParameterControls.tsx` | Remove `exhibitMode` from `constrained` prop on 4 sliders |
| `src/components/controls/ParameterSlider.tsx` | No changes needed (constrained prop stays for supportFreeMode use) |

