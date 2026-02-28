# Bottom-Half Landing Page Redesign — Design

**Date**: 2026-02-28
**Area**: Landing page sections below "Everything You Need": How It Works, Final CTA, Footer
**Files**: `scrollAnimations.ts`, `LandingPage.tsx`, `styles.css`

## Problem

The bottom half of the landing page feels flat and disconnected compared to the new glow entrance on the feature cards. The "How It Works" steps are isolated items with no visual flow. The CTA is bare. The footer just appears.

## How It Works — Connected Glow Path

- Horizontal SVG `<path>` connects the 3 numbered circles
- On scroll-enter, line draws left-to-right via `stroke-dashoffset` animation (~1.5s)
- As line reaches each step, the circle pulses green glow and text deblurs
- On mobile (stacked), the line becomes vertical
- Matches the glow aesthetic from the feature cards section

### Timing (~2s total)
- Line starts drawing at 0ms, takes ~1.5s
- Step 1 materializes at 200ms, Step 2 at 700ms, Step 3 at 1200ms
- Each step deblurs over 400ms

## Final CTA — Full Section Energy

- Heading: `opacity: 0, filter: blur(10px), y: 20` → deblurs and rises
- Button: `opacity: 0, scale: 0.8` → materializes with glow burst (green accent)
- After entrance, button gets a persistent CSS glow pulse (`@keyframes` breathing box-shadow)

### Timing (~1.2s)
- Heading at 0ms (500ms deblur)
- Button at 400ms (600ms scale + glow burst)
- Persistent glow pulse starts at 1200ms (2s CSS loop)

## Footer — Subtle Fade

- Simple fade-in with `y: 10` rise, 400ms
- No glow, no drama — footers should be quiet

## Technical Approach

- `scrollAnimations.ts`: New animation logic for steps (SVG draw + staggered deblur), enhanced CTA entrance (deblur heading + glow burst button), footer fade
- `LandingPage.tsx`: Add SVG connector line markup between step circles, add ref for footer
- `styles.css`: Add `@keyframes` for persistent CTA button glow pulse, connector line responsive styles
- SVG draw: GSAP animates `stroke-dashoffset` from full length to 0
- Mobile: CSS media query switches connector horizontal → vertical
