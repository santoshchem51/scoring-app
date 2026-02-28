# Interactive Background & Parallax Effects — Design

**Date:** 2026-02-28
**Status:** Approved
**Inspired by:** [ultracontext.ai](https://ultracontext.ai/) — cursor-following glow, generative wave art, 3D card tilt

---

## Overview

Add an interactive canvas background with generative topographic wave lines, a cursor-following "flashlight" glow effect, and parallax tilt on cards. Applied to the landing page (full animated treatment) and public tournament pages (static wave texture only).

## Approach

Single Canvas Layer (Approach A) — one `<canvas>` element handles both wave rendering and cursor glow. The cursor position is passed into the render loop, which draws waves and applies illumination in a single pass. This produces the organic "flashlight illuminating the lines" effect that makes ultracontext.ai feel alive.

Parallax tilt on cards is a separate SolidJS directive (`use:tilt`), independent of the canvas.

---

## Section 1: Generative Wave Canvas Engine

**Module split:**
```
src/shared/canvas/
├── InteractiveBackground.tsx   ← SolidJS component, lifecycle only
├── waveRenderer.ts             ← canvas drawing: clear, waves, glow
├── waveSystem.ts               ← pure math: noise → point arrays
└── index.ts                    ← re-exports
```

**Wave generation:**
- `open-simplex-noise` (tree-shaken `makeNoise2D` import, ~800 bytes gzipped)
- 8 horizontal wave lines spanning canvas width
- Y-position offset by `noise2D(x * frequency, time)` for organic flow
- Green palette at low opacity: `rgba(34, 197, 94, 0.12–0.18)` with slight per-line variation
- `time` increments ~0.0005/frame for gentle drift

**Cursor glow (desktop only):**
- Cursor position stored as plain mutable `{x, y}` object — NOT a SolidJS signal
- Radial gradient centered on cursor: green core `rgba(34, 197, 94, 0.25)` fading over ~250px radius
- Gradient pre-generated, only recreated when cursor moves >5px from last generation point
- Wave lines within glow radius get opacity boost (0.12 → 0.4) based on distance
- Subtle orange accent `rgba(249, 115, 22, 0.08)` at larger radius for warmth

**Replaces the aurora gradient** on the landing page — canvas is the sole background treatment, not stacked on top of existing radial gradients.

---

## Section 2: Performance & Lifecycle Management

**rAF loop:**
- Imperative loop inside `onMount`, cleaned up via `onCleanup`
- 30fps throttle on mobile via timestamp check (`if (t - lastFrame < 33) return`)
- Canvas resolution: `devicePixelRatio` capped at 2, re-applied on `ResizeObserver` triggers

**Idle suspension:**
- After 45 seconds of no `mousemove`, `touchstart`, or `scroll` → freeze on current frame
- Keep rAF alive for cheap resume; stop calling `draw()`
- Resume instantly on next interaction event

**Visibility pause:**
- `document.visibilitychange` listener → fully cancel rAF when `document.hidden` is true
- Resume rAF when tab becomes visible again

**IntersectionObserver:**
- Pause drawing when canvas scrolls out of viewport
- Works alongside visibility pause for complete coverage

**Thermal/degradation fallback:**
- Monitor frame durations in the loop
- If 5 consecutive frames exceed 40ms → drop to static mode (render one final frame, stop loop)
- Resume after 5 minutes or next page navigation

**`prefers-reduced-motion`:**
- Check at mount via `matchMedia('(prefers-reduced-motion: reduce)')`
- If true: render a single static frame (no drift, no glow, no loop)
- Listen for changes (user can toggle mid-session)

**Mobile behavior:**
- No cursor tracking (no `mousemove` listener attached)
- Gentle wave drift only, at 30fps with idle suspension
- No touch-based glow alternative

---

## Section 3: Page-Specific Behavior

**Landing page — full treatment:**
- Animated wave drift + cursor glow + opacity illumination
- Canvas is `position: absolute` within the hero section container (not `position: fixed`)
- Replaces the existing aurora radial gradients entirely
- Stagger-in animations on feature cards remain (one-time entrance, no conflict)
- `z-index: 0` on canvas, content above via `relative z-10`

**Public tournament pages (`/t/:code`) — static only:**
- Canvas renders a single frame of wave lines at mount, then stops the loop
- No drift animation, no cursor glow, no rAF loop running
- Provides the visual motif (topographic texture) without motion or battery cost

**Outdoor mode — canvas disappears:**
- When `html.outdoor` class is active, component renders nothing (`<Show when={!isOutdoor()}>`)
- Detect via `MutationObserver` on `document.documentElement` class attribute
- Clean shutdown: cancel rAF, disconnect observers, remove listeners

**Content contrast:**
- All text/cards sit in containers with `position: relative` and solid/semi-transparent backgrounds
- Wave lines capped at 0.18 opacity, glow boost max 0.4 only within glow radius
- No wave lines rendered in top 80px (nav area)

---

## Section 4: Parallax Tilt on Cards

**Implementation:** SolidJS directive `use:tilt` in `src/shared/directives/tilt.ts`

**Behavior:**
- On `mousemove` over card: apply `perspective(800px) rotateX() rotateY() scale(1.02)`
- On `mouseleave`: reset transform (CSS `transition: transform 0.3s ease-out` handles settle-back)
- Max rotation: 6-8 degrees per axis

**Desktop only:** listeners don't fire on touch. No gyroscope fallback.

**Applied to:** landing page feature cards and how-it-works step cards. Not on tournament pages.

**TypeScript:** module augmentation on `solid-js` JSX.Directives for type-safe `use:tilt`.

---

## Section 5: Testing Strategy

**Unit tests — `waveSystem.test.ts`** (pure math):
- Returns requested number of wave lines
- All points within canvas bounds
- Different timestamps produce different output
- Same timestamp is deterministic
- Opacity values within configured range

**Renderer tests — `waveRenderer.test.ts`** (mock canvas context):
- Calls `clearRect` on every draw
- Creates radial gradient when cursor is within bounds
- Skips glow when cursor is off-screen
- Respects wave count and opacity props

**Component lifecycle tests — `InteractiveBackground.test.tsx`**:
- Renders `<canvas>` with `aria-hidden="true"`
- Calls `cancelAnimationFrame` on unmount
- Disconnects observers on unmount
- Removes `mousemove` listener on unmount
- Renders nothing when outdoor mode is active

**Directive tests — `tilt.test.ts`**:
- Applies transform on mousemove
- Resets on mouseleave
- Cleans up listeners on unmount

**Estimate:** ~20-25 new tests across 4 files. Existing 430 tests unaffected.

---

## Section 6: Component API

```typescript
interface InteractiveBackgroundProps {
  mode: 'animated' | 'static'
  waveCount?: number        // 4–16, default 8
  waveOpacity?: number      // 0–1, default 0.15
  glowIntensity?: number    // 0–2, default 1
  glowRadius?: number       // px, default 250
  class?: string
}
```

| Behavior | `animated` | `static` |
|----------|-----------|----------|
| Wave drift | Yes | No |
| Cursor glow | Yes (desktop) | No |
| rAF loop | Yes (with pauses) | No (single render) |
| Battery cost | Low-medium | Zero |

**Color scheme:** hardcoded to PickleScore green/orange palette. Resolved from CSS theme tokens via `getComputedStyle` once at mount. No `colorScheme` prop (YAGNI).

---

## Dependencies

- `open-simplex-noise` (~800 bytes gzipped, tree-shaken)

## Files Changed

- **New:** `src/shared/canvas/InteractiveBackground.tsx`, `waveRenderer.ts`, `waveSystem.ts`, `index.ts`
- **New:** `src/shared/directives/tilt.ts`
- **New:** 4 test files (~20-25 tests)
- **Modified:** `src/features/landing/LandingPage.tsx` — replace aurora gradient with `<InteractiveBackground mode="animated" />`
- **Modified:** public tournament page — add `<InteractiveBackground mode="static" />`
- **Modified:** `src/styles.css` — remove aurora gradient utilities if no longer used elsewhere
