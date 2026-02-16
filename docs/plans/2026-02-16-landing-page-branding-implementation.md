# Landing Page & Branding — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a single-scroll landing page at `/`, global TopNav with auth, new logo/branding, OG meta tags, and route changes — giving PickleScore a proper public face.

**Architecture:** LandingPage is a standalone SolidJS component rendered at `/` inside the existing `App` root layout but with BottomNav hidden. TopNav replaces the current `PageLayout` title bar on all app pages and appears in a landing-specific variant on the landing page. Auth moves from Settings to TopNav. GameSetupPage moves from `/` to `/new`.

**Tech Stack:** SolidJS 1.9 + TypeScript + Tailwind CSS v4 + @solidjs/router + Firebase Auth (existing useAuth hook)

---

### Task 1: Create feature branch

**Files:** None (git operation only)

**Step 1: Create and switch to feature branch**

Run:
```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git checkout -b feature/landing-page-branding
```
Expected: `Switched to a new branch 'feature/landing-page-branding'`

---

### Task 2: New favicon SVG

**Files:**
- Modify: `public/favicon.svg`

The current favicon is a simple "PS" text on a dark rounded square. Replace it with a stylized pickleball (circle with characteristic holes) plus a score accent bar.

**Step 1: Replace favicon.svg**

Write `public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#1e1e2e"/>
  <!-- Pickleball outline -->
  <circle cx="16" cy="14" r="9" fill="none" stroke="#22c55e" stroke-width="2"/>
  <!-- Pickleball holes -->
  <circle cx="13" cy="11" r="1.3" fill="#22c55e"/>
  <circle cx="19" cy="11" r="1.3" fill="#22c55e"/>
  <circle cx="16" cy="15" r="1.3" fill="#22c55e"/>
  <circle cx="12" cy="17" r="1.3" fill="#22c55e"/>
  <circle cx="20" cy="17" r="1.3" fill="#22c55e"/>
  <!-- Score accent bar -->
  <rect x="8" y="26" width="16" height="2.5" rx="1.25" fill="#facc15"/>
</svg>
```

**Step 2: Commit**

```bash
git add public/favicon.svg && git commit -m "feat: replace favicon with pickleball logo icon"
```

---

### Task 3: Update Logo component

**Files:**
- Modify: `src/shared/components/Logo.tsx`

Add a `LogoIcon` component (pickleball SVG rendered inline) and export it. Add `showIcon` prop to Logo and `'xl'` size option.

**Step 1: Rewrite Logo.tsx**

Write `src/shared/components/Logo.tsx`:
```tsx
import { Show } from 'solid-js';
import type { Component } from 'solid-js';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showIcon?: boolean;
}

const LogoIcon: Component<{ class?: string }> = (props) => (
  <svg class={props.class} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="16" cy="14" r="9" stroke="currentColor" stroke-width="2" class="text-primary" />
    <circle cx="13" cy="11" r="1.3" fill="currentColor" class="text-primary" />
    <circle cx="19" cy="11" r="1.3" fill="currentColor" class="text-primary" />
    <circle cx="16" cy="15" r="1.3" fill="currentColor" class="text-primary" />
    <circle cx="12" cy="17" r="1.3" fill="currentColor" class="text-primary" />
    <circle cx="20" cy="17" r="1.3" fill="currentColor" class="text-primary" />
    <rect x="8" y="26" width="16" height="2.5" rx="1.25" fill="currentColor" class="text-score" />
  </svg>
);

const Logo: Component<LogoProps> = (props) => {
  const sizeClass = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'text-lg';
      case 'md': return 'text-xl';
      case 'lg': return 'text-3xl';
      case 'xl': return 'text-5xl';
    }
  };

  const iconSize = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'w-5 h-5';
      case 'md': return 'w-6 h-6';
      case 'lg': return 'w-9 h-9';
      case 'xl': return 'w-12 h-12';
    }
  };

  return (
    <span class={`inline-flex items-center gap-1.5 font-bold ${sizeClass()}`} style={{ "font-family": "var(--font-score)" }}>
      <Show when={props.showIcon}>
        <LogoIcon class={iconSize()} />
      </Show>
      <span>
        <span class="text-primary">Pickle</span>
        <span class="text-score">Score</span>
      </span>
    </span>
  );
};

export { LogoIcon };
export default Logo;
```

**Step 2: Verify type check**

Run: `cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors (LogoProps is backward-compatible — `showIcon` and `'xl'` are both optional additions).

**Step 3: Commit**

```bash
git add src/shared/components/Logo.tsx && git commit -m "feat: add LogoIcon component and icon support to Logo"
```

---

### Task 4: Create TopNav component

**Files:**
- Create: `src/shared/components/TopNav.tsx`

Global top navigation with logo on left, auth on right. Two variants: `'app'` (page title, bordered) and `'landing'` (wordmark, transparent).

**Step 1: Create TopNav.tsx**

Write `src/shared/components/TopNav.tsx`:
```tsx
import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../hooks/useAuth';
import Logo, { LogoIcon } from './Logo';

interface TopNavProps {
  pageTitle?: string;
  variant?: 'app' | 'landing';
}

const TopNav: Component<TopNavProps> = (props) => {
  const { user, loading, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = createSignal(false);

  const isLanding = () => (props.variant ?? 'app') === 'landing';

  return (
    <header
      class={`px-4 py-2.5 ${isLanding() ? '' : 'bg-surface-light border-b border-surface-lighter'}`}
    >
      <div class="max-w-lg mx-auto md:max-w-3xl flex items-center justify-between">
        {/* Left: Logo + title or wordmark */}
        <A href="/" class="flex items-center gap-2 no-underline">
          <LogoIcon class="w-7 h-7" />
          <Show
            when={props.pageTitle}
            fallback={<Logo size="sm" />}
          >
            <span class="text-lg font-bold text-on-surface">{props.pageTitle}</span>
          </Show>
        </A>

        {/* Right: Auth */}
        <Show when={!loading()}>
          <Show
            when={user()}
            fallback={
              <button
                type="button"
                onClick={() => signIn()}
                class="text-sm font-semibold text-primary px-3 py-1.5 rounded-lg bg-primary/10 active:scale-95 transition-transform"
              >
                Sign In
              </button>
            }
          >
            <div class="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen())}
                class="flex items-center active:scale-95 transition-transform"
                aria-label="Account menu"
              >
                <Show
                  when={user()?.photoURL}
                  fallback={
                    <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-surface font-bold text-sm">
                      {user()?.displayName?.charAt(0) ?? '?'}
                    </div>
                  }
                >
                  <img
                    src={user()!.photoURL!}
                    alt=""
                    class="w-8 h-8 rounded-full"
                    referrerpolicy="no-referrer"
                  />
                </Show>
              </button>

              {/* Dropdown menu */}
              <Show when={menuOpen()}>
                <div
                  class="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div class="absolute right-0 top-full mt-2 w-56 bg-surface-light rounded-xl shadow-lg border border-surface-lighter z-50 overflow-hidden">
                  <div class="px-4 py-3 border-b border-surface-lighter">
                    <div class="font-semibold text-on-surface text-sm truncate">
                      {user()?.displayName}
                    </div>
                    <div class="text-xs text-on-surface-muted truncate">
                      {user()?.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setMenuOpen(false);
                    }}
                    class="w-full text-left px-4 py-3 text-sm text-on-surface-muted hover:bg-surface-lighter transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </header>
  );
};

export default TopNav;
```

**Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/shared/components/TopNav.tsx && git commit -m "feat: create TopNav component with auth and logo"
```

---

### Task 5: Update PageLayout to use TopNav

**Files:**
- Modify: `src/shared/components/PageLayout.tsx`

Replace the current `<header>` with TopNav. Keep the page entrance animation on `<main>`.

**Step 1: Rewrite PageLayout.tsx**

Write `src/shared/components/PageLayout.tsx`:
```tsx
import { onMount } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import TopNav from './TopNav';

interface Props {
  title: string;
  children: JSX.Element;
}

const PageLayout: Component<Props> = (props) => {
  let mainRef: HTMLElement | undefined;

  onMount(() => {
    if (!mainRef) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mainRef.style.opacity = '1';
      return;
    }
    mainRef.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 200, easing: 'ease-out', fill: 'forwards' },
    );
  });

  return (
    <div class="flex flex-col min-h-screen bg-surface">
      <TopNav pageTitle={props.title} />
      <main ref={mainRef} id="main-content" class="flex-1 overflow-y-auto pb-24" style={{ opacity: "0" }}>
        <div class="max-w-lg mx-auto md:max-w-3xl">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
```

**Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/shared/components/PageLayout.tsx && git commit -m "feat: replace PageLayout title bar with TopNav"
```

---

### Task 6: Create LandingPage component

**Files:**
- Create: `src/features/landing/LandingPage.tsx`

Single-scroll page: hero → features (6 cards) → how it works (3 steps) → CTA → footer. Uses TopNav with `variant="landing"`. Does NOT use PageLayout or BottomNav.

**Step 1: Create the directory and component**

Write `src/features/landing/LandingPage.tsx`:
```tsx
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import TopNav from '../../shared/components/TopNav';
import Logo from '../../shared/components/Logo';

const LandingPage: Component = () => {
  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <TopNav variant="landing" />

      {/* Hero */}
      <section class="px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center bg-gradient-to-b from-primary-glow to-transparent">
        <div class="max-w-lg mx-auto md:max-w-2xl">
          <div class="flex justify-center mb-6">
            <Logo size="xl" showIcon />
          </div>
          <p
            class="text-2xl md:text-3xl font-bold text-on-surface mb-3"
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
              class="inline-block bg-primary text-surface font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-95 transition-transform"
            >
              Start Scoring
            </A>
            <A
              href="/tournaments"
              class="inline-block border-2 border-primary text-primary font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-95 transition-transform"
            >
              Manage Tournaments
            </A>
          </div>
        </div>
      </section>

      {/* Features */}
      <section class="px-4 py-12 bg-surface-light">
        <div class="max-w-lg mx-auto md:max-w-3xl">
          <h2
            class="text-xl font-bold text-center mb-8"
            style={{ "font-family": "var(--font-score)" }}
          >
            Everything You Need
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div class="bg-surface rounded-xl p-5">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 text-primary">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d={f.iconPath}
                    />
                  </svg>
                </div>
                <h3 class="font-bold text-on-surface mb-1 text-sm">{f.title}</h3>
                <p class="text-xs text-on-surface-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section class="px-4 py-12">
        <div class="max-w-lg mx-auto md:max-w-3xl">
          <h2
            class="text-xl font-bold text-center mb-8"
            style={{ "font-family": "var(--font-score)" }}
          >
            How It Works
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div class="text-center">
                <div class="w-10 h-10 rounded-full bg-primary text-surface font-bold text-lg flex items-center justify-center mx-auto mb-3">
                  {i + 1}
                </div>
                <h3 class="font-bold text-on-surface mb-1">{step.title}</h3>
                <p class="text-sm text-on-surface-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section class="px-4 py-12 bg-surface-light text-center">
        <div class="max-w-lg mx-auto">
          <h2
            class="text-2xl font-bold mb-4"
            style={{ "font-family": "var(--font-score)" }}
          >
            Ready to play?
          </h2>
          <A
            href="/new"
            class="inline-block bg-primary text-surface font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-95 transition-transform"
          >
            Get Started
          </A>
        </div>
      </section>

      {/* Footer */}
      <footer class="px-4 py-8 text-center">
        <Logo size="sm" />
        <p class="text-xs text-on-surface-muted mt-2">
          Built for pickleball players and organizers
        </p>
        <p class="text-xs text-on-surface-muted mt-1">
          Install as an app from your browser menu
        </p>
      </footer>
    </div>
  );
};

/* ─── Static Data ─────────────────────────────────────────── */

const FEATURES = [
  {
    title: 'Quick Scoring',
    description: 'One-tap start, swipe to score, works offline court-side.',
    iconPath: 'M12 4v16m8-8H4',
  },
  {
    title: 'Match History & Stats',
    description: 'Every game saved, win/loss tracking across all your matches.',
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Tournament Management',
    description: 'Round-robin, elimination, pool-to-bracket formats with full bracket control.',
    iconPath: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  },
  {
    title: 'Live Real-Time Scores',
    description: 'Point-by-point updates, live standings, spectator views.',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    title: 'Sharing & QR Codes',
    description: 'Public links, QR codes, instant tournament access for anyone.',
    iconPath: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  },
  {
    title: 'Player Invitations',
    description: 'Search users, send in-app invites, one-tap accept to join.',
    iconPath: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  },
];

const STEPS = [
  {
    title: 'Score',
    description: 'Tap to score, swipe to undo. Works offline.',
  },
  {
    title: 'Organize',
    description: 'Create tournaments, invite players, manage brackets.',
  },
  {
    title: 'Share',
    description: 'QR codes, live links, real-time spectator views.',
  },
];

export default LandingPage;
```

**Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/features/landing/LandingPage.tsx && git commit -m "feat: create LandingPage with hero, features, how-it-works, CTA, footer"
```

---

### Task 7: Routing changes, BottomNav update, and App.tsx conditional BottomNav

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/shared/components/BottomNav.tsx`

Three related changes that must happen together: (1) add LandingPage at `/`, move GameSetupPage to `/new`; (2) hide BottomNav on the landing page; (3) update BottomNav "New" tab to link to `/new`.

**Step 1: Update router.tsx**

In `src/app/router.tsx`:

Add lazy import for LandingPage at the top (after existing lazy imports):
```tsx
const LandingPage = lazy(() => import('../features/landing/LandingPage'));
```

Change the `/` route and add `/new`:
```tsx
<Route path="/" component={LandingPage} />
<Route path="/new" component={GameSetupPage} />
```

The full routes section becomes:
```tsx
<Router root={App}>
  <Route path="/" component={LandingPage} />
  <Route path="/new" component={GameSetupPage} />
  <Route path="/score/:matchId" component={ScoringPage} />
  <Route path="/history" component={HistoryPage} />
  <Route path="/players" component={PlayersPage} />
  <Route path="/tournaments" component={RequireAuth}>
    <Route path="/" component={TournamentListPage} />
    <Route path="/new" component={TournamentCreatePage} />
    <Route path="/:id" component={TournamentDashboardPage} />
  </Route>
  <Route path="/t/:code" component={PublicTournamentPage} />
  <Route path="/settings" component={SettingsPage} />
  <Route path="*" component={NotFoundPage} />
</Router>
```

**Step 2: Update App.tsx**

In `src/app/App.tsx`:

Add imports:
```tsx
import { Show } from 'solid-js';
import { useLocation } from '@solidjs/router';
```

Inside the component, add location check:
```tsx
const location = useLocation();
const showBottomNav = () => location.pathname !== '/';
```

Wrap BottomNav conditionally:
```tsx
<Show when={showBottomNav()}>
  <BottomNav />
</Show>
```

The full component becomes:
```tsx
import type { Component, JSX } from 'solid-js';
import { Show, Suspense, createEffect } from 'solid-js';
import { useLocation } from '@solidjs/router';
import BottomNav from '../shared/components/BottomNav';
import { PageSkeleton } from '../shared/components/Skeleton';
import { settings } from '../stores/settingsStore';

interface Props {
  children?: JSX.Element;
}

const App: Component<Props> = (props) => {
  const location = useLocation();
  const showBottomNav = () => location.pathname !== '/';

  createEffect(() => {
    const mode = settings().displayMode;
    document.documentElement.classList.toggle('outdoor', mode === 'outdoor');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', mode === 'outdoor' ? '#ffffff' : '#1e1e2e');
    }
  });

  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-surface focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      <Suspense fallback={
        <div class="flex flex-col min-h-screen bg-surface">
          <div class="bg-surface-light border-b border-surface-lighter px-4 py-3">
            <div class="max-w-lg mx-auto md:max-w-3xl">
              <div class="skeleton h-5 w-24" />
            </div>
          </div>
          <div class="flex-1" role="status" aria-label="Loading page">
            <div class="max-w-lg mx-auto md:max-w-3xl">
              <PageSkeleton />
            </div>
          </div>
        </div>
      }>
        {props.children}
      </Suspense>
      <Show when={showBottomNav()}>
        <BottomNav />
      </Show>
    </div>
  );
};

export default App;
```

**Step 3: Update BottomNav.tsx**

In `src/shared/components/BottomNav.tsx`:

Change the "New" tab from `/` to `/new`. Three changes on the `<A>` tag for "New Game":

1. `href="/"` → `href="/new"`
2. `class={linkClass('/')}` → `class={linkClass('/new')}`
3. `aria-current={isActive('/') ? 'page' : undefined}` → `aria-current={isActive('/new') ? 'page' : undefined}`

And the pill animation Show condition:
4. `<Show when={isActive('/')}>` → `<Show when={isActive('/new')}>`

The full New tab `<A>` becomes:
```tsx
<A href="/new" class={linkClass('/new')} aria-current={isActive('/new') ? 'page' : undefined} aria-label="New Game">
  <Show when={isActive('/new')}>
    <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
  </Show>
  <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
  <span class="relative">New</span>
</A>
```

**Step 4: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/app/router.tsx src/app/App.tsx src/shared/components/BottomNav.tsx && git commit -m "feat: add LandingPage route at /, move GameSetupPage to /new, hide BottomNav on landing"
```

---

### Task 8: Remove Account section from SettingsPage

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`

Auth is now handled by TopNav. Remove the entire Account fieldset (lines 42-113 in current file) and the `useAuth` import/destructuring.

**Step 1: Update SettingsPage.tsx**

Remove the `useAuth` import and usage:
- Delete: `import { useAuth } from '../../shared/hooks/useAuth';`
- Delete: `const { user, loading: authLoading, syncing, signIn, signOut } = useAuth();`

Remove the entire Account fieldset block (from `{/* Account */}` through the closing `</fieldset>`).

The top of the component becomes:
```tsx
import { createSignal, onMount, Show } from 'solid-js';
import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import Logo from '../../shared/components/Logo';
import { settings, setSettings } from '../../stores/settingsStore';

const SettingsPage: Component = () => {
  const [voices, setVoices] = createSignal<SpeechSynthesisVoice[]>([]);

  onMount(() => {
    // ... (unchanged voice loading logic)
  });

  const testVoice = () => {
    // ... (unchanged)
  };

  return (
    <PageLayout title="Settings">
      <div class="p-4">
        <div class="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
          {/* Left column */}
          <div class="space-y-6">
            {/* Display Mode — now the first fieldset in left column */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                Display
              </legend>
              ...
```

Everything from the Display Mode fieldset onward stays unchanged.

**Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors. The `Show` import from solid-js is still needed for voice announcements section.

**Step 3: Commit**

```bash
git add src/features/settings/SettingsPage.tsx && git commit -m "feat: remove Account section from Settings (auth now in TopNav)"
```

---

### Task 9: Update index.html + vite.config.ts (meta tags, title, manifest)

**Files:**
- Modify: `index.html`
- Modify: `vite.config.ts`

Standardize name to "PickleScore", add OG meta tags, update PWA manifest description.

**Step 1: Update index.html**

Replace the `<title>` and add OG tags. The full `<head>` becomes:
```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <meta name="description" content="Score games court-side, organize tournaments, share live results. Free, offline-first, no download required." />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="PickleScore" />
  <meta name="theme-color" content="#1e1e2e" />

  <!-- Open Graph -->
  <meta property="og:title" content="PickleScore — Pickleball Scoring & Tournament Management" />
  <meta property="og:description" content="Score games court-side, organize tournaments, share live results. Free, offline-first, no download required." />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap" rel="stylesheet" />
  <title>PickleScore — Pickleball Scoring & Tournaments</title>
</head>
```

Changes:
- `<title>` from "Pickle Score" → "PickleScore — Pickleball Scoring & Tournaments"
- `<meta name="description">` updated to match OG description
- Added 5 OG/Twitter meta tags

**Step 2: Update vite.config.ts PWA manifest**

In `vite.config.ts`, update the manifest object:

Change:
```ts
name: 'Pickle Score',
short_name: 'PickleScore',
description: 'Live pickleball scoring and match tracking',
```

To:
```ts
name: 'PickleScore',
short_name: 'PickleScore',
description: 'Pickleball scoring, tournament management, and live results',
```

**Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add index.html vite.config.ts && git commit -m "feat: update title to PickleScore, add OG meta tags, update PWA manifest"
```

---

### Task 10: Run full test suite + type check

**Files:** None (verification only)

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (240+ tests). No tests should break from our changes since:
- Logo.tsx changes are backward-compatible (added optional props)
- PageLayout.tsx header change is internal (no test depends on header content)
- Router changes don't affect unit tests
- SettingsPage removal of Account section doesn't break any engine tests

**Step 3: Run build to verify**

Run: `npx vite build`
Expected: Build succeeds with no errors. This confirms all lazy imports resolve correctly and the new LandingPage is bundled.

---

### Task 11: E2E verification with Playwright

**Files:** None (manual verification via Playwright MCP tools)

Verify the full feature using the running dev server and Playwright.

**Step 1: Start dev server**

Run: `npx vite --port 5199`

**Step 2: Verify landing page**

Navigate to `http://localhost:5199/`. Verify:
- TopNav with logo icon + "PickleScore" wordmark + "Sign In" button
- Hero section with large logo, tagline, two CTA buttons
- Features section with 6 cards
- How It Works with 3 numbered steps
- Final CTA section
- Footer with PickleScore text
- No BottomNav visible

**Step 3: Verify "Start Scoring" CTA**

Click "Start Scoring" → navigates to `/new` (GameSetupPage). Verify:
- TopNav appears with logo icon + "New Game" page title
- BottomNav appears at bottom
- "New" tab in BottomNav is highlighted
- GameSetupPage content is visible

**Step 4: Verify "Manage Tournaments" CTA**

Navigate back to `/`, click "Manage Tournaments" → navigates to `/tournaments`. Verify:
- Redirects to RequireAuth (shows "Sign in required" if not authed)

**Step 5: Verify TopNav Sign In**

Click "Sign In" in TopNav → Google popup appears (can't complete in Playwright, but popup trigger confirms wiring).

**Step 6: Verify BottomNav "New" tab**

From any app page (e.g., `/history`), tap "New" in BottomNav → navigates to `/new`.

**Step 7: Verify Settings page has no Account section**

Navigate to `/settings`. Verify:
- No Account fieldset / Google Sign In button
- Display, Screen, Sound, Haptics, Voice, Scoring settings all present
- TopNav shows "Sign In" button at top (or avatar if signed in)

**Step 8: Verify page source for OG tags**

Check page source for:
- `<title>PickleScore — Pickleball Scoring & Tournaments</title>`
- `<meta property="og:title" ...>`
- `<meta property="og:description" ...>`
- `<meta name="twitter:card" content="summary_large_image">`

**Step 9: Check console for errors**

Verify zero JavaScript errors in console across all navigations.

---

## Follow-up (not in this plan)

- **OG image**: Create `public/og-image.png` (1200x630) — logo + tagline on dark background. Can be generated from a screenshot of the hero section or designed in Figma.
- **PWA icons**: Replace `public/pwa-192x192.png`, `public/pwa-512x512.png`, and `public/apple-touch-icon.png` with renders of the new pickleball logo icon. These require PNG rasterization of the SVG at specific sizes.
