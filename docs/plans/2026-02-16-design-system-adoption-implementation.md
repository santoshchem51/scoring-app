# Design System Adoption (CSS-First) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Level up PickleScore's visual quality from "competent side project" to "premium sports app" through Lucide icons, refined dark theme, landing page polish, and desktop responsiveness.

**Architecture:** CSS-first approach — no component library migration, no architecture changes. Install Lucide Solid for icons, update Tailwind theme tokens in `@theme` block, add CSS utilities for glow/gradient/noise effects, and improve responsive layouts. All changes are additive and non-breaking.

**Tech Stack:** SolidJS 1.9, Tailwind CSS v4 (`@theme`), Lucide Solid (new), existing solid-transition-group + CSS animations.

---

### Task 1: Create feature branch

**Files:**
- None (git operation only)

**Step 1: Create and switch to feature branch**

```bash
git checkout -b feature/design-system-polish
```

**Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `feature/design-system-polish`

---

## Session 1: Lucide Solid Icons

### Task 2: Install lucide-solid

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

```bash
npm install lucide-solid
```

**Step 2: Verify install**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Verify tests still pass**

Run: `npx vitest run`
Expected: All 240 tests pass

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install lucide-solid icon library"
```

---

### Task 3: Replace BottomNav inline SVGs with Lucide icons

**Files:**
- Modify: `src/shared/components/BottomNav.tsx`

**Step 1: Replace the component**

Replace the 6 inline `<svg>` elements with Lucide imports. The BottomNav has icons for: New (+), History (clock), Players (users), Tournaments (sparkles), Buddies (heart), Settings (gear).

```tsx
// Add at top of file:
import { Plus, Clock, Users, Sparkles, Heart, Settings } from 'lucide-solid';

// Replace each <svg> block:
// New tab: <svg>...<path d="M12 4v16m8-8H4" />...</svg>
//   → <Plus size={24} class="relative" />

// History tab: <svg>...<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0..." />...</svg>
//   → <Clock size={24} class="relative" />

// Players tab: <svg>...<path d="M17 20h5v-2a3 3 0 00-5.356..." />...</svg>
//   → <Users size={24} class="relative" />

// Tournaments tab: <svg>...<path d="M5 3v4M3 5h4M6 17v4..." />...</svg>
//   → <Sparkles size={24} class="relative" />

// Buddies tab: <svg>...<path d="M4.318 6.318a4.5 4.5..." />...</svg>
//   → <Heart size={24} class="relative" />

// Settings tab: <svg>...<path d="M10.325 4.317c.426..." />...</svg>
//   → <Settings size={24} class="relative" />
```

Remove `aria-hidden="true"` from the old SVGs (Lucide adds it automatically). Keep the `class="relative"` on each icon (needed for z-index over the nav pill background).

**Step 2: Verify dev server renders correctly**

Run: `npx vite --port 5199`
Check: Navigate to `/new`, verify all bottom nav icons render, active tab still highlights green.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass (tests don't check SVG internals)

**Step 4: Commit**

```bash
git add src/shared/components/BottomNav.tsx
git commit -m "style: replace BottomNav inline SVGs with Lucide icons"
```

---

### Task 4: Replace LandingPage inline SVGs with Lucide icons

**Files:**
- Modify: `src/features/landing/LandingPage.tsx`

**Step 1: Replace feature card icons**

The `FEATURES` array uses `iconPath` strings rendered as inline SVGs. Replace with Lucide component references.

```tsx
// Add import at top:
import { Zap, Clock, Trophy, Activity, Share2, UserPlus } from 'lucide-solid';
import type { Component as SolidComponent } from 'solid-js';

// Replace FEATURES array (remove iconPath, add icon component):
const FEATURES: { title: string; description: string; icon: SolidComponent<{ size: number; class?: string }> }[] = [
  {
    title: 'Quick Scoring',
    description: 'One-tap start, swipe to score, works offline court-side.',
    icon: Zap,
  },
  {
    title: 'Match History & Stats',
    description: 'Every game saved, win/loss tracking across all your matches.',
    icon: Clock,
  },
  {
    title: 'Tournament Management',
    description: 'Round-robin, elimination, pool-to-bracket formats with full bracket control.',
    icon: Trophy,
  },
  {
    title: 'Live Real-Time Scores',
    description: 'Point-by-point updates, live standings, spectator views.',
    icon: Activity,
  },
  {
    title: 'Sharing & QR Codes',
    description: 'Public links, QR codes, instant tournament access for anyone.',
    icon: Share2,
  },
  {
    title: 'Player Invitations',
    description: 'Search users, send in-app invites, one-tap accept to join.',
    icon: UserPlus,
  },
];

// In the features grid, replace the SVG rendering:
// Old:
//   <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={f.iconPath} />
//   </svg>
// New:
//   <f.icon size={20} />
```

Note: Use dynamic component rendering `<f.icon size={20} />` which works in SolidJS since components are functions.

**Step 2: Verify landing page renders**

Run dev server, navigate to `/`, verify all 6 feature cards show their Lucide icons.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add src/features/landing/LandingPage.tsx
git commit -m "style: replace LandingPage inline SVGs with Lucide icons"
```

---

### Task 5: Replace GameSetupPage inline SVG with Lucide

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`

**Step 1: Replace Quick Game lightning bolt icon**

```tsx
// Add import:
import { Zap } from 'lucide-solid';

// Line ~103-105: Replace <svg>...<path d="M13 10V3L4 14h7v7l9-11h-7z" />...</svg>
// With:
<Zap size={24} />
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add src/features/scoring/GameSetupPage.tsx
git commit -m "style: replace GameSetupPage inline SVG with Lucide icon"
```

---

### Task 6: Replace HistoryPage and PlayersPage empty state icons

**Files:**
- Modify: `src/features/history/HistoryPage.tsx`
- Modify: `src/features/players/PlayersPage.tsx`

**Step 1: Replace HistoryPage empty state icon**

```tsx
// Add import:
import { Clock } from 'lucide-solid';

// Replace the EmptyState icon prop:
// Old: icon={<svg class="w-8 h-8" ...><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0..." /></svg>}
// New:
icon={<Clock size={32} />}
```

Also fix the `actionHref` — it currently points to `/` (landing page) but should point to `/new` (game setup):
```tsx
actionHref="/new"
```

**Step 2: Replace PlayersPage empty state icon**

```tsx
// Add import:
import { Users } from 'lucide-solid';

// Replace the EmptyState icon prop:
// Old: icon={<svg class="w-8 h-8" ...><path d="M17 20h5v-2a3 3 0 00-5.356..." /></svg>}
// New:
icon={<Users size={32} />}
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add src/features/history/HistoryPage.tsx src/features/players/PlayersPage.tsx
git commit -m "style: replace History and Players empty state icons with Lucide"
```

---

### Task 7: Replace remaining inline SVGs across feature components

**Files:**
- Modify: All remaining files from the grep results that have `<svg` tags:
  - `src/features/scoring/ScoringPage.tsx`
  - `src/features/history/components/MatchCard.tsx`
  - `src/features/tournaments/TournamentListPage.tsx`
  - `src/features/buddies/BuddiesPage.tsx`
  - `src/features/buddies/SessionDetailPage.tsx`
  - `src/features/buddies/PublicSessionPage.tsx`
  - `src/features/buddies/GroupDetailPage.tsx`
  - `src/features/buddies/GroupInvitePage.tsx`
  - `src/features/buddies/OpenPlayPage.tsx`
  - `src/features/buddies/components/ShareSheet.tsx`
  - `src/features/buddies/components/StatusAvatar.tsx`

**Step 1: Read each file, identify the inline SVG, find the matching Lucide icon**

Common mappings:
- `+` / plus path → `Plus`
- Clock/time → `Clock`
- Users/people → `Users`
- Share/link → `Share2`, `Link`, `ExternalLink`
- Arrow/chevron → `ChevronRight`, `ChevronDown`, `ArrowLeft`
- Check/success → `Check`, `CheckCircle`
- X/close → `X`
- Edit/pencil → `Pencil`, `Edit`
- Trash/delete → `Trash2`
- Calendar → `Calendar`
- Map pin → `MapPin`
- Trophy → `Trophy`
- Heart → `Heart`
- Star → `Star`
- Eye → `Eye`
- Copy → `Copy`

**Step 2: Replace each inline SVG with the Lucide equivalent**

For each file: add the import, swap `<svg>...</svg>` with `<IconName size={N} />`, keeping the same effective size.

**Important:** Do NOT touch `src/shared/components/Logo.tsx` or `src/shared/components/ColorPicker.tsx` — Logo has our custom brand SVG, ColorPicker has color swatch circles. These are domain-specific, not generic icons.

**Step 3: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: Clean types, all tests pass

**Step 4: Commit**

```bash
git add src/features/
git commit -m "style: replace all remaining inline SVGs with Lucide icons"
```

---

### Task 8: Verify Session 1 — visual check + build

**Step 1: Run build**

Run: `npx vite build`
Expected: Build succeeds. Check that lucide-solid is tree-shaken (only imported icons in bundle).

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All 240 tests pass

**Step 3: Visual spot-check with Playwright**

Navigate to: `/`, `/new`, `/history`, `/players`, `/settings`
Verify: All icons render correctly, consistent stroke style, correct sizes.

**Step 4: Commit if any fixes were needed**

---

## Session 2: Theme Refinement

### Task 9: Update theme tokens in styles.css

**Files:**
- Modify: `src/styles.css`

**Step 1: Update the `@theme` block colors**

Replace the existing color values with the refined palette. This changes the entire app immediately since all components use these CSS variables.

```css
@theme {
  --color-primary: #22c55e;
  --color-primary-dark: #16a34a;
  --color-accent: #f97316;
  --color-surface: #0f1118;
  --color-surface-light: #1a1d2e;
  --color-surface-lighter: #252a3a;
  --color-on-surface: #f1f5f9;
  --color-on-surface-muted: #a0aec0;
  --color-score: #facc15;
  --color-error: #dc2626;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-info: #3b82f6;
  --color-surface-deep: #080a10;
  --color-primary-glow: rgba(34, 197, 94, 0.15);
  --color-accent-glow: rgba(249, 115, 22, 0.15);
  --color-score-glow: rgba(250, 204, 21, 0.2);
  --color-border: rgba(255, 255, 255, 0.08);
  --font-score: 'Oswald', system-ui, sans-serif;
}
```

**Step 2: Update outdoor mode overrides**

Update the outdoor mode to include the new `--color-border` token:

```css
html.outdoor {
  --color-primary: #15803d;
  --color-primary-dark: #166534;
  --color-surface: #ffffff;
  --color-surface-light: #f1f5f9;
  --color-surface-lighter: #e2e8f0;
  --color-surface-deep: #f8fafc;
  --color-on-surface: #0f172a;
  --color-on-surface-muted: #475569;
  --color-score: #ca8a04;
  --color-primary-glow: rgba(21, 128, 61, 0.1);
  --color-accent-glow: rgba(249, 115, 22, 0.1);
  --color-score-glow: rgba(202, 138, 4, 0.15);
  --color-border: rgba(0, 0, 0, 0.08);
}
```

**Step 3: Verify both themes**

Run dev server. Check `/new` in dark mode (deep dark background). Toggle to outdoor mode in `/settings` — verify light theme still works.

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass (tests don't check colors)

**Step 5: Commit**

```bash
git add src/styles.css
git commit -m "style: refine theme tokens — deeper darks, new border token"
```

---

### Task 10: Add CSS utilities — glow, gradient text, noise texture, skeleton shimmer

**Files:**
- Modify: `src/styles.css`

**Step 1: Add glow utility classes**

After the `@theme` block and existing keyframes, add:

```css
/* Premium glow effects (desktop hover only) */
@media (hover: hover) and (pointer: fine) {
  .hover-glow-primary:hover {
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
  }
  .hover-glow-accent:hover {
    box-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
  }
  .hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  }
}

/* Gradient text utility */
.text-gradient {
  background: linear-gradient(135deg, #22c55e, #facc15, #f97316);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Subtle gradient text (green only) */
.text-gradient-subtle {
  background: linear-gradient(135deg, #22c55e, #4ade80);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Noise texture overlay */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}

/* Disable noise in outdoor mode (light theme) */
html.outdoor body::after {
  display: none;
}
```

**Step 2: Upgrade skeleton shimmer from pulse to sweeping wave**

Replace the existing `.skeleton` class:

```css
/* Skeleton loader — sweeping shimmer */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-light) 0%,
    var(--color-surface-lighter) 50%,
    var(--color-surface-light) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 0.5rem;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Remove the old `skeleton-pulse` keyframe (it's no longer used).

**Step 3: Add stagger animation utility**

```css
/* Staggered entrance animation */
.stagger-in > * {
  opacity: 0;
  animation: fade-in 300ms ease-out forwards;
}
.stagger-in > *:nth-child(1) { animation-delay: 0ms; }
.stagger-in > *:nth-child(2) { animation-delay: 50ms; }
.stagger-in > *:nth-child(3) { animation-delay: 100ms; }
.stagger-in > *:nth-child(4) { animation-delay: 150ms; }
.stagger-in > *:nth-child(5) { animation-delay: 200ms; }
.stagger-in > *:nth-child(6) { animation-delay: 250ms; }
.stagger-in > *:nth-child(7) { animation-delay: 300ms; }
.stagger-in > *:nth-child(8) { animation-delay: 350ms; }
```

**Step 4: Verify visually**

Run dev server. Check:
- Noise texture visible as subtle grain on dark background
- Skeleton shimmer sweeps left-to-right (if any loading states visible)

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 6: Commit**

```bash
git add src/styles.css
git commit -m "style: add glow, gradient text, noise texture, shimmer utilities"
```

---

### Task 11: Apply hover glow to buttons and interactive cards

**Files:**
- Modify: `src/shared/components/OptionCard.tsx`
- Modify: `src/features/landing/LandingPage.tsx` (feature cards)
- Modify: `src/features/history/components/MatchCard.tsx`
- Modify: `src/features/tournaments/components/TournamentCard.tsx`

**Step 1: Add hover-lift to OptionCard**

In `OptionCard.tsx`, add `hover-lift` and `transition-all duration-200` to the button class:

```tsx
// Old:
class={`w-full p-4 rounded-xl text-left transition-all active:scale-95 ${...}`}
// New:
class={`w-full p-4 rounded-xl text-left transition-all duration-200 active:scale-[0.97] hover-lift ${...}`}
```

**Step 2: Add hover-lift to LandingPage feature cards**

In the features grid `.map()`, add to the card div:

```tsx
// Old:
<div class="bg-surface rounded-xl p-5">
// New:
<div class="bg-surface-light rounded-xl p-5 border border-border transition-all duration-200 hover-lift">
```

Note: Changed from `bg-surface` to `bg-surface-light` for elevated card look, added `border border-border`.

**Step 3: Add hover-lift to MatchCard and TournamentCard**

Similar pattern — add `hover-lift transition-all duration-200` to the outer card container in each.

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add src/shared/components/OptionCard.tsx src/features/landing/LandingPage.tsx src/features/history/components/MatchCard.tsx src/features/tournaments/components/TournamentCard.tsx
git commit -m "style: add hover lift effect to cards and option buttons"
```

---

### Task 12: Add focus glow to inputs and primary buttons

**Files:**
- Modify: `src/styles.css`

**Step 1: Enhance focus-visible styles**

Replace the existing focus-visible block with a glow ring:

```css
/* Focus styles for keyboard navigation */
button:focus-visible,
a:focus-visible,
select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

input:focus-visible,
textarea:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow), 0 0 15px var(--color-primary-glow);
}
```

**Step 2: Verify**

Run dev server. Click into a text input on `/new` — should show green glow ring. Tab through buttons — should show green outline.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add src/styles.css
git commit -m "style: add glow focus ring to inputs"
```

---

### Task 13: Verify Session 2 — full visual check

**Step 1: Run build**

Run: `npx vite build`
Expected: Clean build

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 3: Visual spot-check**

Check all pages at 390px mobile width:
- `/` — Deeper dark background, noise grain visible, feature cards have borders
- `/new` — Darker surfaces, input focus has green glow
- `/history` — Empty state looks good on dark background
- `/settings` — OptionCards have hover effect (desktop only)
- Toggle outdoor mode — verify light theme still looks correct, no noise grain

---

## Session 3: Landing Page Polish

### Task 14: Landing page hero — aurora gradient + gradient text

**Files:**
- Modify: `src/features/landing/LandingPage.tsx`

**Step 1: Update hero section**

Replace the hero section with aurora gradient background and gradient text:

```tsx
{/* Hero */}
<section class="relative px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center overflow-hidden">
  {/* Aurora gradient background */}
  <div
    class="absolute inset-0 -z-10"
    style={{
      background: "radial-gradient(ellipse at 30% 0%, rgba(34,197,94,0.12), transparent 50%), radial-gradient(ellipse at 70% 0%, rgba(249,115,22,0.08), transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(250,204,21,0.06), transparent 50%)"
    }}
  />
  <div class="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl">
    <div class="flex justify-center mb-6">
      <Logo size="xl" showIcon />
    </div>
    <p
      class="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 text-gradient"
      style={{ "font-family": "var(--font-score)" }}
    >
      Score. Organize. Compete.
    </p>
    <p class="text-on-surface-muted text-lg mb-8 max-w-md mx-auto">
      The all-in-one pickleball app for scoring games, managing tournaments, and sharing live results.
    </p>
    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      <A
        href="/new"
        class="inline-block bg-primary text-surface font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-[0.97] transition-all duration-200 hover-glow-primary"
      >
        Start Scoring
      </A>
      <A
        href="/tournaments"
        class="inline-block border-2 border-primary text-primary font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-[0.97] transition-all duration-200 hover-glow-primary"
      >
        Manage Tournaments
      </A>
    </div>
  </div>
</section>
```

**Step 2: Verify**

Run dev server. Navigate to `/`. Hero should have subtle green/orange/gold radial glow behind content. "Score. Organize. Compete." should show gradient fill (green → gold → orange).

**Step 3: Commit**

```bash
git add src/features/landing/LandingPage.tsx
git commit -m "style: landing hero — aurora gradient + gradient text"
```

---

### Task 15: Landing page features grid — desktop responsive + stagger

**Files:**
- Modify: `src/features/landing/LandingPage.tsx`

**Step 1: Update features section for desktop width + stagger animation**

```tsx
{/* Features */}
<section class="px-4 py-12 md:py-16 bg-surface-light/50">
  <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
    <h2
      class="text-xl md:text-2xl font-bold text-center mb-8 text-gradient-subtle"
      style={{ "font-family": "var(--font-score)" }}
    >
      Everything You Need
    </h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-in">
      {FEATURES.map((f) => (
        <div class="bg-surface-light rounded-xl p-5 border border-border transition-all duration-200 hover-lift">
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 text-primary">
            <f.icon size={20} />
          </div>
          <h3 class="font-bold text-on-surface mb-1 text-sm">{f.title}</h3>
          <p class="text-xs text-on-surface-muted">{f.description}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

**Step 2: Update "How It Works" section — horizontal on desktop**

```tsx
{/* How It Works */}
<section class="px-4 py-12 md:py-16">
  <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-4xl">
    <h2
      class="text-xl md:text-2xl font-bold text-center mb-8 text-gradient-subtle"
      style={{ "font-family": "var(--font-score)" }}
    >
      How It Works
    </h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
      {STEPS.map((step, i) => (
        <div class="text-center">
          <div class="w-10 h-10 rounded-full bg-primary text-surface font-bold text-lg flex items-center justify-center mx-auto mb-3" style={{ "box-shadow": "0 0 20px rgba(34,197,94,0.3)" }}>
            {i + 1}
          </div>
          <h3 class="font-bold text-on-surface mb-1">{step.title}</h3>
          <p class="text-sm text-on-surface-muted">{step.description}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

**Step 3: Update CTA section and footer containers**

```tsx
{/* Final CTA */}
<section class="px-4 py-12 md:py-16 bg-surface-light/50 text-center">
  <div class="max-w-lg mx-auto md:max-w-2xl">
    ...
  </div>
</section>

{/* Footer */}
<footer class="px-4 py-8 text-center border-t border-border">
  ...
</footer>
```

**Step 4: Verify at both mobile (390px) and desktop (1280px)**

- Mobile: Single column, cards stack vertically
- Desktop: 3-column feature grid, horizontal How It Works, wider content

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 6: Commit**

```bash
git add src/features/landing/LandingPage.tsx
git commit -m "style: landing page — desktop grid, stagger animations, section polish"
```

---

### Task 16: Landing page TopNav — desktop width consistency

**Files:**
- Modify: `src/shared/components/TopNav.tsx`

**Step 1: Update max-width for desktop**

```tsx
// Old:
<div class="max-w-lg mx-auto md:max-w-3xl flex items-center justify-between">
// New:
<div class="max-w-5xl mx-auto flex items-center justify-between">
```

This ensures the TopNav content aligns with the wider desktop containers on the landing page.

**Step 2: Verify**

Check that TopNav logo and Sign In button span the same width as the feature grid on desktop.

**Step 3: Commit**

```bash
git add src/shared/components/TopNav.tsx
git commit -m "style: widen TopNav container for desktop consistency"
```

---

## Session 4: Desktop Responsiveness

### Task 17: Update PageLayout container width

**Files:**
- Modify: `src/shared/components/PageLayout.tsx`

**Step 1: Widen the content container**

```tsx
// Old:
<div class="max-w-lg mx-auto md:max-w-3xl">
// New:
<div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
```

This gives all app pages more room on desktop (>1024px).

**Step 2: Verify**

Check `/new`, `/history`, `/settings` at 1280px width — content should be wider.

**Step 3: Commit**

```bash
git add src/shared/components/PageLayout.tsx
git commit -m "style: widen PageLayout container for desktop"
```

---

### Task 18: Desktop responsive grids on History and Players pages

**Files:**
- Modify: `src/features/history/HistoryPage.tsx`
- Modify: `src/features/players/PlayersPage.tsx`

**Step 1: History page already has `md:grid md:grid-cols-2`**

Verify the grid is working at wider widths. The existing code at line 31 already has:
```tsx
<ul role="list" class="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0 list-none p-0 m-0">
```

Add `lg:grid-cols-3` for 3-column on large desktop:
```tsx
<ul role="list" class="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 space-y-3 md:space-y-0 list-none p-0 m-0">
```

**Step 2: Players page already has `md:grid md:grid-cols-2`**

The existing code at line 33 already handles this. No change needed unless we want 3 columns.

**Step 3: Commit**

```bash
git add src/features/history/HistoryPage.tsx
git commit -m "style: add 3-column history grid on large desktop"
```

---

### Task 19: GameSetupPage and SettingsPage — center forms on desktop

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Step 1: GameSetupPage — center the form on desktop**

The form already has `md:grid md:grid-cols-2 md:gap-6`. The sticky Start Game button at line 202 needs its container updated:

```tsx
// Old:
<div class="max-w-lg mx-auto md:max-w-3xl">
// New:
<div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
```

**Step 2: SettingsPage — already has `md:grid md:grid-cols-2`**

The existing layout at line 36 handles this. No change needed.

**Step 3: Commit**

```bash
git add src/features/scoring/GameSetupPage.tsx
git commit -m "style: widen GameSetupPage container for desktop"
```

---

### Task 20: Final verification — build, tests, visual check

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 2: Full test suite**

Run: `npx vitest run`
Expected: All 240 tests pass

**Step 3: Build**

Run: `npx vite build`
Expected: Clean build. Check bundle size — lucide-solid should add minimal overhead.

**Step 4: Visual verification with Playwright**

Take screenshots at mobile (390x844) and desktop (1280x800) for:
- `/` (landing page)
- `/new` (game setup)
- `/history` (empty state)
- `/players` (empty state)
- `/settings`

Verify:
- Deep dark theme across all pages
- Lucide icons consistent everywhere
- Feature cards have hover lift on desktop
- Landing page has 3-column grid on desktop
- Noise texture visible as subtle grain
- Gradient text on landing hero
- Input focus shows green glow
- Outdoor mode still works (toggle in settings)

**Step 5: No zero-error policy**

If any visual issues found, fix and commit.

---

### Task 21: Commit and push

**Step 1: Push the feature branch**

```bash
git push -u origin feature/design-system-polish
```

Then inform the user the branch is ready for review/merge.
