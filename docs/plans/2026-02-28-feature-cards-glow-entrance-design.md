# Feature Cards Glow Burst Entrance — Design

**Date**: 2026-02-28
**Area**: Landing page "Everything You Need" feature cards section
**Files**: `src/features/landing/animations/scrollAnimations.ts`

## Problem

The current scroll entrance is too subtle, too fast, and too uniform. Hero cards fade up with slight scale/tilt; compact cards all slide in from the left with a stagger. It lacks visual impact and variety.

## Design: Border Trace + Glow Materialize

Each card materializes with a glowing border that traces around its perimeter in the card's accent color, then the card content deblurs and fades in. The effect gives each card its own energy signature.

## Animation Sequence (~1.5s total)

### Phase 1 — Hero cards (0ms–700ms)

- Cards start `opacity: 0, scale: 0.85, filter: blur(8px)`
- Glowing border trace via `conic-gradient` mask rotation (0° → 360°) over 500ms
- As border completes, card deblurs and scales to 1.0 over 400ms
- Left hero at 0ms, right hero at 150ms stagger
- Border glows in accent color (emerald / amber)

### Phase 2 — Compact cards (400ms–1400ms)

- Cards start `opacity: 0, y: 30, scale: 0.9, filter: blur(6px)`
- Same border-trace effect but faster (350ms) since cards are smaller
- Stagger: 150ms between each of the 4 cards
- Each glows in its own accent color (violet, cyan, orange, rose)
- Slight upward motion (y: 30 → 0) — "rising from below"

### Phase 3 — Settle glow (1200ms–1500ms)

- All border glows pulse once then fade to normal resting border state
- Subtle `box-shadow` bloom that dissipates

## Technical Approach

- **Border trace**: CSS `conic-gradient` on injected overlay div, GSAP animates coverage from 0° → 360°
- **Blur-to-sharp**: GSAP animates `filter: blur(8px)` → `blur(0px)` (GPU-accelerated)
- **Glow pulse**: Animated `box-shadow` with card accent color at ~30% opacity, expanding then fading
- **Cleanup**: Overlay divs removed after animation completes (no DOM pollution)
- **All changes in `scrollAnimations.ts`** — no new files

## What stays the same

- Tilt directive (hover interaction)
- Cursor glow effect (`setupCardGlow`)
- Inline accent hover colors
- `once: true` — fires only on first scroll

## Performance

- No canvas/WebGL — CSS gradients + GSAP transforms only
- `filter: blur` is GPU-composited
- All overlays removed post-animation
- ~50 lines added to scrollAnimations.ts
