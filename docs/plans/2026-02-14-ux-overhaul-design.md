# PickleScore UI/UX Overhaul — Design Document

**Date**: 2026-02-14
**Status**: Approved
**Approach**: 3-phase incremental overhaul
**Research**: `docs/research/ui-ux-audit-findings.md`, `docs/research/ui-ux-competitive-research.md`

---

## Phased Approach

| Phase | Name | Goal | Scope |
|-------|------|------|-------|
| **1** | Fix & Foundation | Production-ready | Layout bugs, a11y, native-feel CSS, settings page, PWA assets |
| **2** | Premium Feel | Feels like a native app | Animations, design system, typography, scoreboard enhancements, brand |
| **3** | Differentiate | Stands out from competitors | Quick Game, celebrations, voice, sharing, tablet, outdoor mode |

---

## Phase 1: Fix & Foundation

### 1.1 Layout Fixes

#### iPhone SE Bottom Nav Overlap
- **Problem**: BottomNav overlaps Match Format section on 320x568 screens
- **Fix**: Increase PageLayout bottom padding from `pb-20` (80px) to `pb-24` (96px)
- **Verify**: Test on 320x568 viewport that all content is accessible above nav

#### Landscape Scoring Layout
- **Problem**: Scoring page unusable in landscape — nav covers score buttons
- **Fix**: Detect landscape via `@media (orientation: landscape) and (max-height: 500px)` and render:
  - Side-by-side layout: Scoreboard on left, controls on right
  - Hide BottomNav during active scoring in landscape
  - Minimal top bar with game info
- **Components affected**: `ScoringPage.tsx`, `Scoreboard.tsx`, `ScoreControls.tsx`, `BottomNav.tsx`

#### Start Game Below Fold
- **Problem**: CTA not visible without scrolling on standard iPhone (375x812)
- **Fix**: Make "Start Game" button sticky at bottom of viewport, above BottomNav
  - `fixed bottom-20 left-0 right-0` with `max-w-lg mx-auto px-4`
  - Content area gets additional bottom padding to prevent button overlapping last option
- **Component affected**: `GameSetupPage.tsx`

#### iPad Gutters
- **Problem**: `max-w-lg` (512px) too narrow, content looks like phone emulator
- **Fix**: Change to `max-w-xl` (576px) on screens >= 768px via responsive class
- **Components affected**: `PageLayout.tsx`, `BottomNav.tsx`
- **Note**: Full tablet layout (side-by-side) deferred to Phase 3

### 1.2 Native-Feel CSS

Add to `styles.css` on the `html` element:

```css
html {
  overscroll-behavior-y: contain;    /* Kill pull-to-refresh */
  touch-action: manipulation;        /* Kill double-tap zoom */
  -webkit-tap-highlight-color: transparent;  /* Kill blue flash */
  -webkit-user-select: none;         /* Kill text selection */
  user-select: none;
}

/* Re-enable selection on text inputs */
input, textarea {
  -webkit-user-select: text;
  user-select: text;
}
```

### 1.3 Touch Target Fixes

| Element | Current | Target | Fix |
|---------|---------|--------|-----|
| BottomNav links | ~36px | 48px+ | Increase to `py-3`, enlarge icon tap area |
| Delete player button | ~20px | 48px+ | Full-width row with `py-3` |
| 404 "Back to Home" | ~16px | 48px+ | Style as button with proper padding |

### 1.4 Color Contrast Fixes

| Token | Current | New | Reason |
|-------|---------|-----|--------|
| `--color-error` | `#ef4444` | `#dc2626` | Was 4.0:1 (FAIL), now ~4.8:1 (PASS AA) |
| `--color-on-surface-muted` | `#94a3b8` | `#a0aec0` | Was 4.8:1 (borderline), now ~5.5:1 |

Additional:
- Add `<meta name="color-scheme" content="dark">` to `index.html`
- Add semantic tokens: `--color-success: #22c55e`, `--color-warning: #eab308`, `--color-info: #3b82f6`

### 1.5 Semantic HTML & ARIA

#### Semantic Element Conversions

| Current | Convert To | File |
|---------|-----------|------|
| PageLayout header `<div>` | `<header>` | `PageLayout.tsx` |
| PageLayout content `<div>` | `<main>` | `PageLayout.tsx` |
| BottomNav `<nav>` | `<nav aria-label="Main navigation">` | `BottomNav.tsx` |
| GameSetup option groups | `<fieldset>` + `<legend>` | `GameSetupPage.tsx` |
| Form inputs | Add `<label>` (visually hidden via `sr-only` where needed) | `GameSetupPage.tsx`, `AddPlayerForm.tsx` |

#### ARIA Attributes

| Element | Attribute | Value |
|---------|-----------|-------|
| BottomNav active link | `aria-current` | `"page"` |
| SVG icons in nav | `aria-hidden` | `"true"` |
| Score display container | `aria-live` | `"polite"` |
| Score display container | `aria-label` | `"Current score"` |
| Score buttons | `aria-label` | `"Score point for {teamName}"` |
| Inactive score buttons | `aria-disabled` | `"true"` |
| Undo button | `aria-label` | `"Undo last action"` |

#### Skip Link
- Add visually hidden skip link as first element in `App.tsx`: "Skip to main content"
- Target: `<main id="main-content">` in `PageLayout.tsx`
- Visible on focus for keyboard users

### 1.6 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 1.7 Focus Styles

Add consistent focus-visible ring to all interactive elements:

```css
/* Base focus style for all interactive elements */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### 1.8 ConfirmDialog Component

**Purpose**: Replace all `window.confirm()` calls with an accessible modal.

**Behavior**:
- Bottom sheet on mobile (`< 768px`) — slides up from bottom
- Center modal on tablet/desktop (`>= 768px`) — fade + scale in
- Backdrop with `bg-black/60`
- Focus trap: Tab cycles within dialog, Escape dismisses
- Body scroll lock when open

**API**:
```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;  // default: "Confirm"
  cancelLabel?: string;   // default: "Cancel"
  variant?: 'danger' | 'default';  // danger = red confirm button
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Accessibility**:
- `role="alertdialog"`
- `aria-modal="true"`
- `aria-labelledby` pointing to title
- `aria-describedby` pointing to message
- Auto-focus confirm button on open
- Return focus to trigger element on close

**Usage** (replaces 2 existing `window.confirm()` calls):
1. `PlayerCard.tsx` — "Delete {name}?" with danger variant
2. `ScoringPage.tsx` — "Leave active game?" with default variant

### 1.9 Settings Page

**Route**: `/settings`
**Nav**: 4th BottomNav item (gear icon)

**Settings (from existing `settingsStore.ts`)**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Keep Screen Awake | Toggle | ON | Uses Wake Lock API during scoring |
| Default Game Type | OptionCard select | Doubles | Pre-selects on game setup |
| Default Scoring Mode | OptionCard select | Side-Out | Pre-selects on game setup |
| Default Points to Win | OptionCard select | 11 | Pre-selects on game setup |
| Sound Effects | OptionCard select | Off | Off / Subtle / Full (wired in Phase 2) |

**Layout**: Section groups with headers, matching GameSetupPage visual pattern. Toggle switch component for boolean settings.

### 1.10 PWA Assets

**Icons to generate** (placeholder "PS" monogram, green on dark):
- `public/pwa-192x192.png` — 192x192
- `public/pwa-512x512.png` — 512x512
- `public/apple-touch-icon.png` — 180x180
- `public/favicon.ico` — 32x32

**Style**: Stylized "PS" text in `#22c55e` on `#1e1e2e` background with rounded corners.

**Manifest updates**: Ensure `vite.config.ts` PWA manifest references correct icon paths.

---

## Phase 2: Premium Feel (Future — Not in Scope for Phase 1)

High-level outline for planning:

- **Score animations**: Counter roll (number slides up) + scale bounce + color flash via WAAPI
- **Page transitions**: `solid-transition-group` (~2KB) with iOS-like slide animations
- **Design system**: Deeper surface colors, glow effects, gradient accents
- **Custom typography**: Display font for scores (Oswald/Bebas Neue/Orbitron)
- **Scoreboard enhancements**: Score call "4-2-1" display, game point indicator, serve animation
- **Haptic feedback**: `navigator.vibrate()` on Android, audio cues opt-in
- **Sound effects**: Web Audio API synthesized beeps (opt-in via settings)
- **Loading skeletons**: Replace "Loading..." text with animated placeholders
- **Empty state redesign**: Illustrations + CTA buttons
- **Brand identity**: Logo, wordmark, consistent naming
- **BottomNav active indicator**: Pill/dot background highlight

---

## Phase 3: Differentiate (Future — Not in Scope)

- Quick Game one-tap start
- Celebration animations (confetti on game/match win)
- Voice score announcements (Web Speech API)
- Shareable score cards (canvas-rendered image)
- Full tablet/iPad layout (side-by-side)
- Outdoor/high-contrast mode
- Swipe gestures (undo, navigation)
- Custom team colors

---

## Tech Dependencies

### Phase 1 (0KB additional bundle)
- All changes are CSS + HTML + SolidJS components
- No new libraries needed
- ConfirmDialog is custom-built (no dialog library)

### Phase 2 (~2KB additional bundle)
- `solid-transition-group` (~2KB) for page transitions
- Web Animations API (native, 0KB) for score animations
- Web Audio API (native, 0KB) for sound effects

### Phase 3 (0-10KB additional bundle)
- Web Speech API (native, 0KB) for voice announcements
- Canvas API (native, 0KB) for score card generation
- Optional: Howler.js (~10KB) if pre-recorded sounds needed
