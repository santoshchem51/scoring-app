# Landing Page Upgrade — GSAP + Lenis Design

**Date:** 2026-02-28
**Status:** Approved
**Approach:** Two prototypes (Premium Product Site vs Creative Showcase) built in separate worktrees, user picks winner.

---

## Overview

Upgrade the PickleScore landing page from basic CSS animations to a polished, scroll-driven experience using GSAP (ScrollTrigger) and Lenis smooth scroll. Two variants will be prototyped in parallel worktrees for comparison.

## Dependencies

- `gsap` (~27KB gzipped) — animation engine
- `lenis` (~3KB gzipped) — smooth scroll
- Both lazy-loaded via dynamic `import()` on landing page route only — zero impact on app bundle

## Shared Foundation (both approaches)

### Lenis Setup
- Instantiated in `LandingPage` `onMount`, destroyed in `onCleanup`
- Bridges to GSAP: `lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker.add((time) => lenis.raf(time * 1000))`
- Desktop: `lerp: 0.1` (smooth)
- Mobile: same smooth scroll, `touchMultiplier: 1.5`
- Disabled when `prefers-reduced-motion` matches

### Glassmorphism Hero Card
- Hero content wrapper: `backdrop-blur-md bg-surface/50 border border-white/5 rounded-2xl px-8 py-10`
- Solves wave-through-text readability issue (waves visible through blur)
- Cursor glow shines through glass intentionally

### Reduced Motion
- Lenis disabled (native scroll)
- All GSAP animations: `duration: 0` via `gsap.matchMedia`
- Canvas: static frame (existing behavior)
- All elements get final state immediately

### Module Structure
```
src/features/landing/
├── LandingPage.tsx
├── animations/
│   ├── initLenis.ts         ← Lenis + GSAP ticker bridge
│   ├── heroAnimations.ts    ← Hero entrance timeline
│   ├── scrollAnimations.ts  ← ScrollTrigger registrations
│   └── index.ts             ← Lazy-loaded barrel
```

Animation functions are pure TS — take DOM elements, return GSAP timelines/ScrollTriggers. Called in `onMount`, killed in `onCleanup`. No SolidJS reactivity.

---

## Approach A: Premium Product Site

**Vibe:** Stripe, Linear, Vercel — polished, confident, understated.

### Hero Entrance (~1.2s)
| Time | Element | Animation |
|------|---------|-----------|
| 0.0s | Logo | fade in + scale 0.9→1.0 (300ms, power2.out) |
| 0.2s | Headline | fade up from y:20 (400ms, power2.out) |
| 0.4s | Subtext | fade up from y:15 (300ms, power2.out) |
| 0.6s | CTA buttons | fade up from y:10, stagger 100ms (300ms each) |
| 0.8s | Glass card border | opacity pulse once (400ms) |

### Scroll Animations
- **Feature cards:** fade up from `y:40, opacity:0`, stagger 80ms, `power2.out` (500ms)
- **How It Works:** fade up from `y:30`, stagger 150ms sequential (400ms)
- **Tournament cards:** fade up, stagger 100ms (400ms)
- **Final CTA:** fade in with `scale:0.97→1` (600ms)
- **Trigger:** `start: "top 80%"`, play once

### Parallax
None. Clean, flat scrolling.

---

## Approach B: Creative Showcase

**Vibe:** ultracontext.ai energy — sections have personality, scroll experience is the feature.

### Hero Entrance (~1.8s)
| Time | Element | Animation |
|------|---------|-----------|
| 0.0s | Glass card | scale 0.85→1.0 + fade (500ms, back.out(1.4)) |
| 0.2s | Logo | drop from y:-30 with bounce (400ms, bounce.out) |
| 0.4s | Headline words | "Score." → "Organize." → "Compete." each: y:30→0, rotateX:10→0, stagger 80ms (300ms, power3.out) |
| 0.9s | Subtext | fade up (300ms) |
| 1.1s | CTA buttons | spring from scale:0.8, elastic.out(1, 0.5), stagger 150ms (400ms) |

Word-split: wrap each headline word in a `<span>` (only 3 words, no SplitText plugin needed).

### Scroll Animations
- **Feature cards:** `scale:0.85→1` + `y:60→0` + `rotateX:5→0`, stagger 100ms (600ms, power3.out)
- **How It Works:** alternating slide from left/right (`x:-80→0` / `x:80→0`), stagger 200ms (600ms, back.out(1.2))
- **Tournament cards:** cascade `rotation:-3→0` + `y:50→0`, stagger 80ms (500ms)
- **Final CTA:** `scale:0.8→1` with elastic.out overshoot (800ms)
- **Trigger:** `start: "top 80%"`, play once

### Parallax
Canvas waves scroll at 0.5x content speed via GSAP ScrollTrigger `scrub: true` on the canvas wrapper.

---

## Testing

- `initLenis.test.ts`: returns cleanup function, respects reduced motion, bridges GSAP ticker
- `heroAnimations.test.ts`: returns GSAP timeline, `.kill()` on cleanup
- `scrollAnimations.test.ts`: creates ScrollTrigger instances, killed on cleanup
- Existing 460 tests unaffected (animations are additive)
- ~6-8 new tests per approach

## Implementation Strategy

- **Worktree A:** `landing-premium` branch
- **Worktree B:** `landing-creative` branch
- First 3 tasks shared (deps, Lenis, glassmorphism), then diverge
- After both built, user compares live and picks winner (or mixes elements)
