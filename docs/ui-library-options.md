# UI Library Options for PickleScore

**Created:** 2026-02-16
**Status:** Research / Evaluation
**Context:** Exploring libraries to improve PickleScore's visual quality and developer experience.

---

## Current Stack

- **SolidJS 1.9** + TypeScript
- **Tailwind CSS v4** (utility-first, `@theme` design tokens)
- **Custom components** (hand-rolled buttons, cards, modals, etc.)

---

## Recommended Stack (Tier 1 — High Confidence)

### 1. Solid UI (shadcn/ui port for SolidJS)

| | |
|---|---|
| **What** | Pre-built, accessible component library — SolidJS port of shadcn/ui |
| **Components** | 60+ (Button, Dialog, Select, Tabs, Toast, Dropdown, etc.) |
| **Styling** | Tailwind CSS v4 supported, fully customizable via CSS variables |
| **Approach** | Copy-paste — components live in your codebase, not node_modules |
| **Bundle** | Zero runtime overhead (just your code) |
| **Link** | https://solid-ui.com |

**Why it fits:** Same Tailwind v4 stack we already use. Copy-paste model means we own the code and can customize freely. Accessible by default (keyboard nav, ARIA, focus management). No lock-in.

**Trade-off:** Need to adapt component styles to match our dark/green/orange palette (straightforward with CSS variables).

### 2. Lucide Solid (Icon Library)

| | |
|---|---|
| **What** | 1500+ open-source icons with first-class SolidJS bindings |
| **Bundle** | Tree-shakeable — only ships icons you import |
| **Style** | Clean, consistent stroke icons (similar to Feather Icons) |
| **Link** | https://lucide.dev |

**Why it fits:** We currently use inline SVGs for icons (TopNav, LandingPage features). Lucide gives us a massive, consistent icon set with zero bundle bloat for unused icons.

**Trade-off:** Adds a dependency. But tree-shaking means effectively zero cost for unused icons.

### 3. solid-motionone (Animations)

| | |
|---|---|
| **What** | Animation library for SolidJS, built on Motion One |
| **Bundle** | ~5.8 KB gzipped |
| **API** | Declarative `<Motion>` component + `animate()` function |
| **Link** | https://github.com/solidjs-community/solid-motionone |

**Why it fits:** We already have WAAPI animations for scoring. solid-motionone gives us a declarative API for page transitions, micro-interactions, and entrance animations without manual WAAPI boilerplate.

**Trade-off:** We already have `solid-transition-group` for page transitions. Could overlap, but solid-motionone handles spring physics and complex sequences better.

---

## Worth Considering (Tier 2 — Situational)

### 4. Kobalte (Headless Accessible Primitives)

| | |
|---|---|
| **What** | Unstyled, accessible component primitives for SolidJS |
| **Components** | Dialog, Select, Popover, Combobox, Tabs, Toggle, etc. |
| **Styling** | Bring your own — fully compatible with Tailwind |
| **Link** | https://kobalte.dev |

**Why it fits:** If we want maximum control over styling while getting accessibility for free. Good for complex interactive components (combobox for player search, dropdown menus).

**Trade-off:** Solid UI already builds on top of Kobalte internally, so using Solid UI gives us Kobalte's accessibility + pre-built styles. Use Kobalte directly only if Solid UI doesn't cover a specific component.

### 5. corvu (Specialized Components)

| | |
|---|---|
| **What** | Small collection of polished SolidJS components |
| **Components** | Drawer, Dialog, Tooltip, Calendar, Accordion |
| **Link** | https://corvu.dev |

**Why it fits:** The Drawer component is excellent for mobile-first UIs (bottom sheets for score editing, match details). Calendar could be useful for tournament date picking.

**Trade-off:** Very small library — only useful if we need its specific components.

### 6. DaisyUI v5 (CSS Component Classes)

| | |
|---|---|
| **What** | Tailwind CSS component plugin — adds semantic class names |
| **Approach** | CSS-only — `class="btn btn-primary"` instead of `class="px-4 py-2 bg-primary..."` |
| **Themes** | 30+ built-in themes, easy custom themes |
| **Tailwind v4** | Supported via `@plugin "daisyui"` |
| **Link** | https://daisyui.com |

**Why it fits:** Reduces Tailwind class verbosity. Theme system could enable dark/light mode toggle later.

**Trade-off:** Adds an opinionated design language that may conflict with our custom palette. Would need significant theme customization. Better suited for greenfield projects than retrofitting.

---

## Not Recommended (Tier 3)

### 7. Ark UI (Headless by Chakra Team)

Overlaps heavily with Kobalte. SolidJS support is less mature than Kobalte. No clear advantage for our stack.

---

## Recommendation

**Start with Solid UI + Lucide Solid.** These two cover 90% of our needs:

- **Solid UI** replaces hand-rolled modals, dropdowns, selects, toasts, tabs — all accessible and consistent
- **Lucide Solid** replaces inline SVG icons with a unified icon system

Add **solid-motionone** when we tackle P1 (Discovery) or P2 (Profiles), where entrance animations and transitions will matter more.

Add **corvu's Drawer** if we redesign the scoring interface for mobile bottom-sheet patterns.

Skip DaisyUI — retrofitting would be more work than benefit at this stage.
