# Phase 1: Fix & Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make PickleScore production-ready by fixing layout bugs, adding accessibility, native-feel CSS, a settings page, and PWA assets.

**Architecture:** All changes are CSS + HTML + SolidJS component modifications. No new libraries. One new component (ConfirmDialog), one new page (SettingsPage). The changes touch primarily shared components and styles.

**Tech Stack:** SolidJS + TypeScript + Vite 6 + Tailwind CSS v4

---

## Task 1: Native-Feel CSS & Color Contrast Fixes

**Files:**
- Modify: `src/styles.css`
- Modify: `index.html`

**Context:** The app feels "webby" due to missing CSS properties that suppress browser behaviors (pull-to-refresh, double-tap zoom, tap highlight, text selection). Color contrast fails WCAG AA for the error color and muted text is borderline.

**Step 1: Update `src/styles.css`**

Replace the entire file with:

```css
@import "tailwindcss";

@theme {
  --color-primary: #22c55e;
  --color-primary-dark: #16a34a;
  --color-accent: #f97316;
  --color-surface: #1e1e2e;
  --color-surface-light: #2a2a3e;
  --color-surface-lighter: #363650;
  --color-on-surface: #e2e8f0;
  --color-on-surface-muted: #a0aec0;
  --color-score: #facc15;
  --color-error: #dc2626;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-info: #3b82f6;
}

/* Native app feel */
html {
  overscroll-behavior-y: contain;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
}

input, textarea {
  -webkit-user-select: text;
  user-select: text;
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

/* Focus styles for keyboard navigation */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Accessibility: reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 2: Update `index.html`**

Replace the entire `<head>` section to add `color-scheme` and `description` meta tags:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="color-scheme" content="dark" />
    <meta name="description" content="Live pickleball scoring, match history, and player stats" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PickleScore" />
    <meta name="theme-color" content="#1e1e2e" />
    <title>Pickle Score</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

**Step 3: Verify**

Run: `npx vitest run`
Expected: All 45 tests pass (CSS-only changes should not break anything).

**Step 4: Commit**

```bash
git add src/styles.css index.html
git commit -m "fix: add native-feel CSS, fix color contrast, focus styles, reduced motion"
```

---

## Task 2: PageLayout Semantic HTML & Bottom Padding Fix

**Files:**
- Modify: `src/shared/components/PageLayout.tsx`

**Context:** PageLayout already uses `<header>` and `<main>` (line 11, 16) — good. But `pb-20` (80px) is insufficient on iPhone SE, causing BottomNav to overlap content. Also needs `id="main-content"` for skip link and responsive max-width.

**Step 1: Update `src/shared/components/PageLayout.tsx`**

```tsx
import type { Component, JSX } from 'solid-js';

interface Props {
  title: string;
  children: JSX.Element;
}

const PageLayout: Component<Props> = (props) => {
  return (
    <div class="flex flex-col min-h-screen bg-surface">
      <header class="bg-surface-light border-b border-surface-lighter px-4 py-3">
        <div class="max-w-lg mx-auto md:max-w-xl">
          <h1 class="text-lg font-bold text-on-surface">{props.title}</h1>
        </div>
      </header>
      <main id="main-content" class="flex-1 overflow-y-auto pb-24">
        <div class="max-w-lg mx-auto md:max-w-xl">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
```

Changes:
- `pb-20` → `pb-24` (96px, sufficient for bottom nav + safe area)
- Added `id="main-content"` to `<main>` for skip link target
- Added `md:max-w-xl` for wider content on tablets (576px at 768px+ screens)

**Step 2: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/shared/components/PageLayout.tsx
git commit -m "fix: increase bottom padding, add main content ID, responsive max-width"
```

---

## Task 3: BottomNav — Touch Targets, ARIA, 4th Item (Settings)

**Files:**
- Modify: `src/shared/components/BottomNav.tsx`
- Modify: `src/app/router.tsx`

**Context:** BottomNav touch targets are only ~36px (min 48px required). Missing `aria-current`, `aria-label`, `aria-hidden` on SVGs. Need to add Settings as 4th nav item and responsive max-width.

**Step 1: Update `src/shared/components/BottomNav.tsx`**

```tsx
import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';

const BottomNav: Component = () => {
  const location = useLocation();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const linkClass = (path: string) =>
    `flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] px-2 py-1 text-xs font-medium transition-colors ${
      isActive(path) ? 'text-primary' : 'text-on-surface-muted'
    }`;

  return (
    <nav aria-label="Main navigation" class="fixed bottom-0 left-0 right-0 bg-surface-light border-t border-surface-lighter safe-bottom">
      <div class="max-w-lg mx-auto md:max-w-xl flex justify-around py-1">
        <A href="/" class={linkClass('/')} aria-current={isActive('/') ? 'page' : undefined} aria-label="New Game">
          <svg aria-hidden="true" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          <span>New Game</span>
        </A>
        <A href="/history" class={linkClass('/history')} aria-current={isActive('/history') ? 'page' : undefined} aria-label="Match History">
          <svg aria-hidden="true" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>History</span>
        </A>
        <A href="/players" class={linkClass('/players')} aria-current={isActive('/players') ? 'page' : undefined} aria-label="Players">
          <svg aria-hidden="true" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span>Players</span>
        </A>
        <A href="/settings" class={linkClass('/settings')} aria-current={isActive('/settings') ? 'page' : undefined} aria-label="Settings">
          <svg aria-hidden="true" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span>Settings</span>
        </A>
      </div>
    </nav>
  );
};

export default BottomNav;
```

Changes:
- `min-w-[48px] min-h-[48px]` on each link (WCAG touch targets)
- `aria-label` on each link
- `aria-current="page"` on active link
- `aria-hidden="true"` on all SVGs
- `aria-label="Main navigation"` on `<nav>`
- 4th item: Settings with gear icon
- `md:max-w-xl` responsive width

**Step 2: Add Settings route to `src/app/router.tsx`**

Add the lazy import and route:

```tsx
import { lazy } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import App from './App';

const GameSetupPage = lazy(() => import('../features/scoring/GameSetupPage'));
const ScoringPage = lazy(() => import('../features/scoring/ScoringPage'));
const HistoryPage = lazy(() => import('../features/history/HistoryPage'));
const PlayersPage = lazy(() => import('../features/players/PlayersPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));

function NotFoundPage() {
  return (
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
      <p class="text-2xl font-bold text-on-surface">Page Not Found</p>
      <p class="text-on-surface-muted">The page you're looking for doesn't exist.</p>
      <a href="/" class="inline-block px-6 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform">Back to Home</a>
    </div>
  );
}

export default function AppRouter() {
  return (
    <Router root={App}>
      <Route path="/" component={GameSetupPage} />
      <Route path="/score/:matchId" component={ScoringPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/players" component={PlayersPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="*" component={NotFoundPage} />
    </Router>
  );
}
```

Changes:
- Added SettingsPage lazy import and route
- 404 "Back to Home" link upgraded to button-styled element with proper touch target (px-6 py-3)

**Step 3: Verify** — App won't compile yet (SettingsPage doesn't exist). That's created in Task 7. Commit after Task 7.

---

## Task 4: Skip Link in App Shell

**Files:**
- Modify: `src/app/App.tsx`

**Context:** Screen reader / keyboard users need a skip link to jump past navigation to main content. This is a WCAG requirement.

**Step 1: Update `src/app/App.tsx`**

```tsx
import type { Component, JSX } from 'solid-js';
import { Suspense } from 'solid-js';
import BottomNav from '../shared/components/BottomNav';

interface Props {
  children?: JSX.Element;
}

const App: Component<Props> = (props) => {
  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-surface focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      <Suspense fallback={
        <div class="flex items-center justify-center min-h-screen" role="status" aria-label="Loading page">
          <p class="text-on-surface-muted">Loading...</p>
        </div>
      }>
        {props.children}
      </Suspense>
      <BottomNav />
    </div>
  );
};

export default App;
```

Changes:
- Added skip link (visible only on focus, screen-reader accessible)
- Added `role="status"` and `aria-label` on loading fallback

**Step 2: Commit**

```bash
git add src/app/App.tsx
git commit -m "a11y: add skip link and loading state aria attributes"
```

---

## Task 5: ConfirmDialog Component

**Files:**
- Create: `src/shared/components/ConfirmDialog.tsx`

**Context:** Replace all `window.confirm()` calls with an accessible modal. Bottom sheet on mobile (<768px), center modal on larger screens. Focus trap, keyboard support, body scroll lock.

**Step 1: Create `src/shared/components/ConfirmDialog.tsx`**

```tsx
import { Show, onMount, onCleanup, createEffect } from 'solid-js';
import type { Component } from 'solid-js';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined;
  let confirmBtnRef: HTMLButtonElement | undefined;

  // Focus management: focus confirm button when opened
  createEffect(() => {
    if (props.open && confirmBtnRef) {
      confirmBtnRef.focus();
    }
  });

  // Body scroll lock
  createEffect(() => {
    if (props.open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  // Keyboard: Escape to cancel, Tab trap
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      props.onCancel();
      return;
    }

    if (e.key === 'Tab' && dialogRef) {
      const focusable = dialogRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  onMount(() => document.addEventListener('keydown', handleKeyDown));
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.body.style.overflow = '';
  });

  const confirmColor = () =>
    props.variant === 'danger'
      ? 'bg-error text-white'
      : 'bg-primary text-surface';

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50 flex items-end md:items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) props.onCancel(); }}
      >
        <div class="fixed inset-0 bg-black/60" aria-hidden="true" />

        {/* Dialog */}
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          class="relative z-10 w-full md:max-w-sm bg-surface-light rounded-t-2xl md:rounded-2xl p-6 space-y-4"
        >
          <h2 id="confirm-title" class="text-lg font-bold text-on-surface">
            {props.title}
          </h2>
          <p id="confirm-message" class="text-on-surface-muted">
            {props.message}
          </p>
          <div class="flex gap-3 pt-2">
            <button
              type="button"
              onClick={props.onCancel}
              class="flex-1 py-3 rounded-xl bg-surface-lighter text-on-surface font-semibold active:scale-95 transition-transform"
            >
              {props.cancelLabel ?? 'Cancel'}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={props.onConfirm}
              class={`flex-1 py-3 rounded-xl font-semibold active:scale-95 transition-transform ${confirmColor()}`}
            >
              {props.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ConfirmDialog;
```

**Step 2: Commit**

```bash
git add src/shared/components/ConfirmDialog.tsx
git commit -m "feat: add accessible ConfirmDialog component (bottom sheet + center modal)"
```

---

## Task 6: Replace window.confirm() Calls

**Files:**
- Modify: `src/features/players/components/PlayerCard.tsx`
- Modify: `src/features/scoring/ScoringPage.tsx`

**Context:** Two places use `window.confirm()`: PlayerCard delete (line 14) and ScoringPage leave-game guard (line 56). Replace both with ConfirmDialog.

**Step 1: Update `src/features/players/components/PlayerCard.tsx`**

```tsx
import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';
import { db } from '../../../data/db';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import type { Player } from '../../../data/types';

interface Props {
  player: Player;
}

const PlayerCard: Component<Props> = (props) => {
  const joinDate = () => new Date(props.player.createdAt).toLocaleDateString();
  const [showConfirm, setShowConfirm] = createSignal(false);

  const handleDelete = async () => {
    setShowConfirm(false);
    await playerRepository.delete(props.player.id);
    const t1Matches = await db.matches.where('team1PlayerIds').equals(props.player.id).toArray();
    for (const m of t1Matches) {
      await db.matches.update(m.id, {
        team1PlayerIds: m.team1PlayerIds.filter(id => id !== props.player.id),
      });
    }
    const t2Matches = await db.matches.where('team2PlayerIds').equals(props.player.id).toArray();
    for (const m of t2Matches) {
      await db.matches.update(m.id, {
        team2PlayerIds: m.team2PlayerIds.filter(id => id !== props.player.id),
      });
    }
  };

  return (
    <>
      <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-on-surface truncate">{props.player.name}</div>
          <div class="text-xs text-on-surface-muted">Joined {joinDate()}</div>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          aria-label={`Delete ${props.player.name}`}
          class="text-error text-sm px-4 py-3 rounded-lg hover:bg-error/10 active:scale-95 transition-all"
        >
          Delete
        </button>
      </div>
      <ConfirmDialog
        open={showConfirm()}
        title="Delete Player"
        message={`Are you sure you want to delete ${props.player.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};

export default PlayerCard;
```

Changes:
- `confirm()` replaced with ConfirmDialog signal
- Delete button: `px-3 py-1` → `px-4 py-3` (48px+ touch target)
- Added `aria-label` and `active:scale-95`

**Step 2: Update `src/features/scoring/ScoringPage.tsx`**

In the ScoringView component, replace the `useBeforeLeave` block (lines 51-61) with a ConfirmDialog-based approach:

Add import at top:
```tsx
import { Switch, Match, createResource, onCleanup, createSignal } from 'solid-js';
```

Add import:
```tsx
import ConfirmDialog from '../../shared/components/ConfirmDialog';
```

Inside ScoringView, replace the useBeforeLeave block with:
```tsx
  // Navigation guard - SPA navigation
  const [showLeaveConfirm, setShowLeaveConfirm] = createSignal(false);
  let pendingLeaveRetry: (() => void) | null = null;

  useBeforeLeave((e) => {
    const name = stateName();
    if ((name === 'serving' || name === 'betweenGames') && !e.defaultPrevented) {
      e.preventDefault();
      pendingLeaveRetry = () => e.retry(true);
      setShowLeaveConfirm(true);
    }
  });
```

And add the ConfirmDialog JSX at the end of ScoringView's return, just before the closing `</PageLayout>`:
```tsx
      <ConfirmDialog
        open={showLeaveConfirm()}
        title="Leave Game?"
        message="You have an active game in progress. Are you sure you want to leave?"
        confirmLabel="Leave"
        onConfirm={() => {
          setShowLeaveConfirm(false);
          pendingLeaveRetry?.();
          pendingLeaveRetry = null;
        }}
        onCancel={() => {
          setShowLeaveConfirm(false);
          pendingLeaveRetry = null;
        }}
      />
```

Remove the `setTimeout` and `window.confirm` from the old useBeforeLeave handler.

**Step 3: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/features/players/components/PlayerCard.tsx src/features/scoring/ScoringPage.tsx
git commit -m "a11y: replace window.confirm with accessible ConfirmDialog"
```

---

## Task 7: Settings Page

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`

**Context:** The settings store exists (`src/stores/settingsStore.ts`) but has no UI. Create a settings page with controls for all settings, matching the app's visual style.

**Step 1: Create `src/features/settings/SettingsPage.tsx`**

```tsx
import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import { settings, setSettings } from '../../stores/settingsStore';

const SettingsPage: Component = () => {
  return (
    <PageLayout title="Settings">
      <div class="p-4 space-y-6">
        {/* Keep Screen Awake */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Screen
          </legend>
          <button
            type="button"
            onClick={() => setSettings({ keepScreenAwake: !settings().keepScreenAwake })}
            class="w-full flex items-center justify-between bg-surface-light rounded-xl p-4"
            role="switch"
            aria-checked={settings().keepScreenAwake}
          >
            <div>
              <div class="font-semibold text-on-surface text-left">Keep Screen Awake</div>
              <div class="text-sm text-on-surface-muted text-left">Prevents screen sleep during scoring</div>
            </div>
            <div
              class={`w-12 h-7 rounded-full transition-colors relative ${
                settings().keepScreenAwake ? 'bg-primary' : 'bg-surface-lighter'
              }`}
            >
              <div
                class={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  settings().keepScreenAwake ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </fieldset>

        {/* Default Game Type */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Default Game Type
          </legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard
              label="Singles"
              description="1 vs 1"
              selected={settings().defaultScoringMode === 'sideout' && false}
              onClick={() => {}}
            />
            <OptionCard
              label="Doubles"
              description="2 vs 2"
              selected={true}
              onClick={() => {}}
            />
          </div>
        </fieldset>

        {/* Default Scoring Mode */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Default Scoring
          </legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard
              label="Side-Out"
              description="Serving team scores"
              selected={settings().defaultScoringMode === 'sideout'}
              onClick={() => setSettings({ defaultScoringMode: 'sideout' })}
            />
            <OptionCard
              label="Rally"
              description="Point every rally"
              selected={settings().defaultScoringMode === 'rally'}
              onClick={() => setSettings({ defaultScoringMode: 'rally' })}
            />
          </div>
        </fieldset>

        {/* Default Points to Win */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Default Points to Win
          </legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="11" selected={settings().defaultPointsToWin === 11} onClick={() => setSettings({ defaultPointsToWin: 11 })} />
            <OptionCard label="15" selected={settings().defaultPointsToWin === 15} onClick={() => setSettings({ defaultPointsToWin: 15 })} />
            <OptionCard label="21" selected={settings().defaultPointsToWin === 21} onClick={() => setSettings({ defaultPointsToWin: 21 })} />
          </div>
        </fieldset>

        {/* Default Match Format */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Default Match Format
          </legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="1 Game" selected={settings().defaultMatchFormat === 'single'} onClick={() => setSettings({ defaultMatchFormat: 'single' })} />
            <OptionCard label="Best of 3" selected={settings().defaultMatchFormat === 'best-of-3'} onClick={() => setSettings({ defaultMatchFormat: 'best-of-3' })} />
            <OptionCard label="Best of 5" selected={settings().defaultMatchFormat === 'best-of-5'} onClick={() => setSettings({ defaultMatchFormat: 'best-of-5' })} />
          </div>
        </fieldset>

        {/* App Info */}
        <div class="text-center text-xs text-on-surface-muted pt-4">
          <p>PickleScore v1.0</p>
          <p class="mt-1">Offline-first pickleball scoring</p>
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
```

**Step 2: Verify**

Run: `npx vitest run`
Expected: All tests pass. Manually verify the settings page renders at `/settings`.

**Step 3: Commit** (combined with Task 3 router changes)

```bash
git add src/features/settings/SettingsPage.tsx src/shared/components/BottomNav.tsx src/app/router.tsx
git commit -m "feat: add settings page with defaults, 4-item bottom nav with a11y"
```

---

## Task 8: Semantic HTML in Forms (GameSetup + AddPlayerForm)

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`
- Modify: `src/features/players/components/AddPlayerForm.tsx`

**Context:** Form inputs need `<label>` elements and option groups need `<fieldset>` + `<legend>`. The Start Game button needs to be sticky (fixed at bottom) so it's always visible.

**Step 1: Update `src/features/scoring/GameSetupPage.tsx`**

Key changes:
- Wrap each `<section>` in `<fieldset>` with `<legend>`
- Add `<label>` to team name inputs (visually hidden where placeholder suffices)
- Make Start Game button sticky at bottom
- Add `aria-label` to the Start button

Replace the return JSX:

```tsx
  return (
    <PageLayout title="New Game">
      <div class="p-4 space-y-6 pb-24">
        {/* Game Type */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Game Type</legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Singles" description="1 vs 1" selected={gameType() === 'singles'} onClick={() => setGameType('singles')} />
            <OptionCard label="Doubles" description="2 vs 2" selected={gameType() === 'doubles'} onClick={() => setGameType('doubles')} />
          </div>
        </fieldset>

        {/* Scoring Mode */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Scoring</legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Side-Out" description="Serving team scores" selected={scoringMode() === 'sideout'} onClick={() => setScoringMode('sideout')} />
            <OptionCard label="Rally" description="Point every rally" selected={scoringMode() === 'rally'} onClick={() => setScoringMode('rally')} />
          </div>
        </fieldset>

        {/* Points to Win */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Points to Win</legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="11" selected={pointsToWin() === 11} onClick={() => setPointsToWin(11)} />
            <OptionCard label="15" selected={pointsToWin() === 15} onClick={() => setPointsToWin(15)} />
            <OptionCard label="21" selected={pointsToWin() === 21} onClick={() => setPointsToWin(21)} />
          </div>
        </fieldset>

        {/* Match Format */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Match Format</legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="1 Game" selected={matchFormat() === 'single'} onClick={() => setMatchFormat('single')} />
            <OptionCard label="Best of 3" selected={matchFormat() === 'best-of-3'} onClick={() => setMatchFormat('best-of-3')} />
            <OptionCard label="Best of 5" selected={matchFormat() === 'best-of-5'} onClick={() => setMatchFormat('best-of-5')} />
          </div>
        </fieldset>

        {/* Team Names */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Teams</legend>
          <div class="space-y-3">
            <div>
              <label for="team1-name" class="sr-only">Team 1 name</label>
              <input
                id="team1-name"
                type="text"
                value={team1Name()}
                onInput={(e) => setTeam1Name(e.currentTarget.value)}
                maxLength={30}
                class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
                placeholder="Team 1 name"
              />
            </div>
            <div>
              <label for="team2-name" class="sr-only">Team 2 name</label>
              <input
                id="team2-name"
                type="text"
                value={team2Name()}
                onInput={(e) => setTeam2Name(e.currentTarget.value)}
                maxLength={30}
                class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
                placeholder="Team 2 name"
              />
            </div>
          </div>
        </fieldset>
      </div>

      {/* Sticky Start Button */}
      <div class="fixed bottom-16 left-0 right-0 p-4 bg-surface/95 backdrop-blur-sm safe-bottom">
        <div class="max-w-lg mx-auto md:max-w-xl">
          <button
            type="button"
            onClick={startGame}
            disabled={!canStart()}
            aria-label="Start game"
            class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${canStart() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
          >
            Start Game
          </button>
        </div>
      </div>
    </PageLayout>
  );
```

Changes:
- `<section>` → `<fieldset>`, `<h2>` → `<legend>` (styled identically)
- Added `<label>` with `sr-only` class for inputs
- Start button: now `fixed bottom-16` (above BottomNav), always visible
- Content area gets `pb-24` extra padding to not hide behind sticky button

**Step 2: Update `src/features/players/components/AddPlayerForm.tsx`**

Add label for input:

```tsx
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';

const AddPlayerForm: Component = () => {
  const [name, setName] = createSignal('');
  const [showError, setShowError] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) {
      setShowError(true);
      return;
    }
    await playerRepository.create(trimmed);
    setName('');
    setShowError(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} class="flex gap-2" aria-label="Add player">
        <div class="flex-1">
          <label for="player-name" class="sr-only">Player name</label>
          <input
            id="player-name"
            type="text"
            value={name()}
            onInput={(e) => { setName(e.currentTarget.value); setShowError(false); }}
            maxLength={30}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
            placeholder="Player name"
            aria-describedby={showError() ? 'player-name-error' : undefined}
            aria-invalid={showError() ? 'true' : undefined}
          />
        </div>
        <button
          type="submit"
          aria-label="Add player"
          class="bg-primary text-surface font-semibold px-6 rounded-xl active:scale-95 transition-transform"
        >
          Add
        </button>
      </form>
      <Show when={showError()}>
        <p id="player-name-error" class="text-error text-xs mt-1" role="alert">Please enter a player name</p>
      </Show>
    </>
  );
};

export default AddPlayerForm;
```

Changes:
- Added `<label for="player-name">` with `sr-only`
- Added `aria-describedby` linking input to error message
- Added `aria-invalid` when error shown
- Added `role="alert"` on error message
- Added `aria-label` on form and button

**Step 3: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/features/scoring/GameSetupPage.tsx src/features/players/components/AddPlayerForm.tsx
git commit -m "a11y: add fieldsets, labels, aria attributes to forms, sticky Start button"
```

---

## Task 9: Scoreboard & ScoreControls ARIA

**Files:**
- Modify: `src/features/scoring/components/Scoreboard.tsx`
- Modify: `src/features/scoring/components/ScoreControls.tsx`

**Context:** The scoreboard needs `aria-live` for screen reader score announcements. Score buttons need proper `aria-label` and `aria-disabled`.

**Step 1: Update `src/features/scoring/components/Scoreboard.tsx`**

```tsx
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { GameType, ScoringMode } from '../../../data/types';

interface Props {
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  scoringMode: ScoringMode;
  gameType: GameType;
}

const Scoreboard: Component<Props> = (props) => {
  const isServing = (team: 1 | 2) => props.servingTeam === team;
  const showServerNumber = () =>
    props.scoringMode === 'sideout' && props.gameType === 'doubles';

  const scoreAnnouncement = () =>
    `${props.team1Name} ${props.team1Score}, ${props.team2Name} ${props.team2Score}`;

  return (
    <div class="grid grid-cols-2 gap-4 px-4" role="region" aria-label="Scoreboard">
      {/* Screen reader live announcement */}
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {scoreAnnouncement()}
      </div>

      {/* Team 1 */}
      <div
        class="flex flex-col items-center py-6 rounded-2xl transition-all"
        classList={{
          'bg-primary/15 ring-2 ring-primary': isServing(1),
          'bg-surface-light': !isServing(1),
        }}
        aria-label={`${props.team1Name}: ${props.team1Score}${isServing(1) ? ', serving' : ''}`}
      >
        <span class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2">
          {props.team1Name}
        </span>
        <span class="text-7xl font-black text-score tabular-nums">{props.team1Score}</span>
        <Show when={isServing(1)}>
          <span class="mt-2 text-xs font-bold text-primary uppercase tracking-wider">
            {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
          </span>
        </Show>
      </div>

      {/* Team 2 */}
      <div
        class="flex flex-col items-center py-6 rounded-2xl transition-all"
        classList={{
          'bg-primary/15 ring-2 ring-primary': isServing(2),
          'bg-surface-light': !isServing(2),
        }}
        aria-label={`${props.team2Name}: ${props.team2Score}${isServing(2) ? ', serving' : ''}`}
      >
        <span class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2">
          {props.team2Name}
        </span>
        <span class="text-7xl font-black text-score tabular-nums">{props.team2Score}</span>
        <Show when={isServing(2)}>
          <span class="mt-2 text-xs font-bold text-primary uppercase tracking-wider">
            {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
          </span>
        </Show>
      </div>
    </div>
  );
};

export default Scoreboard;
```

Changes:
- Added `role="region"` and `aria-label="Scoreboard"` to container
- Added `aria-live="polite"` hidden div that announces score changes
- Added `aria-label` on each team's panel with score and serving status

**Step 2: Update `src/features/scoring/components/ScoreControls.tsx`**

```tsx
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { ScoringMode } from '../../../data/types';

interface Props {
  team1Name: string;
  team2Name: string;
  scoringMode: ScoringMode;
  servingTeam: 1 | 2;
  onScorePoint: (team: 1 | 2) => void;
  onSideOut: () => void;
  onUndo: () => void;
}

const ScoreControls: Component<Props> = (props) => {
  const team1Active = () => props.scoringMode === 'rally' || props.servingTeam === 1;
  const team2Active = () => props.scoringMode === 'rally' || props.servingTeam === 2;

  return (
    <div class="flex flex-col gap-3 px-4" role="group" aria-label="Score controls">
      {/* Score buttons row */}
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => props.onScorePoint(1)}
          disabled={!team1Active()}
          aria-label={`Score point for ${props.team1Name}`}
          aria-disabled={!team1Active()}
          class={`font-bold text-lg py-6 rounded-2xl transition-transform truncate px-3 ${
            team1Active() ? 'bg-primary text-surface active:scale-95' : 'bg-primary/30 text-surface/50 cursor-not-allowed'
          }`}
        >
          +1 {props.team1Name}
        </button>
        <button
          type="button"
          onClick={() => props.onScorePoint(2)}
          disabled={!team2Active()}
          aria-label={`Score point for ${props.team2Name}`}
          aria-disabled={!team2Active()}
          class={`font-bold text-lg py-6 rounded-2xl transition-transform truncate px-3 ${
            team2Active() ? 'bg-accent text-surface active:scale-95' : 'bg-accent/30 text-surface/50 cursor-not-allowed'
          }`}
        >
          +1 {props.team2Name}
        </button>
      </div>

      {/* Side Out button */}
      <Show when={props.scoringMode === 'sideout'}>
        <button
          type="button"
          onClick={() => props.onSideOut()}
          aria-label="Side out - change serving team"
          class="w-full bg-surface-lighter text-on-surface font-semibold text-base py-6 rounded-2xl active:scale-95 transition-transform"
        >
          Side Out
        </button>
      </Show>

      {/* Undo button */}
      <button
        type="button"
        onClick={() => props.onUndo()}
        aria-label="Undo last action"
        class="w-full bg-surface-light text-on-surface-muted font-medium text-sm py-3 rounded-xl active:scale-95 transition-transform"
      >
        Undo Last
      </button>
    </div>
  );
};

export default ScoreControls;
```

Changes:
- Added `role="group"` and `aria-label="Score controls"`
- Added `disabled` and `aria-disabled` on inactive score buttons
- Added descriptive `aria-label` on all buttons

**Step 3: Verify**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/features/scoring/components/Scoreboard.tsx src/features/scoring/components/ScoreControls.tsx
git commit -m "a11y: add aria-live score announcements, button labels, disabled states"
```

---

## Task 10: Landscape Scoring Layout

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx`
- Modify: `src/styles.css`

**Context:** The scoring page is unusable in landscape because the bottom nav covers the score buttons. In landscape on phones (max-height ~500px), render a side-by-side layout: scoreboard left, controls right. Hide bottom nav during active scoring.

**Step 1: Add landscape detection utility**

In `ScoringPage.tsx`, add a landscape signal inside ScoringView:

```tsx
import { createSignal, onMount, onCleanup } from 'solid-js';

// Inside ScoringView component:
const [isLandscape, setIsLandscape] = createSignal(false);

const checkLandscape = () => {
  setIsLandscape(window.innerHeight < 500 && window.innerWidth > window.innerHeight);
};

onMount(() => {
  checkLandscape();
  window.addEventListener('resize', checkLandscape);
});
onCleanup(() => window.removeEventListener('resize', checkLandscape));
```

**Step 2: Add landscape layout to ScoringView return**

Wrap the serving state match case in a conditional layout:

```tsx
<Match when={stateName() === 'serving'}>
  <Show when={isLandscape()} fallback={
    <ScoreControls
      team1Name={props.match.team1Name}
      team2Name={props.match.team2Name}
      scoringMode={props.match.config.scoringMode}
      servingTeam={ctx().servingTeam}
      onScorePoint={scorePoint}
      onSideOut={sideOut}
      onUndo={undo}
    />
  }>
    {/* Landscape: side-by-side */}
    <div class="fixed inset-0 bg-surface z-40 flex">
      <div class="flex-1 flex items-center justify-center">
        <Scoreboard
          team1Name={props.match.team1Name}
          team2Name={props.match.team2Name}
          team1Score={ctx().team1Score}
          team2Score={ctx().team2Score}
          servingTeam={ctx().servingTeam}
          serverNumber={ctx().serverNumber}
          scoringMode={props.match.config.scoringMode}
          gameType={props.match.config.gameType}
        />
      </div>
      <div class="flex-1 flex items-center">
        <div class="w-full">
          <ScoreControls
            team1Name={props.match.team1Name}
            team2Name={props.match.team2Name}
            scoringMode={props.match.config.scoringMode}
            servingTeam={ctx().servingTeam}
            onScorePoint={scorePoint}
            onSideOut={sideOut}
            onUndo={undo}
          />
        </div>
      </div>
    </div>
  </Show>
</Match>
```

The landscape layout uses `fixed inset-0 z-40` to cover the entire viewport including the bottom nav.

**Step 3: Verify**

Manually test: Open dev tools, set viewport to 812x375 (iPhone landscape). The scoring page should show scoreboard left, controls right, full screen.

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/features/scoring/ScoringPage.tsx
git commit -m "feat: add landscape scoring layout (side-by-side, full screen)"
```

---

## Task 11: PWA Icon Generation

**Files:**
- Create: `public/pwa-192x192.png`
- Create: `public/pwa-512x512.png`
- Create: `public/apple-touch-icon.png`
- Create: `public/favicon.svg`
- Modify: `index.html`
- Modify: `vite.config.ts`

**Context:** The manifest references icon files that don't exist. Generate simple placeholder icons with "PS" monogram (green on dark background).

**Step 1: Create a favicon SVG**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#1e1e2e"/>
  <text x="16" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="16" fill="#22c55e">PS</text>
</svg>
```

**Step 2: Generate PNG icons**

Use a canvas-based approach or an online tool to create the PNGs. For automated generation, the implementer can use a script:

```bash
# If ImageMagick is available:
# Convert SVG to PNGs at required sizes
# Or use an online SVG-to-PNG converter

# For now, create placeholder PNGs using a simple node script
node -e "
const { createCanvas } = require('canvas');
// ... generate icons
"
```

Alternatively, if `canvas` npm package is not available, create a simple HTML page that renders the icon and use a screenshot tool, or simply create the SVGs and note that proper icons will be designed in Phase 2 (brand identity).

For now, create simple SVG-based icons and update the favicon reference:

**Step 3: Update `index.html` favicon**

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

**Step 4: Update `vite.config.ts`** to remove `orientation: 'portrait'` lock (we now support landscape):

Change line 21 from `orientation: 'portrait'` to `orientation: 'any'`.

**Step 5: Verify**

Run: `npx vitest run`
Expected: All tests pass.

Manually verify: App loads with new favicon visible in browser tab.

**Step 6: Commit**

```bash
git add public/favicon.svg public/pwa-192x192.png public/pwa-512x512.png public/apple-touch-icon.png index.html vite.config.ts
git commit -m "feat: add PWA icons and favicon, allow any orientation"
```

---

## Task 12: OptionCard ARIA Enhancement

**Files:**
- Modify: `src/shared/components/OptionCard.tsx`

**Context:** OptionCard is used as a toggle button throughout the app but lacks `aria-pressed` to indicate selected state.

**Step 1: Update `src/shared/components/OptionCard.tsx`**

```tsx
import type { Component } from 'solid-js';

interface Props {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

const OptionCard: Component<Props> = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      class={`w-full p-4 rounded-xl text-left transition-all active:scale-95 ${
        props.selected
          ? 'bg-primary/20 border-2 border-primary text-on-surface'
          : 'bg-surface-light border-2 border-surface-lighter text-on-surface-muted hover:border-on-surface-muted'
      }`}
    >
      <div class="font-semibold">{props.label}</div>
      {props.description && (
        <div class="text-sm text-on-surface-muted mt-0.5">{props.description}</div>
      )}
    </button>
  );
};

export default OptionCard;
```

Changes:
- Added `aria-pressed={props.selected}` to indicate toggle state

**Step 2: Commit**

```bash
git add src/shared/components/OptionCard.tsx
git commit -m "a11y: add aria-pressed to OptionCard for toggle state"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Native-feel CSS, color contrast, focus, reduced motion | `styles.css`, `index.html` |
| 2 | PageLayout padding fix, responsive max-width | `PageLayout.tsx` |
| 3 | BottomNav touch targets, ARIA, Settings nav item | `BottomNav.tsx`, `router.tsx` |
| 4 | Skip link in App shell | `App.tsx` |
| 5 | ConfirmDialog component (accessible modal) | `ConfirmDialog.tsx` (new) |
| 6 | Replace window.confirm() calls | `PlayerCard.tsx`, `ScoringPage.tsx` |
| 7 | Settings page | `SettingsPage.tsx` (new) |
| 8 | Semantic HTML in forms, sticky Start button | `GameSetupPage.tsx`, `AddPlayerForm.tsx` |
| 9 | Scoreboard & ScoreControls ARIA | `Scoreboard.tsx`, `ScoreControls.tsx` |
| 10 | Landscape scoring layout | `ScoringPage.tsx` |
| 11 | PWA icons and favicon | `public/*`, `index.html`, `vite.config.ts` |
| 12 | OptionCard ARIA | `OptionCard.tsx` |

**Dependency order:** Tasks 1-2 are independent. Task 3 depends on Task 7 for commit (SettingsPage). Tasks 5-6 are sequential. Everything else is independent.

**Parallelization groups:**
- **Group A** (independent): Tasks 1, 2, 4, 5, 12
- **Group B** (depends on 5): Task 6
- **Group C** (co-commit): Tasks 3 + 7
- **Group D** (independent): Tasks 8, 9, 10, 11
