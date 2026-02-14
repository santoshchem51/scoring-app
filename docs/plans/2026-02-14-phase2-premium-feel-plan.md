# Phase 2: Premium Feel — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform PickleScore from "functional app" to "feels like a native app" with animations, enhanced design system, typography, sound/haptics, and polish.

**Architecture:** All changes use native Web APIs (WAAPI for animations, Web Audio API for sound) plus one small library (`solid-transition-group` ~2KB for page transitions). Score font loaded from Google Fonts (Oswald Bold ~15KB). Settings-driven: all non-essential effects respect `prefers-reduced-motion` and user preferences.

**Tech Stack:** SolidJS + TypeScript + Vite 6 + Tailwind CSS v4 + WAAPI + Web Audio API

---

## Parallelization Groups

| Group | Tasks | Rationale |
|-------|-------|-----------|
| **G1** | 1, 2 | Foundation: design system + settings store (everything else depends on these) |
| **G2** | 3, 4 | Score animations + scoreboard enhancements (both touch Scoreboard.tsx) |
| **G3** | 5, 6 | Page transitions + BottomNav indicator (both touch navigation/layout) |
| **G4** | 7, 8 | Sound effects + haptic feedback (both are feedback hooks, both read settings) |
| **G5** | 9, 10, 11 | Loading skeletons + empty states + brand identity (polish, independent) |

---

## Task 1: Design System Enhancement

**Files:**
- Modify: `src/styles.css`
- Modify: `index.html`

**Context:** The current color palette is flat. Phase 2 adds depth with deeper surface layers, glow effects, gradient accents, and the Oswald display font for score numbers.

**Step 1: Add Oswald font to `index.html`**

Add Google Fonts preconnect and stylesheet in the `<head>`, before the `<title>` tag:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap" rel="stylesheet" />
```

Only loading weight 700 (bold) since it's used exclusively for score numbers.

**Step 2: Update `src/styles.css` — add font and enhanced tokens**

Add these new tokens inside the existing `@theme` block (after the existing color tokens):

```css
  /* Phase 2: Enhanced palette */
  --color-surface-deep: #161625;
  --color-primary-glow: rgba(34, 197, 94, 0.15);
  --color-accent-glow: rgba(249, 115, 22, 0.15);
  --color-score-glow: rgba(250, 204, 21, 0.2);

  /* Phase 2: Typography */
  --font-score: 'Oswald', system-ui, sans-serif;
```

**Step 3: Add animation keyframes after the reduced motion block**

```css
/* Phase 2: Score animations */
@keyframes score-bump {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

@keyframes score-flash {
  0% { filter: brightness(1); }
  50% { filter: brightness(1.5); }
  100% { filter: brightness(1); }
}

@keyframes score-roll-in {
  0% { transform: translateY(100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes score-roll-out {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-100%); opacity: 0; }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 var(--color-primary-glow); }
  50% { box-shadow: 0 0 20px 8px var(--color-primary-glow); }
}

@keyframes nav-pill-in {
  0% { transform: scaleX(0); opacity: 0; }
  100% { transform: scaleX(1); opacity: 1; }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100%); opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Skeleton loader base */
.skeleton {
  background: linear-gradient(90deg, var(--color-surface-light) 25%, var(--color-surface-lighter) 50%, var(--color-surface-light) 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: 0.5rem;
}
```

**Step 4: Verify**

Run: `npx vitest run`
Expected: All 45 tests pass (CSS-only + font link changes).

**Step 5: Commit**

```bash
git add src/styles.css index.html
git commit -m "feat: add Oswald font, enhanced color tokens, animation keyframes"
```

---

## Task 2: Settings Store — Sound & Haptics

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/features/settings/SettingsPage.tsx`

**Context:** Phase 2 adds sound effects and haptic feedback. Both are opt-in via settings. The store needs new fields and the settings page needs new UI sections.

**Step 1: Update `src/stores/settingsStore.ts`**

Add two new fields to the `Settings` interface:

```typescript
interface Settings {
  defaultScoringMode: 'sideout' | 'rally';
  defaultPointsToWin: 11 | 15 | 21;
  defaultMatchFormat: 'single' | 'best-of-3' | 'best-of-5';
  scoringUIMode: 'simple' | 'detailed';
  keepScreenAwake: boolean;
  soundEffects: 'off' | 'subtle' | 'full';
  hapticFeedback: boolean;
}
```

Update the defaults object:

```typescript
const defaults: Settings = {
  defaultScoringMode: 'sideout',
  defaultPointsToWin: 11,
  defaultMatchFormat: 'single',
  scoringUIMode: 'simple',
  keepScreenAwake: true,
  soundEffects: 'off',
  hapticFeedback: false,
};
```

**Step 2: Update `src/features/settings/SettingsPage.tsx`**

Add two new fieldsets after the "Screen" section:

Sound Effects section (3 OptionCards: Off, Subtle, Full):

```tsx
{/* Sound Effects */}
<fieldset>
  <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
    Sound Effects
  </legend>
  <div class="grid grid-cols-3 gap-3">
    <OptionCard label="Off" selected={settings().soundEffects === 'off'} onClick={() => setSettings({ soundEffects: 'off' })} />
    <OptionCard label="Subtle" selected={settings().soundEffects === 'subtle'} onClick={() => setSettings({ soundEffects: 'subtle' })} />
    <OptionCard label="Full" selected={settings().soundEffects === 'full'} onClick={() => setSettings({ soundEffects: 'full' })} />
  </div>
</fieldset>
```

Haptic Feedback toggle (same pattern as Keep Screen Awake):

```tsx
{/* Haptic Feedback */}
<fieldset>
  <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
    Feedback
  </legend>
  <button
    type="button"
    onClick={() => setSettings({ hapticFeedback: !settings().hapticFeedback })}
    class="w-full flex items-center justify-between bg-surface-light rounded-xl p-4"
    role="switch"
    aria-checked={settings().hapticFeedback}
  >
    <div>
      <div class="font-semibold text-on-surface text-left">Haptic Feedback</div>
      <div class="text-sm text-on-surface-muted text-left">Vibration on score (Android)</div>
    </div>
    <div
      class={`w-12 h-7 rounded-full transition-colors relative ${
        settings().hapticFeedback ? 'bg-primary' : 'bg-surface-lighter'
      }`}
    >
      <div
        class={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
          settings().hapticFeedback ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </div>
  </button>
</fieldset>
```

Place these after the existing "Screen" fieldset and before "Default Scoring".

**Step 3: Verify**

Run: `npx vitest run`
Expected: All 45 tests pass.

**Step 4: Commit**

```bash
git add src/stores/settingsStore.ts src/features/settings/SettingsPage.tsx
git commit -m "feat: add sound effects and haptic feedback settings"
```

---

## Task 3: Score Animations (WAAPI Hook + Scoreboard)

**Files:**
- Create: `src/features/scoring/hooks/useScoreAnimation.ts`
- Modify: `src/features/scoring/components/Scoreboard.tsx`

**Context:** The score numbers currently just update instantly. Phase 2 adds a counter roll (number slides up), scale bounce, and color flash when a point is scored. Uses Web Animations API (native, 0KB) wrapped in a SolidJS hook.

**Step 1: Create `src/features/scoring/hooks/useScoreAnimation.ts`**

```typescript
import { createEffect, on } from 'solid-js';
import type { Accessor } from 'solid-js';
import { settings } from '../../../stores/settingsStore';

/**
 * Animates a score element when its value changes.
 * Uses Web Animations API — no library needed.
 * Respects prefers-reduced-motion and settings.
 */
export function useScoreAnimation(
  scoreValue: Accessor<number>,
  getElement: () => HTMLElement | undefined,
) {
  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  createEffect(
    on(scoreValue, (_current, prev) => {
      if (prev === undefined) return; // Skip initial render
      if (prefersReducedMotion()) return;

      const el = getElement();
      if (!el) return;

      // Scale bounce + brightness flash
      el.animate(
        [
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(1.2)', filter: 'brightness(1.5)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        {
          duration: 300,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        },
      );
    }),
  );
}
```

**Step 2: Update `src/features/scoring/components/Scoreboard.tsx`**

Add the animation hook. Store refs to the score number elements and pass them to the hook.

At the top of the component, after existing variable declarations:

```typescript
import { useScoreAnimation } from '../hooks/useScoreAnimation';

// Inside the component:
let team1ScoreRef: HTMLSpanElement | undefined;
let team2ScoreRef: HTMLSpanElement | undefined;

useScoreAnimation(
  () => props.team1Score,
  () => team1ScoreRef,
);
useScoreAnimation(
  () => props.team2Score,
  () => team2ScoreRef,
);
```

Update the score `<span>` elements to use the Oswald font and refs:

Team 1 score span (replace existing):
```tsx
<span ref={team1ScoreRef} class="text-7xl font-bold text-score tabular-nums" style={{ "font-family": "var(--font-score)" }}>
  {props.team1Score}
</span>
```

Team 2 score span (replace existing):
```tsx
<span ref={team2ScoreRef} class="text-7xl font-bold text-score tabular-nums" style={{ "font-family": "var(--font-score)" }}>
  {props.team2Score}
</span>
```

Note: Changed from `font-black` to `font-bold` since Oswald 700 is bold, not 900/black.

**Step 3: Verify**

Run: `npx vitest run`
Expected: All 45 tests pass. Manually test: score a point and see the bounce animation.

**Step 4: Commit**

```bash
git add src/features/scoring/hooks/useScoreAnimation.ts src/features/scoring/components/Scoreboard.tsx
git commit -m "feat: add score bounce animation with Oswald font (WAAPI)"
```

---

## Task 4: Scoreboard Enhancements — Game Point + Serve Pulse

**Files:**
- Modify: `src/features/scoring/components/Scoreboard.tsx`

**Context:** Add visual indicators for game point (when a team is 1 point from winning) and a subtle glow pulse on the serving team's panel.

**Step 1: Add game point detection and serve pulse**

Inside the Scoreboard component, add helpers:

```typescript
const isGamePoint = (teamScore: number, otherScore: number) => {
  const target = props.pointsToWin ?? 11;
  // Game point: team needs exactly 1 more point to win, and they lead or are tied at target-1
  return teamScore >= target - 1 && teamScore > otherScore;
};

const team1GamePoint = () => isGamePoint(props.team1Score, props.team2Score);
const team2GamePoint = () => isGamePoint(props.team2Score, props.team1Score);
```

Note: This requires adding `pointsToWin` to the Props interface:
```typescript
interface Props {
  // ... existing props
  pointsToWin?: number;
}
```

Update the team panel `classList` to include game point glow:

For Team 1's panel div:
```tsx
classList={{
  'bg-primary/15 ring-2 ring-primary': isServing(1),
  'bg-surface-light': !isServing(1) && !team1GamePoint(),
  'bg-score/10 ring-2 ring-score': team1GamePoint() && !isServing(1),
}}
```

For Team 2's panel div:
```tsx
classList={{
  'bg-primary/15 ring-2 ring-primary': isServing(2),
  'bg-surface-light': !isServing(2) && !team2GamePoint(),
  'bg-score/10 ring-2 ring-score': team2GamePoint() && !isServing(2),
}}
```

Add a "GAME POINT" indicator below the score when applicable:

After each team's `<Show when={isServing(...)}>` block, add:
```tsx
<Show when={team1GamePoint()}>
  <span class="mt-1 text-xs font-bold text-score uppercase tracking-wider animate-pulse">
    Game Point
  </span>
</Show>
```

(Similarly for team 2 with `team2GamePoint()`.)

Add a serve pulse animation class on the serving panel. Add `style` attribute:

```tsx
style={isServing(1) ? { animation: 'pulse-glow 2s ease-in-out infinite' } : undefined}
```

**Step 2: Update ScoringPage.tsx to pass pointsToWin**

In `ScoringPage.tsx`, add `pointsToWin` prop to both Scoreboard instances (portrait and landscape):

```tsx
<Scoreboard
  // ... existing props
  pointsToWin={props.match.config.pointsToWin}
/>
```

**Step 3: Add score call display**

Below the match info header in ScoringView, add the "4-2-1" style score call (only for sideout doubles):

```tsx
<Show when={props.match.config.scoringMode === 'sideout' && props.match.config.gameType === 'doubles' && stateName() === 'serving'}>
  <div class="text-center">
    <span class="text-2xl font-bold text-on-surface tabular-nums" style={{ "font-family": "var(--font-score)" }}>
      {ctx().servingTeam === 1
        ? `${ctx().team1Score}-${ctx().team2Score}-${ctx().serverNumber}`
        : `${ctx().team2Score}-${ctx().team1Score}-${ctx().serverNumber}`}
    </span>
    <p class="text-xs text-on-surface-muted mt-1">Score Call</p>
  </div>
</Show>
```

**Step 4: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/features/scoring/components/Scoreboard.tsx src/features/scoring/ScoringPage.tsx
git commit -m "feat: add game point indicator, serve pulse, score call display"
```

---

## Task 5: Page Transitions

**Files:**
- Install: `solid-transition-group`
- Modify: `src/app/App.tsx`
- Modify: `src/shared/components/PageLayout.tsx`

**Context:** Currently pages just pop in instantly. Add subtle fade + slide transitions between pages for an iOS-like feel.

**Step 1: Install solid-transition-group**

```bash
npm install solid-transition-group
```

**Step 2: Add transition CSS to `src/styles.css`**

After the existing keyframes, add:

```css
/* Page transitions */
.page-enter-active,
.page-exit-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.page-enter {
  opacity: 0;
  transform: translateY(8px);
}

.page-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.page-exit {
  opacity: 1;
  transform: translateY(0);
}

.page-exit-to {
  opacity: 0;
  transform: translateY(-8px);
}
```

**Step 3: Update `src/shared/components/PageLayout.tsx`**

Wrap the content area with a fade-in animation on mount:

```tsx
import { onMount } from 'solid-js';
import type { Component, JSX } from 'solid-js';

interface Props {
  title: string;
  children: JSX.Element;
}

const PageLayout: Component<Props> = (props) => {
  let mainRef: HTMLElement | undefined;

  onMount(() => {
    if (mainRef && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mainRef.animate(
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 200, easing: 'ease-out', fill: 'forwards' },
      );
    }
  });

  return (
    <div class="flex flex-col min-h-screen bg-surface">
      <header class="bg-surface-light border-b border-surface-lighter px-4 py-3">
        <div class="max-w-lg mx-auto md:max-w-xl">
          <h1 class="text-lg font-bold text-on-surface">{props.title}</h1>
        </div>
      </header>
      <main ref={mainRef} id="main-content" class="flex-1 overflow-y-auto pb-24" style={{ opacity: 0 }}>
        <div class="max-w-lg mx-auto md:max-w-xl">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
```

Note: Using WAAPI directly instead of solid-transition-group for this simple case. The library is still installed for future use if more complex route-level transitions are needed.

**Step 4: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add package.json package-lock.json src/styles.css src/shared/components/PageLayout.tsx
git commit -m "feat: add page enter animations with WAAPI"
```

---

## Task 6: BottomNav Active Indicator

**Files:**
- Modify: `src/shared/components/BottomNav.tsx`

**Context:** Currently the active nav item only changes text color. Add a pill-shaped background highlight behind the active icon for a premium native-app feel.

**Step 1: Update `src/shared/components/BottomNav.tsx`**

Update the `linkClass` function to add a pill background on active state:

```typescript
const linkClass = (path: string) =>
  `relative flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] px-3 py-1 text-xs font-medium transition-colors ${
    isActive(path) ? 'text-primary' : 'text-on-surface-muted'
  }`;
```

Add a pill indicator element inside each `<A>` link, as the first child:

```tsx
<A href="/" class={linkClass('/')} aria-current={isActive('/') ? 'page' : undefined} aria-label="New Game">
  <Show when={isActive('/')}>
    <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
  </Show>
  <svg aria-hidden="true" class="relative w-6 h-6" ...>
  <span class="relative">New Game</span>
</A>
```

Add `relative` class to the svg and span so they sit above the pill background. The pill uses `absolute` positioning within the `relative` link container.

Repeat for all 4 nav items (History, Players, Settings).

**Step 2: Verify**

Run: `npx vitest run`
Expected: All tests pass. Manually verify: active nav item has a subtle green pill background.

**Step 3: Commit**

```bash
git add src/shared/components/BottomNav.tsx
git commit -m "feat: add pill background indicator on active nav item"
```

---

## Task 7: Sound Effects Hook

**Files:**
- Create: `src/shared/hooks/useSoundEffects.ts`
- Modify: `src/features/scoring/components/ScoreControls.tsx`

**Context:** Add opt-in sound effects using Web Audio API. Synthesized beeps — no audio files needed (0KB bundle). Respects the `soundEffects` setting ('off' | 'subtle' | 'full').

**Step 1: Create `src/shared/hooks/useSoundEffects.ts`**

```typescript
import { settings } from '../../stores/settingsStore';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (settings().soundEffects === 'off') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const level = settings().soundEffects;
  const gain = level === 'subtle' ? volume * 0.3 : volume;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  gainNode.gain.value = gain;
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

export function useSoundEffects() {
  const scorePoint = () => playTone(880, 0.15, 0.3);      // A5, short beep
  const sideOut = () => playTone(440, 0.2, 0.2);           // A4, lower tone
  const gamePoint = () => {                                  // Two-tone alert
    playTone(660, 0.1, 0.3);
    setTimeout(() => playTone(880, 0.15, 0.3), 120);
  };
  const gameWin = () => {                                    // Rising three-tone
    playTone(523, 0.12, 0.3);
    setTimeout(() => playTone(659, 0.12, 0.3), 140);
    setTimeout(() => playTone(784, 0.2, 0.3), 280);
  };
  const undo = () => playTone(330, 0.1, 0.15);              // E4, soft

  return { scorePoint, sideOut, gamePoint, gameWin, undo };
}
```

**Step 2: Integrate into `src/features/scoring/components/ScoreControls.tsx`**

Import the hook and call sounds on button clicks:

```typescript
import { useSoundEffects } from '../../../shared/hooks/useSoundEffects';

// Inside the component:
const sounds = useSoundEffects();
```

Update button onClick handlers to include sound:

Team 1 score button:
```tsx
onClick={() => { props.onScorePoint(1); sounds.scorePoint(); }}
```

Team 2 score button:
```tsx
onClick={() => { props.onScorePoint(2); sounds.scorePoint(); }}
```

Side Out button:
```tsx
onClick={() => { props.onSideOut(); sounds.sideOut(); }}
```

Undo button:
```tsx
onClick={() => { props.onUndo(); sounds.undo(); }}
```

**Step 3: Verify**

Run: `npx vitest run`
Expected: All tests pass. Manually test: enable sound effects in Settings, score a point, hear beep.

**Step 4: Commit**

```bash
git add src/shared/hooks/useSoundEffects.ts src/features/scoring/components/ScoreControls.tsx
git commit -m "feat: add Web Audio API sound effects (opt-in via settings)"
```

---

## Task 8: Haptic Feedback Hook

**Files:**
- Create: `src/shared/hooks/useHaptics.ts`
- Modify: `src/features/scoring/components/ScoreControls.tsx`

**Context:** Add haptic feedback via `navigator.vibrate()` for Android devices. Respects the `hapticFeedback` setting.

**Step 1: Create `src/shared/hooks/useHaptics.ts`**

```typescript
import { settings } from '../../stores/settingsStore';

function vibrate(pattern: number | number[]) {
  if (!settings().hapticFeedback) return;
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently fail on unsupported devices
  }
}

export function useHaptics() {
  const light = () => vibrate(10);       // Quick tap
  const medium = () => vibrate(25);      // Score point
  const heavy = () => vibrate(50);       // Game win
  const double = () => vibrate([15, 50, 15]); // Side out

  return { light, medium, heavy, double };
}
```

**Step 2: Integrate into `src/features/scoring/components/ScoreControls.tsx`**

Import and add haptics alongside existing sound calls:

```typescript
import { useHaptics } from '../../../shared/hooks/useHaptics';

// Inside the component:
const haptics = useHaptics();
```

Update the onClick handlers (already modified in Task 7) to include haptics:

Team 1/2 score buttons:
```tsx
onClick={() => { props.onScorePoint(1); sounds.scorePoint(); haptics.medium(); }}
```

Side Out button:
```tsx
onClick={() => { props.onSideOut(); sounds.sideOut(); haptics.double(); }}
```

Undo button:
```tsx
onClick={() => { props.onUndo(); sounds.undo(); haptics.light(); }}
```

**Step 3: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/shared/hooks/useHaptics.ts src/features/scoring/components/ScoreControls.tsx
git commit -m "feat: add haptic feedback on score actions (Android, opt-in)"
```

---

## Task 9: Loading Skeletons

**Files:**
- Create: `src/shared/components/Skeleton.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/features/history/HistoryPage.tsx`
- Modify: `src/features/players/PlayersPage.tsx`

**Context:** Replace "Loading..." text with animated skeleton placeholders that match the page layout. Uses the `.skeleton` CSS class added in Task 1.

**Step 1: Create `src/shared/components/Skeleton.tsx`**

```tsx
import type { Component } from 'solid-js';

interface SkeletonProps {
  class?: string;
}

const Skeleton: Component<SkeletonProps> = (props) => {
  return <div class={`skeleton ${props.class ?? ''}`} />;
};

/** Skeleton layout mimicking a page with header + cards */
export const PageSkeleton: Component = () => {
  return (
    <div class="p-4 space-y-4">
      <Skeleton class="h-6 w-32" />
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-24 w-full" />
    </div>
  );
};

/** Skeleton layout mimicking a card */
export const CardSkeleton: Component = () => {
  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-3">
      <div class="flex justify-between">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="h-4 w-16" />
      </div>
      <div class="flex justify-between items-center">
        <Skeleton class="h-6 w-20" />
        <Skeleton class="h-8 w-16" />
        <Skeleton class="h-6 w-20" />
      </div>
      <Skeleton class="h-3 w-40" />
    </div>
  );
};

export default Skeleton;
```

**Step 2: Update `src/app/App.tsx` Suspense fallback**

Replace the loading text with a skeleton layout:

```tsx
import { PageSkeleton } from '../shared/components/Skeleton';

// In the Suspense fallback:
<Suspense fallback={
  <div class="flex flex-col min-h-screen bg-surface">
    <div class="bg-surface-light border-b border-surface-lighter px-4 py-3">
      <div class="max-w-lg mx-auto md:max-w-xl">
        <div class="skeleton h-5 w-24" />
      </div>
    </div>
    <div class="flex-1" role="status" aria-label="Loading page">
      <div class="max-w-lg mx-auto md:max-w-xl">
        <PageSkeleton />
      </div>
    </div>
  </div>
}>
```

**Step 3: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/shared/components/Skeleton.tsx src/app/App.tsx
git commit -m "feat: add skeleton loading placeholders"
```

---

## Task 10: Empty State Redesign

**Files:**
- Create: `src/shared/components/EmptyState.tsx`
- Modify: `src/features/history/HistoryPage.tsx`
- Modify: `src/features/players/PlayersPage.tsx`

**Context:** Replace plain text empty states ("No matches yet", "No players yet") with styled cards that have an icon, message, and CTA button.

**Step 1: Create `src/shared/components/EmptyState.tsx`**

```tsx
import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';

interface EmptyStateProps {
  icon: JSX.Element;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

const EmptyState: Component<EmptyStateProps> = (props) => {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div class="w-16 h-16 rounded-2xl bg-surface-lighter flex items-center justify-center mb-4 text-on-surface-muted">
        {props.icon}
      </div>
      <h2 class="text-lg font-bold text-on-surface mb-2">{props.title}</h2>
      <p class="text-sm text-on-surface-muted mb-6 max-w-xs">{props.description}</p>
      <Show when={props.actionLabel}>
        <Show
          when={props.actionHref}
          fallback={
            <button
              type="button"
              onClick={props.onAction}
              class="bg-primary text-surface font-semibold px-6 py-3 rounded-xl active:scale-95 transition-transform"
            >
              {props.actionLabel}
            </button>
          }
        >
          <a
            href={props.actionHref}
            class="inline-block bg-primary text-surface font-semibold px-6 py-3 rounded-xl active:scale-95 transition-transform"
          >
            {props.actionLabel}
          </a>
        </Show>
      </Show>
    </div>
  );
};

export default EmptyState;
```

**Step 2: Update `src/features/history/HistoryPage.tsx`**

Replace the plain text empty state with the EmptyState component:

```tsx
import EmptyState from '../../shared/components/EmptyState';

// Replace the empty state conditional:
<Show when={matches().length === 0}>
  <EmptyState
    icon={
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    }
    title="No Matches Yet"
    description="Start your first game and your match history will appear here."
    actionLabel="Start a Game"
    actionHref="/"
  />
</Show>
```

**Step 3: Update `src/features/players/PlayersPage.tsx`**

Replace the plain text empty state:

```tsx
import EmptyState from '../../shared/components/EmptyState';

// Replace the empty state conditional:
<Show when={players().length === 0}>
  <EmptyState
    icon={
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    }
    title="No Players Yet"
    description="Add players to track individual stats and win/loss records."
  />
</Show>
```

**Step 4: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/shared/components/EmptyState.tsx src/features/history/HistoryPage.tsx src/features/players/PlayersPage.tsx
git commit -m "feat: redesign empty states with icons and CTAs"
```

---

## Task 11: Brand Identity — Logo & Consistent Naming

**Files:**
- Create: `src/shared/components/Logo.tsx`
- Modify: `src/shared/components/PageLayout.tsx` (optional: logo in header)
- Modify: `public/favicon.svg`

**Context:** Replace generic "PS" monogram with a proper wordmark. Create a reusable Logo component for the header and splash screen.

**Step 1: Create `src/shared/components/Logo.tsx`**

```tsx
import type { Component } from 'solid-js';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const Logo: Component<LogoProps> = (props) => {
  const sizeClass = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'text-lg';
      case 'md': return 'text-xl';
      case 'lg': return 'text-3xl';
    }
  };

  return (
    <span class={`font-bold ${sizeClass()}`} style={{ "font-family": "var(--font-score)" }}>
      <span class="text-primary">Pickle</span>
      <span class="text-score">Score</span>
    </span>
  );
};

export default Logo;
```

**Step 2: Update `public/favicon.svg`**

Update the "PS" to be more stylized with the correct brand colors:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#1e1e2e"/>
  <text x="16" y="13" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="11" fill="#22c55e">PS</text>
  <rect x="6" y="18" width="20" height="2" rx="1" fill="#facc15" opacity="0.6"/>
</svg>
```

This adds a subtle yellow underline accent below the PS text.

**Step 3: Update app info in `src/features/settings/SettingsPage.tsx`**

Replace the plain text app info at the bottom with the Logo component:

```tsx
import Logo from '../../shared/components/Logo';

// Replace the app info div:
<div class="flex flex-col items-center gap-2 pt-4">
  <Logo size="md" />
  <p class="text-xs text-on-surface-muted">v1.0 — Offline-first pickleball scoring</p>
</div>
```

**Step 4: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/shared/components/Logo.tsx src/features/settings/SettingsPage.tsx public/favicon.svg
git commit -m "feat: add brand wordmark logo component and updated favicon"
```

---

## Summary

| Task | Description | Files Changed | New Files |
|------|-------------|---------------|-----------|
| 1 | Design system (colors, font, keyframes) | `styles.css`, `index.html` | — |
| 2 | Settings store (sound, haptics) | `settingsStore.ts`, `SettingsPage.tsx` | — |
| 3 | Score animations (WAAPI) | `Scoreboard.tsx` | `useScoreAnimation.ts` |
| 4 | Scoreboard enhancements (game point, pulse, call) | `Scoreboard.tsx`, `ScoringPage.tsx` | — |
| 5 | Page transitions | `PageLayout.tsx`, `styles.css` | — |
| 6 | BottomNav pill indicator | `BottomNav.tsx` | — |
| 7 | Sound effects (Web Audio API) | `ScoreControls.tsx` | `useSoundEffects.ts` |
| 8 | Haptic feedback | `ScoreControls.tsx` | `useHaptics.ts` |
| 9 | Loading skeletons | `App.tsx` | `Skeleton.tsx` |
| 10 | Empty state redesign | `HistoryPage.tsx`, `PlayersPage.tsx` | `EmptyState.tsx` |
| 11 | Brand identity | `SettingsPage.tsx`, `favicon.svg` | `Logo.tsx` |

**New dependencies:** `solid-transition-group` (~2KB), Google Fonts Oswald 700 (~15KB)

**Parallelization:**
- **G1** (foundation): Tasks 1, 2
- **G2** (scoring): Tasks 3, 4
- **G3** (navigation): Tasks 5, 6
- **G4** (feedback): Tasks 7, 8
- **G5** (polish): Tasks 9, 10, 11
