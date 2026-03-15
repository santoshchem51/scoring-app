# UI Reskin: Theme System + Court Vision Gold

**Date:** 2026-03-15
**Scope:** Selectable theme system with 3 themes, decorative UI additions (court-line motifs, net divider)
**Prototypes:** `design-protos/court-vision-gold.html`, `design-protos/arena-ember.html`

## Overview

Build a theme system for PickleScore that lets users choose between three visual themes. Ship **Court Vision Gold** as the new default, preserve the current look as **Classic**, and include **Ember** as a third option.

**What changes:** Theme infrastructure, CSS variables, utility classes, animations, and minimal JSX additions for decorative elements (net divider, court-line dividers, win/loss badges, theme picker).
**What does NOT change:** Component logic, routing, XState engine, data layer, haptics, sounds, gestures — all existing functionality is untouched.

## Theme System Architecture

### How it works

1. A `theme` field is added to `settingsStore.ts` (alongside existing `displayMode`)
2. Theme configs are defined in a new `src/shared/constants/themes.ts` file
3. On app load and theme change, CSS variables are set on `document.documentElement`
4. The outdoor/high-contrast mode remains a separate toggle that works on top of any theme

**Flash-of-wrong-theme prevention:** The `@theme` block in `styles.css` should keep the CLASSIC values as CSS defaults. The `useTheme` effect applies the selected theme on first render. This prevents a flash of Court Vision Gold for users who chose Classic.

### Settings Store Change

```typescript
// In settingsStore.ts
export type Theme = 'court-vision-gold' | 'classic' | 'ember';

interface Settings {
  // ...existing fields...
  theme: Theme;  // NEW
}

const DEFAULTS: Settings = {
  // ...existing defaults...
  theme: 'court-vision-gold',  // NEW — Court Vision Gold is the default
};
```

### Theme Config Structure

```typescript
// src/shared/constants/themes.ts
export interface ThemeConfig {
  name: string;
  label: string;
  description: string;
  colors: Record<string, string>;     // CSS variable overrides
  outdoorColors: Record<string, string>; // Outdoor mode overrides
}

export const THEMES: Record<Theme, ThemeConfig> = {
  'court-vision-gold': { name: 'court-vision-gold', label: 'Court Vision Gold', description: 'Warm luxury with pickleball identity', colors: { ... }, outdoorColors: { ... } },
  'classic': { name: 'classic', label: 'Classic', description: 'The original PickleScore look', colors: { ... }, outdoorColors: { ... } },
  'ember': { name: 'ember', label: 'Ember', description: 'Volcanic energy, smoldering intensity', colors: { ... }, outdoorColors: { ... } },
};
```

### Theme Application

```typescript
// src/shared/hooks/useTheme.ts (or inline in App.tsx)
import { createEffect } from 'solid-js';
import { settings } from '../../stores/settingsStore';
import { THEMES } from '../constants/themes';

createEffect(() => {
  const theme = THEMES[settings().theme];
  const isOutdoor = settings().displayMode === 'outdoor';
  const colors = isOutdoor ? theme.outdoorColors : theme.colors;

  const root = document.documentElement;
  root.style.cssText = ''; // Clear old theme variables to prevent stale values on theme switch
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(key, value);
  }
});
// NOTE: All themes MUST define the complete set of CSS variables.
// If a theme omits a variable, cssText clearing ensures no stale value persists,
// but the app will fall back to the @theme defaults in styles.css rather than
// inheriting a value from the previous theme.
```

### Theme Picker UI

Add to the Settings page — a row of 3 cards showing theme name, description, and a small color swatch preview. Follows the same `OptionCard` pattern already used for scoring mode selection. ~15 lines of JSX.

The selected theme card must show a checkmark icon or 'Selected' text label in addition to the gold border — do not rely solely on color to indicate selection (WCAG 1.4.1).

### Three Themes

| Theme | Default | Vibe |
|-------|---------|------|
| **Court Vision Gold** | Yes (new default) | Warm luxury, court-line motifs, gold/teal/terracotta |
| **Classic** | — | Current green/orange, the original PickleScore look |
| **Ember** | — | Dark volcanic, ember-red/teal, lava-crack accents |

### What's shared vs theme-specific

**Shared across all themes** (built once):
- Court-line motifs (net divider, corner brackets, dividers)
- Glassmorphism infrastructure (glass-panel class, backdrop-filter budget)
- Typography hierarchy (Oswald weights, size scale)
- Focus indicator system (dual-ring)
- Animation system (score bump, serving transition, scan line)
- Performance optimizations (will-change, contain, no transition:all)

**Theme-specific** (defined per theme in config):
- All `--color-*` variable values
- Team color defaults
- Glow colors and intensities

This means the court-line motifs and glass effects are present in ALL themes — they're part of the app's identity now, not theme-specific. The themes only control colors.

## Design Direction

Court Vision Gold combines:
- **Midnight Gold palette** — warm obsidian base, rich gold accents, champagne scores, teal/terracotta team colors
- **Court Vision identity** — abstract court-line motifs, net divider with diamond center, court corner brackets
- **Selective glassmorphism** — frosted glass on key surfaces only (top bar, bottom nav, score panels)
- **Subtle scan line** — a thin gold light accent on the home hero section

---

## Color Palette

### Complete `@theme` Variable Mapping

Every variable in the existing `@theme` block in `src/styles.css` must be updated. This table shows the current value and its replacement. All names use the `--color-*` prefix to match Tailwind v4 conventions so that existing utility classes like `bg-surface`, `text-primary`, `text-on-surface-muted` continue to work.

| Token | Current Value | New Value | Usage |
|-------|--------------|-----------|-------|
| `--color-primary` | `#22c55e` | `#D4A853` (rich gold) | Accents, active states, court lines |
| `--color-primary-dark` | `#16a34a` | `#B8912E` (deep gold) | Pressed/active primary variant |
| `--color-accent` | `#f97316` | `#FFC234` (bright gold) | Game point, special moments |
| `--color-surface` | `#0f1118` | `#0A0908` (warm obsidian) | Page background |
| `--color-surface-light` | `#1a1d2e` | `#141210` (warm dark) | Card backgrounds, skeleton base |
| `--color-surface-lighter` | `#252a3a` | `#1E1B18` (warm mid-dark) | Hover states, skeleton highlight |
| `--color-surface-deep` | `#080a10` | `#060504` (deep obsidian) | Deepest background layer |
| `--color-on-surface` | `#f1f5f9` | `#F5E6C8` (champagne) | Primary text |
| `--color-on-surface-muted` | `#a0aec0` | `#9A8E84` (warm gray, 4.6:1 on obsidian) | Secondary text, labels |
| `--color-score` | `#facc15` | `#F5E6C8` (champagne) | Score digits |
| `--color-error` | `#dc2626` | `#DC2626` (keep as-is) | Error states |
| `--color-success` | `#22c55e` | `#4ECDC4` (teal) | Success states (distinct from gold primary) |
| `--color-warning` | `#eab308` | `#E8A820` (warm amber) | Warning states |
| `--color-info` | `#3b82f6` | `#5B9BD5` (warm blue) | Info states |
| `--color-primary-glow` | `rgba(34, 197, 94, 0.15)` | `rgba(212, 168, 83, 0.15)` | Focus rings, input glow |
| `--color-accent-glow` | `rgba(249, 115, 22, 0.15)` | `rgba(255, 194, 52, 0.15)` | Game point glow |
| `--color-score-glow` | `rgba(250, 204, 21, 0.2)` | `rgba(245, 230, 200, 0.2)` | Score digit glow |
| `--color-border` | `rgba(255, 255, 255, 0.08)` | `rgba(212, 168, 83, 0.08)` | Default border tint |
| `--font-score` | `'Oswald', system-ui, sans-serif` | `'Oswald', system-ui, sans-serif` (no change) | Score font stack |

### New Tokens (add to `@theme` block)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-glass-surface` | `rgba(212, 168, 83, 0.02)` | Glass panel backgrounds |
| `--color-glass-border` | `rgba(212, 168, 83, 0.08)` | Glass panel borders |
| `--color-glass-border-hover` | `rgba(212, 168, 83, 0.15)` | Hover/active border state |
| `--color-court-line` | `rgba(212, 168, 83, 0.15)` | Court-line motif default |
| `--color-court-line-strong` | `rgba(212, 168, 83, 0.25)` | Court-line motif emphasized |

### Team Colors (defaults)

| Token | Current | New | Notes |
|-------|---------|-----|-------|
| Team 1 default | `#22c55e` (green) | `#4ECDC4` (teal) | User-customizable, but default changes |
| Team 2 default | `#f97316` (orange) | `#E8725A` (terracotta) | User-customizable, but default changes |

### Glow Effects

| Token | Value | Usage |
|-------|-------|-------|
| `--team1-glow` | `0 0 15px rgba(78, 205, 196, 0.3)` | Team 1 serving glow |
| `--team2-glow` | `0 0 15px rgba(232, 114, 90, 0.3)` | Team 2 serving glow |
| `--accent-glow` | `0 0 20px rgba(255, 194, 52, 0.4)` | Game point glow |

---

## Classic Theme (preserve current look)

The Classic theme preserves ALL current CSS variable values exactly as-is. No changes needed — the existing `@theme` values in `styles.css` become the Classic theme config.

| Token | Value | Notes |
|-------|-------|-------|
| `--color-primary` | `#22c55e` | Current green |
| `--color-accent` | `#f97316` | Current orange |
| `--color-surface` | `#0f1118` | Current dark blue-black |
| `--color-on-surface` | `#f1f5f9` | Current off-white |
| `--color-on-surface-muted` | `#a0aec0` | Current gray |
| `--color-score` | `#facc15` | Current yellow |
| Team 1 default | `#22c55e` | Green |
| Team 2 default | `#f97316` | Orange |
| *(all other tokens)* | *(unchanged)* | |

Classic still gets the new structural additions (court-line motifs, glass panels, net divider) — just with the original colors.

---

## Ember Theme

| Token | Value | Notes |
|-------|-------|-------|
| `--color-primary` | `#E85D26` (ember orange-red) | Primary accent |
| `--color-primary-dark` | `#C44A1A` | Pressed/active variant |
| `--color-accent` | `#FF9142` (molten orange) | Game point, special moments |
| `--color-surface` | `#080605` (warm obsidian) | Page background |
| `--color-surface-light` | `#121010` | Card backgrounds |
| `--color-surface-lighter` | `#1C1816` | Hover states |
| `--color-surface-deep` | `#050403` | Deepest layer |
| `--color-on-surface` | `#F0EDE8` (warm off-white) | Primary text |
| `--color-on-surface-muted` | `#9A8E84` (warm gray, 4.6:1) | Secondary text |
| `--color-score` | `#F0EDE8` (warm off-white) | Score digits |
| `--color-success` | `#2DA8A8` (teal) | Distinct from primary |
| `--color-primary-glow` | `rgba(232, 93, 38, 0.15)` | Focus rings, input glow |
| `--color-accent-glow` | `rgba(255, 145, 66, 0.15)` | Game point glow |
| `--color-score-glow` | `rgba(240, 237, 232, 0.2)` | Score digit glow |
| `--color-border` | `rgba(232, 93, 38, 0.08)` | Border tint |
| `--color-glass-surface` | `rgba(232, 93, 38, 0.02)` | Glass backgrounds |
| `--color-glass-border` | `rgba(232, 93, 38, 0.1)` | Glass borders |
| `--color-court-line` | `rgba(232, 93, 38, 0.15)` | Court-line motif |
| `--color-court-line-strong` | `rgba(232, 93, 38, 0.25)` | Court-line emphasized |
| Team 1 default | `#E85D26` (ember) | |
| Team 2 default | `#2DA8A8` (teal) | |

**Ember signature:** "Lava crack" dividers — court-line motifs rendered in ember colors with `box-shadow: 0 0 8px 1px rgba(232,93,38,0.3)` for a glowing-from-within effect. This glow is applied via the court-line CSS variables automatically.

**Prototype:** `design-protos/arena-ember.html`

---

## Surface Treatments

### Glassmorphism (apply to key elements ONLY)
```css
/* Full glass — top bar, bottom nav, score panels */
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
background: var(--color-glass-surface);
border: 1px solid var(--color-glass-border);
```

### Performance rule: max 3 backdrop-filter elements

Apply `backdrop-filter` to **at most 3 elements** on screen at once (safe budget for mid-range Android):
- Top bar (blur 20px)
- Bottom nav dock (blur 30px)
- Score panels (blur 20px) — the two panels share one containing element with backdrop-filter

Everything else uses a **solid semi-transparent background** with NO backdrop-filter:
```css
/* Non-glass cards, buttons, controls, dialogs, etc. */
background: rgba(10, 9, 8, 0.88);
border: 1px solid var(--color-glass-border);
/* No backdrop-filter */
```

---

## Court-Line Motif System

All court-line utility classes MUST be placed inside `@layer components { }` to avoid specificity conflicts with Tailwind utilities.

```css
@layer components {
  /* Horizontal court line (section dividers) */
  .court-line {
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--color-court-line-strong) 20%, var(--color-court-line-strong) 80%, transparent);
  }

  /* Net divider (between score panels) */
  .net-line {
    width: 1px;
    background: linear-gradient(180deg, transparent, var(--color-court-line) 30%, var(--color-court-line) 70%, transparent);
  }

  /* Diamond center point */
  .net-diamond {
    width: 10px;
    height: 10px;
    transform: rotate(45deg);
    border: 1.5px solid var(--color-court-line-strong);
    background: var(--color-court-line);
  }
}
```

### Court corner brackets (on score panels)
L-shaped 16px corner accents in team colors at 20% opacity, positioned at panel corners. Implemented via CSS `::before`/`::after` pseudo-elements.

### Where court lines appear:
- Between scoreboard and controls (horizontal)
- Between score panels (vertical net line + diamond)
- Score call container borders (top/bottom)
- Bottom nav active indicator
- Quick-action card borders on home page
- Abstract court diagram on home hero

---

## Focus Indicators

When primary changes to gold, focus rings become gold — invisible on gold-bordered elements. Use a dual-ring focus style.

```css
/* Dual-ring: white inner outline + gold outer */
button:focus-visible,
a:focus-visible,
select:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
  box-shadow: 0 0 0 5px var(--color-primary);
}

/* Input focus — uses --color-primary-glow (now gold-tinted) */
input:focus-visible,
textarea:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow), 0 0 15px var(--color-primary-glow);
}
```

This ensures focus is visible on both dark backgrounds and gold-bordered elements.

---

## Typography Hierarchy

### Font Loading

Only Oswald 700 is currently loaded via `@font-face`. The design uses weights 300, 400, 500, and 700. Add the following `@font-face` declarations to `src/styles.css` with self-hosted `.woff2` files:

| Weight | File | Usage |
|--------|------|-------|
| 300 (Light) | `/fonts/Oswald-Light.woff2` | Match scores, metadata |
| 400 (Regular) | `/fonts/Oswald-Regular.woff2` | Team names, section headers, button labels |
| 500 (Medium) | `/fonts/Oswald-Medium.woff2` | Score call |
| 700 (Bold) | `/fonts/Oswald-Bold.woff2` | Score digits, hero title (already loaded) |

Each needs its own `@font-face` block with `font-display: swap`. Download the `.woff2` files from Google Fonts or use `fontsource`.

### Three voices (score -> control -> metadata):

| Role | Font | Weight | Size | Spacing | Color |
|------|------|--------|------|---------|-------|
| Score digits | Oswald | 700 | 72px (scoreboard) | -- | `#F5E6C8` champagne |
| Hero title | Oswald | 700 | 56px | 3px | `#F5E6C8` |
| Team names | Oswald | 400 | 14px | 2px, uppercase | Team color |
| Score call | Oswald | 500 | 28px | 6px | `#F5E6C8` |
| Section headers | Oswald | 400 | 14px | 2.5px, uppercase | `#9A8E84` muted |
| Button labels | Oswald | 400 | 14px | 1.5px, uppercase | `rgba(255,255,255,0.7)` |
| Body text | Inter | 500 | 14px | -- | `rgba(255,255,255,0.9)` |
| Match scores | Oswald | 300 | 13px | 1px | `#9A8E84` muted |
| Metadata | Inter | 300-400 | 11-13px | 0.5-2px | `#9A8E84` muted |
| Serving badge | Inter | 600 | 11px | 1.5px, uppercase | Team color |

---

## Animations

### Existing Animations: Keep, Replace, or Remove

| Keyframe | Fate | Notes |
|----------|------|-------|
| `score-bump` | **Keep** | Unchanged, still used for point scored |
| `score-flash` | **Keep** | Unchanged, brightness flash on score |
| `pulse-glow` | **Keep** | Update: now uses gold `--color-primary-glow` automatically |
| `nav-pill-in` | **Remove** | Replace with court-line bar indicator (no pill) |
| `gradient-shimmer` | **Replace** | Update gradient colors from green/yellow/orange to gold palette |
| `cta-glow-pulse` | **Replace** | Update rgba values from green to gold |
| `fade-in` | **Keep** | Unchanged, generic entrance |
| `skeleton-shimmer` | **Keep** | Uses CSS variables, updates automatically |

### New: Score bump (on point scored)
```css
@keyframes scoreUp {
  0% { transform: scale(1); }
  30% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
/* Duration: 300ms ease */
```

### Serving transition
- Outgoing panel glow fades, incoming ignites
- `transition: border-color 0.4s ease, box-shadow 0.4s ease;` on score panels
- **Never use `transition: all`** -- always list explicit properties

### Ambient background shift
- Subtle radial gradient shifts toward serving team's color
- **Do NOT transition gradient colors directly** (causes 72 full-screen repaints over 1.2s)
- Instead, use opacity cross-fade between two pre-rendered gradient layers:

```css
.ambient-bg {
  position: relative;
}
.ambient-bg::before,
.ambient-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  transition: opacity 1.2s ease;
  will-change: opacity;
}
.ambient-bg::before {
  background: radial-gradient(ellipse at 30% 20%, rgba(78, 205, 196, 0.06) 0%, transparent 70%);
}
.ambient-bg::after {
  background: radial-gradient(ellipse at 70% 20%, rgba(232, 114, 90, 0.06) 0%, transparent 70%);
  opacity: 0;
}
/* Toggle opacity 0/1 on ::before and ::after to cross-fade */
```

### Home hero scan line
- 10% width gold light accent, left-aligned
- Sweeps top to bottom on 4s loop
- **Must use `transform: translateY()` instead of `top`** (animating `top` triggers layout every frame):

```css
@keyframes scanLine {
  0% { transform: translateY(-100%); opacity: 0; }
  5% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(calc(var(--scan-container-height))); opacity: 0; }
}
```

Set `--scan-container-height` on the container via inline style or JS, and position the scan line with `position: absolute; top: 0;`.

### Game point state
- Score digits shift to accent color `#FFC234`
- Text shadow shifts to accent glow
- "Game Point" label pulses (1.5s cycle)
- **Game Point label minimum size: 14px** (not `text-xs`/12px) -- serves as non-animated fallback when `prefers-reduced-motion: reduce` is active

### Continuous animation performance
Add layer promotion hints to continuously animated elements:
```css
/* gamePointPulse, livePulse, and similar */
.game-point-pulse,
.live-pulse {
  will-change: opacity;
  contain: layout style;
}
```

### `transition: all` ban
Never use `transition: all` on any element. Always specify explicit property lists:
```css
/* Good */
.score-panel { transition: border-color 0.4s ease, box-shadow 0.4s ease; }
.ambient-bg::before { transition: opacity 1.2s ease; }

/* Bad -- never do this */
.score-panel { transition: all 0.4s ease; }
```

### Reduced motion
All animations respect `@media (prefers-reduced-motion: reduce)` -- disable animations, keep static styles. Game Point label remains visible at 14px minimum without animation.

---

## Component-Specific Changes

### Scope Clarification: CSS-Only vs JSX Changes

This reskin requires JSX changes in several components for decorative elements. Here is the honest breakdown:

**CSS-only changes** (class swaps, no template changes):
- `src/styles.css` -- all theme variables, keyframes, utilities
- `src/shared/constants/teamColors.ts` -- default color values
- `src/features/scoring/components/ScoreControls.tsx` -- button class updates
- `src/shared/components/TopNav.tsx` -- glass treatment classes
- `src/shared/components/OptionCard.tsx` -- gold selection state classes
- `src/features/scoring/GameSetupPage.tsx` -- option card styling classes

**JSX additions required:**
- `src/features/scoring/components/Scoreboard.tsx` -- Net divider element between panels, CSS custom property bridge for team color (see Dynamic Styling Strategy below)
- `src/features/scoring/ScoringPage.tsx` -- Court-line divider elements between sections
- `src/shared/components/BottomNav.tsx` -- Replace pill indicator with court-line bar element
- `src/shared/components/Logo.tsx` -- Change first span from `text-primary` to `text-on-surface` ("PICKLE" in champagne, "SCORE" in gold)
- Score call display -- Wrap in styled container with court-line borders
- `src/features/history/components/MatchCard.tsx` -- Add "W"/"L" text badge alongside color indicator (see Accessibility below)

**All new decorative elements (net divider, court-line dividers, corner brackets) MUST have `aria-hidden="true"`.**

### Dynamic Styling Strategy (Scoreboard)

Current `Scoreboard.tsx` uses inline `style=` objects for dynamic team colors (`background-color`, `border`, `box-shadow`) which override CSS classes. The glass treatment will not work if inline styles set opaque backgrounds.

**Approach: CSS custom properties as a bridge.**

Set `--team-color` and `--team-color-rgb` via inline style on each score panel, then reference them from CSS classes for glass + serving + game-point states:

```tsx
{/* In JSX -- only set the custom property, not background/border directly */}
<div
  class="score-panel glass-panel"
  style={{ "--team-color": teamColor(), "--team-color-rgb": teamColorRgb() }}
>
```

```css
/* In styles.css */
@layer components {
  .score-panel {
    background: var(--color-glass-surface);
    border: 1px solid var(--color-glass-border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: border-color 0.4s ease, box-shadow 0.4s ease;
  }
  .score-panel.serving {
    border-color: var(--team-color);
    box-shadow: 0 0 15px rgba(var(--team-color-rgb), 0.3);
  }
  .score-panel.game-point {
    border-color: var(--color-accent);
    box-shadow: 0 0 20px var(--color-accent-glow);
  }
}
```

This lets the dynamic team color flow through CSS without inline styles overriding the glass treatment.

### Top Bar
- Glass treatment (blur 20px, within the 3-element budget)
- Gold-tinted border bottom
- Logo: Oswald 700, "PICKLE" champagne (`text-on-surface`) + "SCORE" gold (`text-primary`)

### Bottom Nav
- Floating glass dock (margin from edges, rounded 20px, within the 3-element budget)
- Active indicator: court-line bar (2px gradient) below active icon -- replaces the old pill indicator
- Active icon/label: gold color
- Inactive: muted gray

### Scoreboard
- Two glass panels separated by net-line with diamond (`aria-hidden="true"`)
- Court corner brackets in team colors (`aria-hidden="true"`)
- Score digits in champagne with team-color glow when serving
- Serving badge: small pill with team color border

### Score Controls
- Solid semi-transparent bg (NOT glass -- performance)
- Oswald text, uppercase, letter-spaced
- Side Out button: distinct border style with court-line accent
- Undo: small, muted

### Score Call Display
- Own container with court-line top/bottom borders (`aria-hidden="true"` on decorative borders)
- Format: "7-9-2" (server score - receiver score - server number)
- Oswald 500, 28px

### Home Page (LandingPage.tsx)
- Hero with "GAME ON." title + abstract court diagram
- Quick-action card with court-line border motifs and corner accents
- Recent match cards with court-line left accents (gold=win, rose=loss) plus **"W"/"L" text badge** alongside the color indicator (required for WCAG 1.4.1 color-only compliance)
- Mini-court progress blocks on match cards
- Stats card with gold accent numbers

### Option Cards (Game Setup)
- Glass-sm treatment on selected card (uses solid background, not backdrop-filter)
- Court-line accent on selection border
- Selected: gold border at 30% opacity

### Noise Texture
- SVG fractalNoise overlay at 2.5% opacity
- Fixed position, pointer-events: none
- **Add explicit sizing** to prevent full-viewport SVG filter evaluation:
```css
body::after {
  /* ...existing properties... */
  background-size: 256px 256px;
  background-repeat: repeat;
}
```

---

## Accessibility Requirements

### Muted Text Contrast
The muted text color `#9A8E84` achieves approximately 4.6:1 contrast ratio against the obsidian background `#0A0908`, meeting WCAG AA for normal text (4.5:1 minimum).

### Win/Loss Color Indicator (WCAG 1.4.1)
Match cards use gold (win) vs rose (loss) left accent color. This is color-only differentiation, which fails WCAG 1.4.1. **Add a text badge ("W" or "L") or icon inside the accent strip** so that the outcome is perceivable without color vision.

### Decorative Elements
All purely decorative elements must have `aria-hidden="true"`:
- Net divider (`.net-line`, `.net-diamond`)
- Court-line dividers (`.court-line`)
- Court corner bracket pseudo-elements
- Scan line animation element
- Abstract court diagram on hero

### Focus Indicators
See the dedicated Focus Indicators section above. Dual-ring (white inner + gold outer) ensures visibility on all backgrounds.

### Game Point Label Size
The "Game Point" label must be at least **14px** (not `text-xs`/12px). This ensures readability when animations are disabled via `prefers-reduced-motion: reduce`.

### Custom Team Color Validation
The `TEAM_COLORS` swatch array in `ColorPicker.tsx` must only contain colors that achieve at least 3:1 contrast ratio against the dark surface (`#0A0908`) and the light outdoor surface (`#FFFFFF`). For user-entered custom colors (if supported), add a runtime luminance check that warns when contrast falls below 3:1.

---

## Landscape Mode

`ScoringPage.tsx` renders a completely separate layout in landscape mode (fixed overlay with rearranged panels). This landscape layout **must receive identical styling treatment**: glass panels, net divider, court-line motifs, team color CSS custom property bridge, and all other visual changes described in this doc.

All interactive elements in landscape mode must maintain a minimum tap area of 44x44px. Use padding or margin to meet this if the visible element is smaller.

**Test both portrait and landscape modes for every scoring-related change.**

---

## Visual Consistency Pass

The following components need updating, grouped by priority. Components not in this list either use only theme variables (auto-updated) or are test files.

### P0 -- Core Screens (must update for launch)
| Component | What to update |
|-----------|---------------|
| `LandingPage.tsx` | Replace hardcoded green/orange gradients, update FEATURES `accentRgb` values, court-line dividers, hero styling |
| `ScoringPage.tsx` | Court-line dividers between sections, ambient background, landscape mode layout |
| `Scoreboard.tsx` | Glass panels, net divider, CSS custom property bridge, corner brackets |
| `ScoreControls.tsx` | Button styling, solid semi-transparent bg |
| `GameSetupPage.tsx` | Option card gold selection state |

### P1 -- Frequently Seen (update before release)
| Component | What to update |
|-----------|---------------|
| `MatchCard.tsx` | Gold/rose left accent + W/L badge, court-line motifs |
| `HistoryPage.tsx` | Section headers, card backgrounds |
| `ColorPicker.tsx` | Update `TEAM_COLORS` swatch array (new default teal/terracotta first) |
| `NotificationPanel.tsx` | Card backgrounds, border colors |
| `ConfirmDialog.tsx` | Solid semi-transparent bg, gold primary button |
| `EmptyState.tsx` | Icon and text colors |
| `BottomNav.tsx` | Floating glass dock, court-line active indicator |
| `TopNav.tsx` | Glass treatment, border |
| `Logo.tsx` | "PICKLE" champagne + "SCORE" gold |

### P2 -- Secondary Screens (update in follow-up pass)
| Component | What to update |
|-----------|---------------|
| `ProfilePage.tsx`, `ProfileHeader.tsx`, `StatsOverview.tsx`, `RecentMatches.tsx`, `TierBadge.tsx` | Card backgrounds, accent colors, stat highlights |
| `LeaderboardTab.tsx`, `Podium.tsx`, `RankingsList.tsx`, `UserRankCard.tsx` | Podium colors, rank highlights |
| `TournamentListPage.tsx`, `TournamentCard.tsx`, `BrowseCard.tsx`, `BrowseTab.tsx` | Card styling, accent colors |
| `AchievementBadge.tsx`, `AchievementToast.tsx`, `TrophyCase.tsx` | Badge colors, toast styling |
| `SyncErrorBanner.tsx` | Error banner styling (uses `--color-error`, likely fine) |
| `BuddiesPage.tsx`, `GroupDetailPage.tsx`, `StatusAvatar.tsx`, `ShareSheet.tsx` | Card backgrounds, accent colors |
| `PageLayout.tsx` | Background color (uses `--color-surface`, auto-updated) |

---

## Hardcoded Color Cleanup

These locations have hardcoded green/orange/yellow rgba values that **will not change** when theme variables are swapped. Each must be manually updated.

### In `src/styles.css`:
| Selector | Current Hardcoded Value | New Value |
|----------|------------------------|-----------|
| `.hover-glow-primary:hover` | `rgba(34, 197, 94, 0.3)` | `rgba(212, 168, 83, 0.3)` |
| `.hover-glow-accent:hover` | `rgba(249, 115, 22, 0.3)` | `rgba(255, 194, 52, 0.3)` |
| `.text-gradient` | `#22c55e, #facc15, #f97316` | `#D4A853, #F5E6C8, #FFC234` |
| `.text-gradient-subtle` | `#22c55e, #4ade80` | `#D4A853, #E8C97A` |
| `.text-gradient-animated` | `#22c55e, #4ade80, #facc15, #22c55e` | `#D4A853, #E8C97A, #FFC234, #D4A853` |
| `@keyframes cta-glow-pulse` | `rgba(34, 197, 94, ...)` (all instances) | `rgba(212, 168, 83, ...)` |
| `.cta-glow-active` | (uses cta-glow-pulse, updated via keyframe) | -- |
| `.steps-connector line` stroke | `rgba(34, 197, 94, 0.3)` | `rgba(212, 168, 83, 0.3)` |

### In `src/features/landing/LandingPage.tsx`:
| Location | Current Hardcoded Value | Fix |
|----------|------------------------|-----|
| Divider gradients (lines ~159, ~207, ~246) | `rgba(34, 197, 94, 0.3), rgba(249, 115, 22, 0.2)` | Replace with `rgba(212, 168, 83, 0.3), rgba(255, 194, 52, 0.2)` |
| `FEATURES` array `accentRgb` values | `'34, 197, 94'`, `'249, 115, 22'`, etc. | Update to gold-palette RGB values: e.g., `'212, 168, 83'`, `'255, 194, 52'`, etc. |
| Card hover inline styles (lines ~178-184) | Uses `accentRgb` directly | Will auto-update once FEATURES array is fixed |

---

## Outdoor/High-Contrast Mode

The outdoor mode toggle remains. The current `html.outdoor` block overrides 12 variables. All must be updated for the gold theme. Glass effects are disabled in outdoor mode (solid opaque backgrounds).

### Complete Outdoor Token Overrides

```css
html.outdoor {
  /* Core */
  --color-primary: #7A5C10;        /* dark gold, WCAG AA on white (>= 4.5:1) */
  --color-primary-dark: #5C4408;
  --color-accent: #7A5C10;         /* matches outdoor primary for WCAG AA compliance */
  --color-surface: #FFFFFF;
  --color-surface-light: #F5F0E8;  /* warm off-white */
  --color-surface-lighter: #EDE5D8;
  --color-surface-deep: #FAF8F4;
  --color-on-surface: #0f172a;
  --color-on-surface-muted: #5C5347;
  --color-score: #5C4A0E;          /* dark gold-brown */
  --color-error: #DC2626;
  --color-success: #0D7377;         /* dark teal */
  --color-warning: #92610A;
  --color-info: #1E5FA6;

  /* Glows (subtle in light mode) */
  --color-primary-glow: rgba(122, 92, 16, 0.1);
  --color-accent-glow: rgba(139, 105, 20, 0.1);
  --color-score-glow: rgba(92, 74, 14, 0.15);
  --color-border: rgba(0, 0, 0, 0.08);

  /* Glass/court-line tokens — solid in outdoor mode */
  --color-glass-surface: rgba(255, 255, 255, 0.95);
  --color-glass-border: rgba(0, 0, 0, 0.12);
  --color-glass-border-hover: rgba(0, 0, 0, 0.2);
  --color-court-line: rgba(122, 92, 16, 0.2);
  --color-court-line-strong: rgba(122, 92, 16, 0.35);
}
```

In outdoor mode, **do not apply `backdrop-filter`** to any element. All glass surfaces become solid with the `--color-glass-surface` value above. Add:
```css
html.outdoor .glass-panel {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

---

## Performance Budget

### Backdrop-Filter Budget: Max 3
Only 3 elements may use `backdrop-filter` simultaneously:
1. Top bar
2. Bottom nav dock
3. Score panel container (wraps both panels)

Everything else: `background: rgba(10, 9, 8, 0.88)` with no backdrop-filter.

### Ambient Gradient: Opacity Cross-Fade
Never transition `background` or `background-image` on gradient elements. Use two pre-rendered gradient layers and cross-fade with `opacity` transitions (see Animations section).

### Scan Line: Transform Only
The scan line animation must use `transform: translateY()`. Never animate `top`, `left`, or other layout-triggering properties.

### No `transition: all`
Always specify explicit property lists in transitions. See the `transition: all` ban in the Animations section.

### Continuous Animations: Layer Promotion
Elements with continuous animations (`gamePointPulse`, `livePulse`) must have:
```css
will-change: opacity;
contain: layout style;
```

### Noise Texture: Tiled Background
The noise overlay must include `background-size: 256px 256px; background-repeat: repeat;` to prevent full-viewport SVG filter re-evaluation on every frame.

---

## Files to Modify

### New files:
- `src/shared/constants/themes.ts` -- Theme configs (Classic, Court Vision Gold, Ember) with all CSS variable values and outdoor overrides
- `src/shared/hooks/useTheme.ts` -- Reactive effect that applies theme CSS variables to `document.documentElement` based on `settings().theme` and `settings().displayMode`
- `public/fonts/Oswald-Light.woff2`, `Oswald-Regular.woff2`, `Oswald-Medium.woff2` -- Font files for weights 300, 400, 500

### `src/stores/settingsStore.ts`:
- Add `Theme` type: `'court-vision-gold' | 'classic' | 'ember'`
- Add `theme: Theme` field to `Settings` interface
- Add `theme: 'court-vision-gold'` to `DEFAULTS`

### `src/styles.css` (primary):
- Keep `@theme` variables at Classic values (themes override at runtime via `useTheme`)
- Add new glass/court-line tokens to `@theme`
- Add `@font-face` blocks for Oswald weights 300, 400, 500
- Add court-line utilities inside `@layer components { }`
- Add glass-panel and score-panel classes inside `@layer components { }`
- Update focus indicator styles (dual-ring)
- Replace all hardcoded green/orange rgba values
- Update keyframes: replace `nav-pill-in`, update `gradient-shimmer`, update `cta-glow-pulse`
- Add `background-size` and `background-repeat` to noise overlay
- Add ambient cross-fade CSS
- Add `will-change` / `contain` to continuous animation classes
- Update outdoor mode with complete token overrides
- Disable glass in outdoor mode

### `src/shared/constants/teamColors.ts`:
- Update default team color values (teal/terracotta)

### Font files:
- Add `public/fonts/Oswald-Light.woff2` (weight 300)
- Add `public/fonts/Oswald-Regular.woff2` (weight 400)
- Add `public/fonts/Oswald-Medium.woff2` (weight 500)

### Components requiring JSX changes:
- `src/features/scoring/components/Scoreboard.tsx` -- Net divider element, CSS custom property bridge, court corner brackets
- `src/features/scoring/ScoringPage.tsx` -- Court-line divider elements, ambient background layers, landscape mode styling
- `src/shared/components/BottomNav.tsx` -- Replace pill indicator with court-line bar element
- `src/shared/components/Logo.tsx` -- Change "PICKLE" from `text-primary` to `text-on-surface`
- `src/features/history/components/MatchCard.tsx` -- Add W/L text badge
- Score call display -- Wrap in court-line bordered container

### Components requiring class-only changes:
- `src/features/scoring/components/ScoreControls.tsx`
- `src/features/scoring/GameSetupPage.tsx`
- `src/shared/components/TopNav.tsx`
- `src/shared/components/OptionCard.tsx`
- `src/features/landing/LandingPage.tsx` (also hardcoded color fixes)
- `src/shared/components/ColorPicker.tsx` (TEAM_COLORS array)
- All P1/P2 components listed in Visual Consistency Pass

### Settings page:
- Add theme picker UI (3 option cards: Court Vision Gold, Classic, Ember) to `src/features/settings/SettingsPage.tsx`

### No changes to:
- Any XState machine logic
- Any data layer (Dexie, Firebase, repositories)
- Any existing hooks (haptics, sounds) — `useTheme` is new
- Any routing or navigation logic
- Any test files (visual changes don't affect behavior)

---

## Reference Prototypes
- **Court Vision Gold (default):** `design-protos/court-vision-gold.html`
- **Ember:** `design-protos/arena-ember.html`
- **Classic:** The current app as-is — no prototype needed

Open prototypes in a browser to see the exact visual targets for implementation.
