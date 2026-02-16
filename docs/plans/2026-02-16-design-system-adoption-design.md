# Design System Adoption — Design

**Created:** 2026-02-16
**Status:** Approved
**Context:** Pre-P1 investment. PickleScore works but looks like a "competent side project." Before building Discovery (P1) and Profiles (P2), the app needs to look like a product users trust and want to keep using.

---

## Problem

PickleScore has functional UI but lacks visual polish. Specific issues:
- Inconsistent inline SVG icons drawn in different styles
- Flat dark surfaces with no depth hierarchy (dark rectangles + thin borders)
- No hover/press micro-interactions beyond basic color changes
- Landing page doesn't adapt to desktop (single column at 1280px)
- Green used everywhere with no intentional color hierarchy
- No entrance animations, staggered loading, or visual feedback

## Solution

**CSS-first polish + Lucide icons.** No architecture changes, no component library migration. Get 80% of the visual level-up with 20% of the risk.

Four focused sessions:
1. Lucide Solid icons (replace all inline SVGs)
2. Theme refinement (deeper darks, glow accents, gradient text, noise texture)
3. Landing page polish (desktop grid, stagger animations, hero upgrade)
4. Desktop responsiveness (all pages)

Kobalte component library adoption deferred to P1 Discovery, where new interactive components (combobox, filters, popovers) will be built fresh with Kobalte from day one. Existing components migrated organically when touched for features.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Component library now? | No — defer to P1 | Tailwind v4 compatibility untested with Solid UI/shadcn-solid. Too risky to retrofit 35 working components. |
| Icon library now? | Yes — Lucide Solid | Tree-shakeable, 1500+ icons, SolidJS bindings. Highest impact, lowest risk. |
| Animation library? | No — use existing CSS + solid-transition-group | Already have WAAPI + 11 CSS keyframes + solid-transition-group. No need for solid-motionone. |
| Glass/backdrop-blur? | No | GPU lag, battery drain, WCAG contrast failures on mobile. Premium apps (Strava, Nike, WHOOP) use flat cards + shadows. |
| Theme approach | CSS variables in @theme | Additive migration: add new tokens alongside old, swap at end. Outdoor mode continues to work transparently. |
| Desktop approach | Responsive breakpoints | mobile < 640px (current), tablet 640-1024px, desktop > 1024px (max-w-6xl) |

---

## New Dependency

| Package | Purpose | Size |
|---------|---------|------|
| `lucide-solid` | Professional icon library | ~200B per icon (tree-shakeable) |

No other new dependencies. All visual improvements are CSS/Tailwind changes.

---

## Visual Direction: Premium Sporty Dark

Validated against Strava, Nike Training Club, WHOOP, Apple Fitness+, and DUPR research.

### Refined Color Palette

| Token | Current | New | Change |
|-------|---------|-----|--------|
| `--color-surface` | `#1e1e2e` | `#0f1118` | Deeper, more premium |
| `--color-surface-light` | `#2a2a3e` | `#1a1d2e` | Cooler, more depth |
| `--color-surface-lighter` | `#363650` | `#252a3a` | Better card contrast |
| `--color-surface-deep` | `#161625` | `#080a10` | Deepest background |
| `--color-on-surface` | `#e2e8f0` | `#f1f5f9` | Brighter for readability |
| `--color-primary` | `#22c55e` | `#22c55e` | Keep (strong sporty green) |
| `--color-accent` | `#f97316` | `#f97316` | Keep (use more for energy accents) |
| `--color-score` | `#facc15` | `#facc15` | Keep (score display exclusive) |
| NEW: `--color-border` | — | `rgba(255,255,255,0.08)` | Subtle borders |
| NEW: `--glow-primary` | — | `0 0 20px rgba(34,197,94,0.3)` | Green glow shadow |
| NEW: `--glow-accent` | — | `0 0 20px rgba(249,115,22,0.3)` | Orange glow shadow |
| NEW: `--glow-score` | — | `0 0 20px rgba(250,204,21,0.3)` | Score glow shadow |

Outdoor mode overrides continue to work (they override `--color-*` variables).

### Depth System (Shadows, Not Glass)

| Layer | Usage | Style |
|-------|-------|-------|
| **Base** (`surface`) | Page background | Solid deep dark |
| **Elevated** (`surface-light`) | Cards, nav bars | `shadow-md` + subtle border (`border-border`) |
| **Floating** (`surface-lighter`) | Dropdowns, modals | `shadow-xl` + stronger border |

No `backdrop-blur`. Shadow-based elevation only.

### Accent Usage

| Color | When |
|-------|------|
| **Green** (`primary`) | Primary actions only — buttons, active states, serving indicator |
| **Orange** (`accent`) | Energy highlights — live indicators, tournament badges, competitive accents |
| **Gold** (`score`) | Score displays only — exclusive to scoring context |
| **Glow effects** | Active/focused elements only — not on every card |

### Motion Language

| Pattern | Implementation | Where |
|---------|---------------|-------|
| **Entrance** | CSS `@keyframes fade-in` (existing) + stagger via `animation-delay` | Cards, list items, sections |
| **Hover glow** | `box-shadow: var(--glow-primary)` on `:hover` | Buttons, interactive cards (desktop only via `@media (hover: hover)`) |
| **Press feedback** | `active:scale-[0.97]` (existing pattern) | All tappable elements |
| **Score pulse** | Existing `score-bump` + `score-flash` keyframes | Scoreboard on point scored |
| **Skeleton shimmer** | Upgrade from pulse to sweeping gradient (CSS only) | Loading states |

All animations respect `prefers-reduced-motion` (already in styles.css).

### Typography Enhancements

| Element | Current | New |
|---------|---------|-----|
| Hero "PickleScore" | Green/yellow flat text | Gradient fill: `bg-gradient-to-r from-primary via-score to-accent` + `bg-clip-text` |
| Section headings | Flat white | Subtle gradient fill (primary → lighter green) |
| Score numbers | Yellow (`text-score`) | Keep, add glow on score change |

### Noise Texture

Subtle SVG grain overlay at `opacity: 0.03` on `surface` background. Adds richness without performance cost. Inline data URI (no HTTP request).

---

## Session 1: Lucide Solid Icons

**Install:** `npm install lucide-solid`

**Replace all inline SVGs with Lucide imports across:**

| File | Inline SVGs | Lucide Replacements |
|------|-------------|-------------------|
| `BottomNav.tsx` | 6 nav icons | `Plus`, `Clock`, `Users`, `Sparkles`, `Heart`, `Settings` |
| `LandingPage.tsx` | 6 feature icons | `Zap`, `Clock`, `Trophy`, `Activity`, `Share2`, `UserPlus` |
| `EmptyState.tsx` | Receives icon as prop | Callers pass Lucide components |
| `TopNav.tsx` | Close/menu icons | `ChevronDown`, `LogOut` |
| Various feature components | Scattered inline SVGs | Appropriate Lucide icons |

**No behavior changes.** Just swap `<svg>...</svg>` → `<IconName size={24} />`.

---

## Session 2: Theme Refinement

**Update `src/styles.css` `@theme` block** with new color tokens (additive — keep old tokens until Session 4 cleanup).

**Add to `src/styles.css`:**
- Noise texture overlay (body pseudo-element)
- Glow utility classes (`.glow-primary`, `.glow-accent`, `.glow-score`)
- Gradient text utility (`.text-gradient`)
- Sweeping skeleton shimmer (replace pulse with left-to-right wave)
- Hover glow on buttons (desktop only: `@media (hover: hover)`)
- Card elevation shadows on `bg-surface-light` elements
- Stagger animation utility (`.stagger-in` with `animation-delay` children)

**Update component styles:**
- Buttons: Add hover glow, ensure consistent `rounded-xl` + padding
- Cards: Add `shadow-md` + `border border-border`
- Inputs: Add focus glow ring (green glow on `:focus-visible`)
- Active/selected states: Use glow instead of just color change

---

## Session 3: Landing Page Polish

**Desktop responsiveness:**
- Hero: larger logo, side-by-side CTAs on `sm:` breakpoint
- Features grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- "How It Works": horizontal 3-step row on `sm:` with connecting lines
- Container: `max-w-6xl` on landing (currently capped at `max-w-3xl`)

**Visual upgrades:**
- Hero: Static aurora gradient background (radial gradients with green/orange/gold)
- "PickleScore" heading: Gradient text fill
- Feature cards: Lucide icons, hover lift (desktop), entrance stagger animation
- "How It Works" step numbers: Glow effect
- Footer: Subtle noise texture visible

---

## Session 4: Desktop Responsiveness (All Pages)

| Page | Mobile (keep) | Desktop (add) |
|------|--------------|---------------|
| Game Setup | Single column | Center-aligned `max-w-md` (form shouldn't stretch) |
| Scoring | Two panels side by side | More breathing room, larger score text |
| History | Card list | 2-column card grid on `md:` |
| Players | Single column | 2-column card grid on `md:` |
| Settings | Single column | Center-aligned `max-w-md` |
| Tournament Dashboard | Stacked sections | `max-w-5xl`, wider pool tables and brackets |
| Tournament List | Card list | 2-column card grid on `md:` |

**Container standardization:**
- App pages: `max-w-5xl mx-auto px-4`
- Form pages: `max-w-md mx-auto px-4`
- Landing page: `max-w-6xl mx-auto px-4`

**Touch vs mouse:**
```css
@media (hover: hover) and (pointer: fine) {
  /* Hover effects: lift, glow, shadow expansion */
}
/* Touch devices: active:scale-[0.97] only */
```

---

## What's Deferred to P1 Discovery

| Item | When | Why |
|------|------|-----|
| Kobalte component library | P1 implementation | New components (combobox, filters) built fresh with Kobalte. No retrofit risk. |
| Toast notification system | P1 implementation | Kobalte Toast primitive, styled to match our theme. |
| Shared component migration | Organic — when touched for P1/P2 | ConfirmDialog → Kobalte AlertDialog, PlayerSearch → Kobalte Combobox, etc. |
| Avatar component | P2 Profiles | Kobalte Avatar when we build profile pages. |
| Tabs component | P2 Profiles | Kobalte Tabs when we build profile/tournament detail tabs. |

---

## Testing

All changes are CSS/styling. No component API changes, no prop changes, no behavior changes.

- **Existing 240 tests:** Should all pass (they test logic, not styles)
- **Manual verification per session:** Visual check on mobile (390px) + desktop (1280px) + outdoor mode
- **Playwright screenshots:** Before/after comparison for key pages

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lucide icons look different from current SVGs | Low | Low | Preview before committing, easy to adjust |
| Deeper dark theme too dark on some screens | Medium | Low | Test on OLED + LCD. Outdoor mode unaffected. Can tune values. |
| Desktop layouts break existing mobile layout | Low | Medium | Mobile-first approach, `sm:`/`md:`/`lg:` only add, never override mobile |
| Stagger animations feel slow on low-end devices | Low | Low | Respect `prefers-reduced-motion`, keep under 300ms |
| Gradient text unreadable on some backgrounds | Low | Medium | Only on hero/headings with controlled backgrounds, test contrast |

**Overall risk: Low.** Every change is additive CSS or icon swaps. No architecture changes. Easy to revert any session independently.

---

## File Changes Summary

### Session 1: Icons
- Modify: `BottomNav.tsx`, `LandingPage.tsx`, `TopNav.tsx`, `EmptyState.tsx` callers, various feature components
- Add: `lucide-solid` to package.json

### Session 2: Theme
- Modify: `src/styles.css` (theme tokens, utilities, keyframes)
- Modify: Component files (add shadow/glow/hover classes)

### Session 3: Landing Page
- Modify: `src/features/landing/LandingPage.tsx` (responsive grid, hero, animations)

### Session 4: Desktop
- Modify: `PageLayout.tsx` (container width), page-level components (grid layouts)
