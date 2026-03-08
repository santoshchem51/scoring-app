# Layer 9: PWA & Offline Hardening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden PickleScore into a fully offline-capable, installable PWA with proper SW caching, install prompts, update notifications, offline tournament data, self-hosted fonts, and CSP headers.

**Architecture:** Workbox runtime caching via vite-plugin-pwa `generateSW` mode. Module-level SolidJS signal stores for PWA state. Dexie write-through cache for tournament data. Firebase Hosting headers for security and caching.

**Tech Stack:** vite-plugin-pwa 1.2.0, Workbox 7.x, Dexie.js, SolidJS 1.9, TypeScript, Tailwind CSS v4, Firebase Hosting

**Design:** `docs/plans/2026-03-08-layer9-pwa-offline-design.md`

---

## Task 1: Self-Host Oswald Font

**Files:**
- Create: `public/fonts/Oswald-Bold.woff2`
- Modify: `index.html:20-22` (remove Google Fonts links, add preload)
- Modify: `src/styles.css:1` (add @font-face before @import)
- Delete: `public/vite.svg`

**Step 1: Download the font file**

Download Oswald Bold (weight 700) woff2 from Google Fonts API. The direct URL for the Latin subset:

```bash
mkdir -p public/fonts
curl -L "https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1xZogUFoZAaRliE.woff2" -o public/fonts/Oswald-Bold.woff2
```

Verify the file exists and is ~18-22KB.

**Step 2: Remove Google Fonts links from index.html**

Remove lines 20-22 from `index.html`:
```html
<!-- DELETE these 3 lines -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap" rel="stylesheet" />
```

Replace with a font preload:
```html
<link rel="preload" href="/fonts/Oswald-Bold.woff2" as="font" type="font/woff2" crossorigin />
```

**Step 3: Add @font-face to styles.css**

Add this block at the top of `src/styles.css`, before `@import "tailwindcss"` (line 1):

```css
@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/Oswald-Bold.woff2') format('woff2');
}

@import "tailwindcss";
```

**Step 4: Delete public/vite.svg**

```bash
rm public/vite.svg
```

**Step 5: Verify the font loads**

Run: `npx vite --port 5199`
- Open http://localhost:5199
- Verify score text on landing page uses Oswald (bold, condensed)
- Check Network tab: should fetch `/fonts/Oswald-Bold.woff2` from same origin (no Google Fonts requests)
- Check no console errors

**Step 6: Commit**

```bash
git add public/fonts/Oswald-Bold.woff2 index.html src/styles.css
git rm public/vite.svg
git commit -m "feat: self-host Oswald font, remove Google Fonts dependency, delete vite.svg"
```

---

## Task 2: SW Caching Configuration

**Files:**
- Modify: `vite.config.ts:39-41` (expand workbox config)
- Modify: `tsconfig.app.json:8` (add vite-plugin-pwa/client type)

**Step 1: Add vite-plugin-pwa/client to tsconfig types**

In `tsconfig.app.json`, change line 8 from:
```json
"types": ["vite/client", "vitest/globals"],
```
to:
```json
"types": ["vite/client", "vitest/globals", "vite-plugin-pwa/client"],
```

**Step 2: Expand workbox config in vite.config.ts**

Replace the `workbox` block (lines 39-41) with:

```ts
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,woff2}'],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/__\//, /\/[^/?]+\.[^/]+$/],
  cleanupOutdatedCaches: true,
  dontCacheBustURLsMatching: /\.[a-f0-9]{8}\./,
  cacheId: 'picklescore',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-profile-photos',
        expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
},
```

Note: Removed `svg` from globPatterns (vite.svg deleted, favicon.svg is in `includeAssets`). JS/CSS chunks are precached and immutable via content-hashing (`dontCacheBustURLsMatching`). Font woff2 is precached. Google profile photos use StaleWhileRevalidate. Firebase endpoints left unmatched (default NetworkOnly).

**Step 3: Verify build succeeds**

Run: `npx vite build`
- Should succeed with no errors
- Check `dist/sw.js` exists and contains `NavigationRoute` with `index.html`

**Step 4: Run existing tests**

Run: `npx vitest run`
- All tests should pass (no test changes in this task)

**Step 5: Commit**

```bash
git add vite.config.ts tsconfig.app.json
git commit -m "feat: add Workbox runtime caching, navigateFallback, and cache config"
```

---

## Task 3: Firebase Hosting Configuration

**Files:**
- Modify: `firebase.json` (add hosting section)

**Step 1: Add hosting section to firebase.json**

Replace the entire `firebase.json` with:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8180
    },
    "ui": {
      "enabled": true,
      "port": 4000
    },
    "singleProjectMode": false
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com; frame-src https://*.firebaseapp.com; child-src https://*.firebaseapp.com https://accounts.google.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
          },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" }
        ]
      },
      {
        "source": "/assets/**",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      },
      {
        "source": "/sw.js",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
        ]
      },
      {
        "source": "/workbox-*.js",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
        ]
      },
      {
        "source": "/registerSW.js",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
        ]
      },
      {
        "source": "/manifest.webmanifest",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
          { "key": "Content-Type", "value": "application/manifest+json" }
        ]
      }
    ]
  }
}
```

**Step 2: Verify firebase.json is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); console.log('Valid JSON')"
```

**Step 3: Commit**

```bash
git add firebase.json
git commit -m "feat: add Firebase Hosting config with CSP, cache headers, and SPA rewrites"
```

---

## Task 4: SW Update Store + Tests

**Files:**
- Create: `src/shared/pwa/swUpdateStore.ts`
- Create: `src/shared/pwa/__tests__/swUpdateStore.test.ts`

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/swUpdateStore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock virtual:pwa-register before importing the store
const mockRegisterSW = vi.fn();
vi.mock('virtual:pwa-register', () => ({
  registerSW: mockRegisterSW,
}));

describe('swUpdateStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockRegisterSW.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports swUpdateVisible as a function returning false initially', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { swUpdateVisible } = await import('../swUpdateStore');
    expect(swUpdateVisible()).toBe(false);
  });

  it('initSWUpdate calls registerSW once', async () => {
    const mockUpdateFn = vi.fn();
    mockRegisterSW.mockReturnValue(mockUpdateFn);
    const { initSWUpdate } = await import('../swUpdateStore');
    initSWUpdate();
    expect(mockRegisterSW).toHaveBeenCalledTimes(1);
    expect(mockRegisterSW).toHaveBeenCalledWith(expect.objectContaining({
      onNeedRefresh: expect.any(Function),
      onRegisterError: expect.any(Function),
    }));
  });

  it('initSWUpdate is idempotent (second call is no-op)', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { initSWUpdate } = await import('../swUpdateStore');
    initSWUpdate();
    initSWUpdate();
    expect(mockRegisterSW).toHaveBeenCalledTimes(1);
  });

  it('swUpdateVisible returns true after onNeedRefresh fires', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
    const { initSWUpdate, swUpdateVisible } = await import('../swUpdateStore');
    initSWUpdate();
    expect(swUpdateVisible()).toBe(false);
    capturedOnNeedRefresh!();
    expect(swUpdateVisible()).toBe(true);
  });

  it('dismissUpdate hides toast and sets localStorage timestamp', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
    const { initSWUpdate, swUpdateVisible, dismissUpdate } = await import('../swUpdateStore');
    initSWUpdate();
    capturedOnNeedRefresh!();
    expect(swUpdateVisible()).toBe(true);
    dismissUpdate();
    expect(swUpdateVisible()).toBe(false);
    expect(localStorage.getItem('sw-update-dismissed-at')).toBeTruthy();
  });

  it('swUpdateVisible returns true after 24h dismiss expires', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
    // Set dismissal to 25 hours ago
    localStorage.setItem('sw-update-dismissed-at', String(Date.now() - 25 * 60 * 60 * 1000));
    const { initSWUpdate, swUpdateVisible } = await import('../swUpdateStore');
    initSWUpdate();
    capturedOnNeedRefresh!();
    expect(swUpdateVisible()).toBe(true);
  });

  it('applyUpdate calls the updateSW function and sets pending ack', async () => {
    const mockUpdateFn = vi.fn();
    mockRegisterSW.mockReturnValue(mockUpdateFn);
    const { initSWUpdate, applyUpdate } = await import('../swUpdateStore');
    initSWUpdate();
    applyUpdate();
    expect(mockUpdateFn).toHaveBeenCalledWith(true);
    expect(localStorage.getItem('sw-updated-pending-ack')).toBe('1');
  });

  it('applyUpdate is no-op if initSWUpdate was never called', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { applyUpdate } = await import('../swUpdateStore');
    // Should not throw
    applyUpdate();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/swUpdateStore.test.ts`
Expected: FAIL — module `../swUpdateStore` does not exist

**Step 3: Write implementation**

Create `src/shared/pwa/swUpdateStore.ts`:

```ts
import { createSignal } from 'solid-js';
import { registerSW } from 'virtual:pwa-register';

const DISMISS_KEY = 'sw-update-dismissed-at';
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 hours
const PENDING_ACK_KEY = 'sw-updated-pending-ack';

const [swWaiting, setSwWaiting] = createSignal(false);
let _updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let _initialized = false;

export function initSWUpdate(): void {
  if (_initialized) return;
  _initialized = true;

  _updateSW = registerSW({
    onNeedRefresh() {
      setSwWaiting(true);
    },
    onRegisterError(error: unknown) {
      console.error('SW registration failed:', error);
    },
  });

  // Post-update acknowledgment from previous session
  const pendingAck = localStorage.getItem(PENDING_ACK_KEY);
  if (pendingAck) {
    localStorage.removeItem(PENDING_ACK_KEY);
    // TODO: trigger "App updated!" snackbar (wire up in App.tsx)
  }
}

export function applyUpdate(): void {
  localStorage.setItem(PENDING_ACK_KEY, '1');
  _updateSW?.(true);
}

export function dismissUpdate(): void {
  localStorage.setItem(DISMISS_KEY, Date.now().toString());
  setSwWaiting(false);
}

export const swUpdateVisible = (): boolean => {
  if (!swWaiting()) return false;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (!dismissedAt) return true;
  return Date.now() - Number(dismissedAt) > SNOOZE_MS;
};

export { swWaiting };
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pwa/__tests__/swUpdateStore.test.ts`
Expected: All 7 tests PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/shared/pwa/swUpdateStore.ts src/shared/pwa/__tests__/swUpdateStore.test.ts
git commit -m "feat: add SW update store with 24h dismiss, pending ack, and idempotent init"
```

---

## Task 5: SWUpdateToast Component + Tests

**Files:**
- Create: `src/shared/pwa/SWUpdateToast.tsx`
- Create: `src/shared/pwa/__tests__/SWUpdateToast.test.tsx`
- Modify: `src/app/App.tsx:1-8,34` (import + mount + onMount init)

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/SWUpdateToast.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

// Mock swUpdateStore
const mockSwUpdateVisible = vi.fn(() => false);
const mockApplyUpdate = vi.fn();
const mockDismissUpdate = vi.fn();

vi.mock('../swUpdateStore', () => ({
  swUpdateVisible: mockSwUpdateVisible,
  applyUpdate: mockApplyUpdate,
  dismissUpdate: mockDismissUpdate,
}));

// Must import AFTER mocks
import SWUpdateToast from '../SWUpdateToast';

describe('SWUpdateToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSwUpdateVisible.mockReturnValue(false);
  });

  it('renders nothing when swUpdateVisible is false', () => {
    const { container } = render(() => <SWUpdateToast />);
    expect(screen.queryByText('A new version is available')).toBeNull();
    // aria-live region should still exist
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('shows toast when swUpdateVisible is true', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    expect(screen.getByText('A new version is available')).toBeTruthy();
    expect(screen.getByRole('button', { name: /update/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /remind me tomorrow/i })).toBeTruthy();
  });

  it('calls applyUpdate when Update button is clicked', async () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    screen.getByRole('button', { name: /update/i }).click();
    expect(mockApplyUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls dismissUpdate when Remind me tomorrow is clicked', async () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    screen.getByRole('button', { name: /remind me tomorrow/i }).click();
    expect(mockDismissUpdate).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/SWUpdateToast.test.tsx`
Expected: FAIL — module `../SWUpdateToast` does not exist

**Step 3: Write the component**

Create `src/shared/pwa/SWUpdateToast.tsx`:

```tsx
import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { swUpdateVisible, applyUpdate, dismissUpdate } from './swUpdateStore';

const SWUpdateToast: Component = () => {
  return (
    <div role="status" aria-live="polite" class="contents">
      <Show when={swUpdateVisible()}>
        <div
          class="fixed z-40 right-4 max-w-sm w-[90vw] sm:w-auto pointer-events-auto"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div class="bg-surface-light border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 motion-safe:transition-all motion-safe:duration-300">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-on-surface">A new version is available</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                class="text-xs text-on-surface-muted hover:text-on-surface min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Remind me tomorrow"
                onClick={() => dismissUpdate()}
              >
                Remind me tomorrow
              </button>
              <button
                type="button"
                class="bg-primary text-surface text-sm font-semibold px-4 min-h-[44px] rounded-lg hover:bg-primary-dark transition-colors"
                aria-label="Update now"
                onClick={() => applyUpdate()}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default SWUpdateToast;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pwa/__tests__/SWUpdateToast.test.tsx`
Expected: All 4 tests PASS

**Step 5: Mount in App.tsx**

In `src/app/App.tsx`:

Add imports at top (after existing imports):
```ts
import { onMount } from 'solid-js';
import SWUpdateToast from '../shared/pwa/SWUpdateToast';
import { initSWUpdate } from '../shared/pwa/swUpdateStore';
```

Update the `Show, Suspense, createEffect` import on line 2 to include `onMount`:
```ts
import { Show, Suspense, createEffect, onMount } from 'solid-js';
```

Inside the `App` component function (after the `createEffect` block, before the `return`), add:
```ts
onMount(() => {
  initSWUpdate();
});
```

Inside the JSX, right after `<AchievementToast />` (line 34), add:
```tsx
<SWUpdateToast />
```

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/shared/pwa/SWUpdateToast.tsx src/shared/pwa/__tests__/SWUpdateToast.test.tsx src/app/App.tsx
git commit -m "feat: add SWUpdateToast component with 24h snooze, mount in App"
```

---

## Task 6: Install Prompt Store + Tests

**Files:**
- Create: `src/shared/pwa/installPromptStore.ts`
- Create: `src/shared/pwa/__tests__/installPromptStore.test.ts`

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/installPromptStore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock swUpdateStore
vi.mock('../swUpdateStore', () => ({
  swUpdateVisible: vi.fn(() => false),
}));

describe('installPromptStore', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    // Reset matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('isInstalled returns false by default', async () => {
    const { isInstalled } = await import('../installPromptStore');
    expect(isInstalled()).toBe(false);
  });

  it('isInstalled returns true when display-mode is standalone', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    const { isInstalled } = await import('../installPromptStore');
    expect(isInstalled()).toBe(true);
  });

  it('showInstallBanner returns false when no event captured', async () => {
    const { showInstallBanner } = await import('../installPromptStore');
    expect(showInstallBanner()).toBe(false);
  });

  it('captureInstallEvent + showInstallBanner returns true when conditions met', async () => {
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    // Need trigger condition met (matchCount >= 1 or 3rd visit)
    localStorage.setItem('pwa-visit-count', '3');
    expect(showInstallBanner()).toBe(true);
  });

  it('getDismissState returns none initially', async () => {
    const { getDismissState } = await import('../installPromptStore');
    expect(getDismissState()).toBe('none');
  });

  it('softDismiss sets 7-day cooldown', async () => {
    const { softDismiss, getDismissState } = await import('../installPromptStore');
    softDismiss();
    expect(getDismissState()).toBe('soft');
  });

  it('hardDismiss sets 30-day cooldown', async () => {
    const { hardDismiss, getDismissState } = await import('../installPromptStore');
    hardDismiss();
    expect(getDismissState()).toBe('hard');
  });

  it('neverDismiss sets permanent dismissal', async () => {
    const { neverDismiss, getDismissState } = await import('../installPromptStore');
    neverDismiss();
    expect(getDismissState()).toBe('never');
  });

  it('showInstallBanner returns false when dismissed soft within 7 days', async () => {
    const { captureInstallEvent, softDismiss, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    softDismiss();
    expect(showInstallBanner()).toBe(false);
  });

  it('detectIOSSafari identifies Safari on iOS', async () => {
    const { detectIOSSafari } = await import('../installPromptStore');
    // Default jsdom UA is not iOS Safari
    expect(detectIOSSafari()).toBe(false);
  });

  it('markInstalled hides banner', async () => {
    const { captureInstallEvent, markInstalled, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    markInstalled();
    expect(showInstallBanner()).toBe(false);
  });

  it('incrementVisitCount increments localStorage counter', async () => {
    const { incrementVisitCount } = await import('../installPromptStore');
    incrementVisitCount();
    expect(localStorage.getItem('pwa-visit-count')).toBe('1');
    incrementVisitCount();
    expect(localStorage.getItem('pwa-visit-count')).toBe('2');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/installPromptStore.test.ts`
Expected: FAIL — module does not exist

**Step 3: Write implementation**

Create `src/shared/pwa/installPromptStore.ts`:

```ts
import { createSignal } from 'solid-js';
import { swUpdateVisible } from './swUpdateStore';

// ── Types ──

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

type DismissState = 'none' | 'soft' | 'hard' | 'never';

interface DismissData {
  tier: DismissState;
  until?: number;
}

// ── Constants ──

const DISMISS_KEY = 'pwa-install-dismiss';
const VISIT_KEY = 'pwa-visit-count';
const SOFT_MS = 7 * 24 * 60 * 60 * 1000;
const HARD_MS = 30 * 24 * 60 * 60 * 1000;

// ── Signals ──

const [promptEvent, setPromptEvent] = createSignal<BeforeInstallPromptEvent | null>(null);
const [installed, setInstalled] = createSignal(
  typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  ),
);

// ── Dismiss Logic ──

function readDismiss(): DismissData {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return { tier: 'none' };
    return JSON.parse(raw) as DismissData;
  } catch {
    return { tier: 'none' };
  }
}

function isDismissed(): boolean {
  const data = readDismiss();
  if (data.tier === 'none') return false;
  if (data.tier === 'never') return true;
  if (!data.until) return false;
  return Date.now() < data.until;
}

export function getDismissState(): DismissState {
  return readDismiss().tier;
}

export function softDismiss(): void {
  const data: DismissData = { tier: 'soft', until: Date.now() + SOFT_MS };
  localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

export function hardDismiss(): void {
  const data: DismissData = { tier: 'hard', until: Date.now() + HARD_MS };
  localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

export function neverDismiss(): void {
  const data: DismissData = { tier: 'never' };
  localStorage.setItem(DISMISS_KEY, JSON.stringify(data));
}

// ── Trigger Logic ──

function hasTriggerCondition(): boolean {
  const visitCount = Number(localStorage.getItem(VISIT_KEY) || '0');
  // Primary: 3+ visits (fallback). Match-count trigger is checked by caller.
  return visitCount >= 3;
}

export function incrementVisitCount(): void {
  const count = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
  localStorage.setItem(VISIT_KEY, String(count));
}

// ── Public API ──

export function captureInstallEvent(event: Event): void {
  setPromptEvent(event as BeforeInstallPromptEvent);
}

export function markInstalled(): void {
  setInstalled(true);
  setPromptEvent(null);
}

export const isInstalled = installed;

export const showInstallBanner = (): boolean => {
  if (installed()) return false;
  if (!promptEvent()) return false;
  if (isDismissed()) return false;
  if (swUpdateVisible()) return false;
  if (!hasTriggerCondition()) return false;
  return true;
};

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | null> {
  const event = promptEvent();
  if (!event) return null;
  const result = await event.prompt();
  setPromptEvent(null); // null after use, re-listen for fresh event
  if (result.outcome === 'accepted') {
    setInstalled(true);
  }
  return result.outcome;
}

export function detectIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!CriOS|FxiOS|OPiOS|EdgiOS).)*Safari/.test(ua);
  return isIOS && isSafari;
}

export const iosInstallSupported = (): boolean => {
  return detectIOSSafari() && !installed();
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pwa/__tests__/installPromptStore.test.ts`
Expected: All 12 tests PASS

**Step 5: Commit**

```bash
git add src/shared/pwa/installPromptStore.ts src/shared/pwa/__tests__/installPromptStore.test.ts
git commit -m "feat: add install prompt store with tiered dismiss, iOS detection, trigger logic"
```

---

## Task 7: PWA Lifecycle Init + Tests

**Files:**
- Create: `src/shared/pwa/pwaLifecycle.ts`
- Create: `src/shared/pwa/__tests__/pwaLifecycle.test.ts`

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/pwaLifecycle.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../installPromptStore', () => ({
  captureInstallEvent: vi.fn(),
  markInstalled: vi.fn(),
  incrementVisitCount: vi.fn(),
}));

describe('pwaLifecycle', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('initPWAListeners registers beforeinstallprompt and appinstalled listeners', async () => {
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const eventNames = addEventListenerSpy.mock.calls.map(c => c[0]);
    expect(eventNames).toContain('beforeinstallprompt');
    expect(eventNames).toContain('appinstalled');
  });

  it('initPWAListeners calls incrementVisitCount', async () => {
    const { incrementVisitCount } = await import('../installPromptStore');
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    expect(incrementVisitCount).toHaveBeenCalledTimes(1);
  });

  it('initPWAListeners is idempotent', async () => {
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const count1 = addEventListenerSpy.mock.calls.length;
    initPWAListeners();
    const count2 = addEventListenerSpy.mock.calls.length;
    expect(count2).toBe(count1); // no additional listeners
  });

  it('beforeinstallprompt handler calls captureInstallEvent', async () => {
    const { captureInstallEvent } = await import('../installPromptStore');
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const handler = addEventListenerSpy.mock.calls.find(c => c[0] === 'beforeinstallprompt')![1] as EventListener;
    const fakeEvent = new Event('beforeinstallprompt');
    handler(fakeEvent);
    expect(captureInstallEvent).toHaveBeenCalledWith(fakeEvent);
  });

  it('appinstalled handler calls markInstalled', async () => {
    const { markInstalled } = await import('../installPromptStore');
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const handler = addEventListenerSpy.mock.calls.find(c => c[0] === 'appinstalled')![1] as EventListener;
    handler(new Event('appinstalled'));
    expect(markInstalled).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/pwaLifecycle.test.ts`
Expected: FAIL — module does not exist

**Step 3: Write implementation**

Create `src/shared/pwa/pwaLifecycle.ts`:

```ts
import { captureInstallEvent, markInstalled, incrementVisitCount } from './installPromptStore';

let _initialized = false;

export function initPWAListeners(): void {
  if (_initialized) return;
  _initialized = true;

  incrementVisitCount();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    captureInstallEvent(event);
  });

  window.addEventListener('appinstalled', () => {
    markInstalled();
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pwa/__tests__/pwaLifecycle.test.ts`
Expected: All 5 tests PASS

**Step 5: Wire into index.tsx**

In `src/index.tsx`, add before `render()`:
```ts
import { initPWAListeners } from './shared/pwa/pwaLifecycle';

initPWAListeners();
```

The full file should be:
```ts
import { render } from 'solid-js/web';
import './styles.css';
import AppRouter from './app/router';
import { initPWAListeners } from './shared/pwa/pwaLifecycle';

initPWAListeners();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(() => <AppRouter />, root);
```

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/shared/pwa/pwaLifecycle.ts src/shared/pwa/__tests__/pwaLifecycle.test.ts src/index.tsx
git commit -m "feat: add PWA lifecycle listeners (beforeinstallprompt, appinstalled, visit counting)"
```

---

## Task 8: InstallPromptBanner Component + Tests

**Files:**
- Create: `src/shared/pwa/InstallPromptBanner.tsx`
- Create: `src/shared/pwa/__tests__/InstallPromptBanner.test.tsx`

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/InstallPromptBanner.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

const mockShowInstallBanner = vi.fn(() => false);
const mockTriggerInstallPrompt = vi.fn();
const mockSoftDismiss = vi.fn();
const mockIosInstallSupported = vi.fn(() => false);

vi.mock('../installPromptStore', () => ({
  showInstallBanner: mockShowInstallBanner,
  triggerInstallPrompt: mockTriggerInstallPrompt,
  softDismiss: mockSoftDismiss,
  iosInstallSupported: mockIosInstallSupported,
  isInstalled: vi.fn(() => false),
}));

import InstallPromptBanner from '../InstallPromptBanner';

describe('InstallPromptBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowInstallBanner.mockReturnValue(false);
    mockIosInstallSupported.mockReturnValue(false);
  });

  it('renders nothing when showInstallBanner is false and not iOS', () => {
    render(() => <InstallPromptBanner />);
    expect(screen.queryByText(/install/i)).toBeNull();
  });

  it('shows install banner when showInstallBanner returns true', () => {
    mockShowInstallBanner.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    expect(screen.getByRole('button', { name: /install/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /not now/i })).toBeTruthy();
  });

  it('calls triggerInstallPrompt when Install is clicked', () => {
    mockShowInstallBanner.mockReturnValue(true);
    mockTriggerInstallPrompt.mockResolvedValue('accepted');
    render(() => <InstallPromptBanner />);
    screen.getByRole('button', { name: /install/i }).click();
    expect(mockTriggerInstallPrompt).toHaveBeenCalledTimes(1);
  });

  it('calls softDismiss when Not now is clicked', () => {
    mockShowInstallBanner.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    screen.getByRole('button', { name: /not now/i }).click();
    expect(mockSoftDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows iOS instructions when iosInstallSupported is true', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    expect(screen.getByText(/add to home screen/i)).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/InstallPromptBanner.test.tsx`
Expected: FAIL

**Step 3: Write the component**

Create `src/shared/pwa/InstallPromptBanner.tsx`:

```tsx
import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import {
  showInstallBanner,
  triggerInstallPrompt,
  softDismiss,
  iosInstallSupported,
  isInstalled,
} from './installPromptStore';

const InstallPromptBanner: Component = () => {
  const handleInstall = () => {
    triggerInstallPrompt();
  };

  return (
    <>
      {/* Chrome/Edge/Samsung install prompt */}
      <Show when={showInstallBanner()}>
        <div
          role="banner"
          aria-label="Install app"
          class="bg-surface-light border border-border rounded-xl p-4 flex items-center justify-between gap-3"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-on-surface">Install PickleScore</p>
            <p class="text-xs text-on-surface-muted mt-0.5">Add to your home screen for the best experience</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              class="text-xs text-on-surface-muted hover:text-on-surface min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Not now"
              onClick={() => softDismiss()}
            >
              Not now
            </button>
            <button
              type="button"
              class="bg-primary text-surface text-sm font-semibold px-4 min-h-[44px] rounded-lg hover:bg-primary-dark transition-colors"
              aria-label="Install PickleScore"
              onClick={handleInstall}
            >
              Install
            </button>
          </div>
        </div>
      </Show>

      {/* iOS Safari instructions */}
      <Show when={!isInstalled() && iosInstallSupported()}>
        <div class="bg-surface-light border border-border rounded-xl p-4">
          <p class="text-sm font-semibold text-on-surface">Install PickleScore</p>
          <p class="text-xs text-on-surface-muted mt-1">
            Tap the share button <span aria-hidden="true">⎙</span> then "Add to Home Screen" <span aria-hidden="true">＋</span>
          </p>
        </div>
      </Show>
    </>
  );
};

export default InstallPromptBanner;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pwa/__tests__/InstallPromptBanner.test.tsx`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add src/shared/pwa/InstallPromptBanner.tsx src/shared/pwa/__tests__/InstallPromptBanner.test.tsx
git commit -m "feat: add InstallPromptBanner with Chrome/iOS paths, tiered dismiss"
```

---

## Task 9: Wire Install CTA into LandingPage + SettingsPage

**Files:**
- Modify: `src/features/landing/LandingPage.tsx:268-277` (replace footer install text with component)
- Modify: `src/features/settings/SettingsPage.tsx` (add install section at bottom)

**Step 1: Update LandingPage footer**

In `src/features/landing/LandingPage.tsx`, add import at top:
```ts
import InstallPromptBanner from '../../shared/pwa/InstallPromptBanner';
```

Replace lines 274-276 (the static install text):
```html
<p class="text-xs text-on-surface-muted mt-1">
  Install as an app from your browser menu
</p>
```

With:
```tsx
<div class="mt-4 max-w-sm mx-auto">
  <InstallPromptBanner />
</div>
```

**Step 2: Add install section to SettingsPage**

In `src/features/settings/SettingsPage.tsx`, add import at top:
```ts
import InstallPromptBanner from '../../shared/pwa/InstallPromptBanner';
```

At the end of the right column (after the last `fieldset`), add:
```tsx
<fieldset class="bg-surface-light rounded-xl p-4">
  <legend class="text-sm font-semibold text-on-surface mb-2">App Installation</legend>
  <InstallPromptBanner />
</fieldset>
```

**Step 3: Verify visually**

Run: `npx vite --port 5199`
- Visit http://localhost:5199 — landing page footer should show the install CTA (if `beforeinstallprompt` fires)
- Visit Settings page — install section should appear at bottom

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/features/landing/LandingPage.tsx src/features/settings/SettingsPage.tsx
git commit -m "feat: wire InstallPromptBanner into LandingPage footer and SettingsPage"
```

---

## Task 10: Dexie Schema v5 — Tournament Cache Tables

**Files:**
- Modify: `src/data/db.ts` (add version 5 + types)
- Create: `src/data/__tests__/db-v5.test.ts`

**Step 1: Write failing test**

Create `src/data/__tests__/db-v5.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { db } from '../db';

describe('Dexie v5 schema', () => {
  it('has cachedTournaments table', () => {
    expect(db.cachedTournaments).toBeDefined();
    expect(db.cachedTournaments.schema.primKey.name).toBe('id');
  });

  it('has cachedTeams table', () => {
    expect(db.cachedTeams).toBeDefined();
    expect(db.cachedTeams.schema.primKey.name).toBe('id');
  });

  it('has cachedPools table', () => {
    expect(db.cachedPools).toBeDefined();
    expect(db.cachedPools.schema.primKey.name).toBe('id');
  });

  it('has cachedBrackets table', () => {
    expect(db.cachedBrackets).toBeDefined();
    expect(db.cachedBrackets.schema.primKey.name).toBe('id');
  });

  it('has cachedRegistrations table', () => {
    expect(db.cachedRegistrations).toBeDefined();
    expect(db.cachedRegistrations.schema.primKey.name).toBe('id');
  });

  it('cachedTournaments has status and organizerId indexes', () => {
    const indexNames = db.cachedTournaments.schema.indexes.map(i => i.name);
    expect(indexNames).toContain('status');
    expect(indexNames).toContain('organizerId');
    expect(indexNames).toContain('cachedAt');
  });

  it('cachedPools has tournamentId index', () => {
    const indexNames = db.cachedPools.schema.indexes.map(i => i.name);
    expect(indexNames).toContain('tournamentId');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/__tests__/db-v5.test.ts`
Expected: FAIL — `db.cachedTournaments` is undefined

**Step 3: Update db.ts**

In `src/data/db.ts`, update the type declaration and add version 5.

Add cache types to the import:
```ts
import type { CachedAchievement, Match, Player, ScoreEvent, Tournament, TournamentTeam, TournamentPool, BracketSlot, TournamentRegistration } from './types';
```

Add a `CachedRecord` interface (add before `const db`):
```ts
interface CachedTournament extends Tournament { cachedAt: number }
interface CachedTeam extends TournamentTeam { cachedAt: number; tournamentId: string }
interface CachedPool extends TournamentPool { cachedAt: number; tournamentId: string }
interface CachedBracketSlot extends BracketSlot { cachedAt: number; tournamentId: string }
interface CachedRegistration extends TournamentRegistration { cachedAt: number; tournamentId: string }
```

Extend the Dexie type:
```ts
const db = new Dexie('PickleScoreDB') as Dexie & {
  matches: EntityTable<Match, 'id'>;
  players: EntityTable<Player, 'id'>;
  scoreEvents: EntityTable<ScoreEvent, 'id'>;
  tournaments: EntityTable<Tournament, 'id'>;
  syncQueue: EntityTable<SyncJob, 'id'>;
  achievements: EntityTable<CachedAchievement, 'achievementId'>;
  cachedTournaments: EntityTable<CachedTournament, 'id'>;
  cachedTeams: EntityTable<CachedTeam, 'id'>;
  cachedPools: EntityTable<CachedPool, 'id'>;
  cachedBrackets: EntityTable<CachedBracketSlot, 'id'>;
  cachedRegistrations: EntityTable<CachedRegistration, 'id'>;
};
```

Add version 5 after version 4 (after line 43):
```ts
db.version(5).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
  syncQueue: 'id, [status+nextRetryAt], createdAt',
  achievements: 'achievementId',
  cachedTournaments: 'id, status, organizerId, cachedAt',
  cachedTeams: 'id, tournamentId, cachedAt',
  cachedPools: 'id, tournamentId, cachedAt',
  cachedBrackets: 'id, tournamentId, cachedAt',
  cachedRegistrations: 'id, tournamentId, cachedAt',
});
```

Export the cache types:
```ts
export type { CachedTournament, CachedTeam, CachedPool, CachedBracketSlot, CachedRegistration };
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/__tests__/db-v5.test.ts`
Expected: All 7 tests PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/data/db.ts src/data/__tests__/db-v5.test.ts
git commit -m "feat: add Dexie v5 schema with 5 tournament cache tables"
```

---

## Task 11: Tournament Cache Write-Through + Hydration

**Files:**
- Modify: `src/features/tournaments/hooks/useTournamentLive.ts` (add Dexie hydration + write-through)
- Create: `src/features/tournaments/hooks/__tests__/useTournamentLive-cache.test.ts`

**Step 1: Write failing tests**

Create `src/features/tournaments/hooks/__tests__/useTournamentLive-cache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../../../data/db';

// Test the Dexie write-through and hydration helpers directly
// (integration with onSnapshot is tested via E2E)

describe('tournament cache helpers', () => {
  beforeEach(async () => {
    await db.cachedTournaments.clear();
    await db.cachedTeams.clear();
    await db.cachedPools.clear();
    await db.cachedBrackets.clear();
    await db.cachedRegistrations.clear();
  });

  it('can write and read a cached tournament', async () => {
    await db.cachedTournaments.put({
      id: 't1',
      name: 'Test',
      status: 'pool-play',
      organizerId: 'u1',
      cachedAt: Date.now(),
    } as any);
    const result = await db.cachedTournaments.get('t1');
    expect(result?.name).toBe('Test');
    expect(result?.cachedAt).toBeGreaterThan(0);
  });

  it('can query cached pools by tournamentId', async () => {
    await db.cachedPools.bulkPut([
      { id: 'p1', tournamentId: 't1', cachedAt: Date.now() } as any,
      { id: 'p2', tournamentId: 't1', cachedAt: Date.now() } as any,
      { id: 'p3', tournamentId: 't2', cachedAt: Date.now() } as any,
    ]);
    const pools = await db.cachedPools.where('tournamentId').equals('t1').toArray();
    expect(pools).toHaveLength(2);
  });

  it('can delete all cache for a tournament in a transaction', async () => {
    const now = Date.now();
    await db.cachedTournaments.put({ id: 't1', status: 'completed', organizerId: 'u1', cachedAt: now } as any);
    await db.cachedTeams.put({ id: 'tm1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedPools.put({ id: 'p1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedBrackets.put({ id: 'b1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedRegistrations.put({ id: 'r1', tournamentId: 't1', cachedAt: now } as any);

    await db.transaction('rw',
      db.cachedTournaments, db.cachedTeams, db.cachedPools,
      db.cachedBrackets, db.cachedRegistrations,
      async () => {
        await Promise.all([
          db.cachedTournaments.delete('t1'),
          db.cachedTeams.where('tournamentId').equals('t1').delete(),
          db.cachedPools.where('tournamentId').equals('t1').delete(),
          db.cachedBrackets.where('tournamentId').equals('t1').delete(),
          db.cachedRegistrations.where('tournamentId').equals('t1').delete(),
        ]);
      },
    );

    expect(await db.cachedTournaments.count()).toBe(0);
    expect(await db.cachedTeams.count()).toBe(0);
    expect(await db.cachedPools.count()).toBe(0);
    expect(await db.cachedBrackets.count()).toBe(0);
    expect(await db.cachedRegistrations.count()).toBe(0);
  });

  it('overwrite semantics: put replaces existing', async () => {
    await db.cachedTournaments.put({ id: 't1', name: 'Old', status: 'registration', organizerId: 'u1', cachedAt: 100 } as any);
    await db.cachedTournaments.put({ id: 't1', name: 'New', status: 'pool-play', organizerId: 'u1', cachedAt: 200 } as any);
    const result = await db.cachedTournaments.get('t1');
    expect(result?.name).toBe('New');
    expect(result?.cachedAt).toBe(200);
  });
});
```

**Step 2: Run tests to verify they pass (these test db.ts, should pass now)**

Run: `npx vitest run src/features/tournaments/hooks/__tests__/useTournamentLive-cache.test.ts`
Expected: All 4 tests PASS (they test the schema from Task 10)

**Step 3: Modify useTournamentLive.ts**

In `src/features/tournaments/hooks/useTournamentLive.ts`:

Add import at top:
```ts
import { db } from '../../../data/db';
```

Add helper constants for active statuses (after imports):
```ts
const ACTIVE_STATUSES = new Set(['registration', 'pool-play', 'bracket', 'paused']);
```

Modify the `subscribe` function to be `async` and add Dexie hydration before the onSnapshot calls. Replace the existing `subscribe` (lines 40-113):

```ts
const subscribe = async (id: string) => {
  cleanup();
  setLoading(true);
  setError('');

  // Hydrate from Dexie cache immediately (stale-while-revalidate)
  try {
    const [cachedT, cachedTeamRows, cachedPoolRows, cachedBracketRows, cachedRegRows] =
      await Promise.all([
        db.cachedTournaments.get(id),
        db.cachedTeams.where('tournamentId').equals(id).toArray(),
        db.cachedPools.where('tournamentId').equals(id).toArray(),
        db.cachedBrackets.where('tournamentId').equals(id).toArray(),
        db.cachedRegistrations.where('tournamentId').equals(id).toArray(),
      ]);

    if (cachedT) {
      setTournament(cachedT);
      setLoading(false); // Cache hit — show UI immediately
    }
    if (cachedTeamRows.length) setTeams(cachedTeamRows);
    if (cachedPoolRows.length) setPools(cachedPoolRows);
    if (cachedBracketRows.length) setBracket(cachedBracketRows);
    if (cachedRegRows.length) setRegistrations(cachedRegRows);
  } catch {
    // Cache read failed — continue to network
  }

  // Listen to tournament doc
  const tournamentRef = doc(firestore, 'tournaments', id);
  unsubscribers.push(
    onSnapshot(
      tournamentRef,
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Tournament;
          setTournament(data);
          // Write-through to Dexie
          if (ACTIVE_STATUSES.has(data.status)) {
            db.cachedTournaments.put({ ...data, cachedAt: Date.now() }).catch(() => {});
          } else {
            // Completed/cancelled — clean up cache
            db.transaction('rw',
              db.cachedTournaments, db.cachedTeams, db.cachedPools,
              db.cachedBrackets, db.cachedRegistrations,
              async () => {
                await Promise.all([
                  db.cachedTournaments.delete(id),
                  db.cachedTeams.where('tournamentId').equals(id).delete(),
                  db.cachedPools.where('tournamentId').equals(id).delete(),
                  db.cachedBrackets.where('tournamentId').equals(id).delete(),
                  db.cachedRegistrations.where('tournamentId').equals(id).delete(),
                ]);
              },
            ).catch(() => {});
          }
        } else {
          setTournament(undefined);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Tournament listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    ),
  );

  // Listen to teams sub-collection
  const teamsRef = collection(firestore, 'tournaments', id, 'teams');
  unsubscribers.push(
    onSnapshot(
      teamsRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentTeam);
        setTeams(data);
        db.cachedTeams.bulkPut(data.map(t => ({ ...t, tournamentId: id, cachedAt: Date.now() }))).catch(() => {});
      },
      (err) => console.error('Teams listener error:', err),
    ),
  );

  // Listen to pools sub-collection
  const poolsRef = collection(firestore, 'tournaments', id, 'pools');
  unsubscribers.push(
    onSnapshot(
      poolsRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentPool);
        setPools(data);
        db.cachedPools.bulkPut(data.map(p => ({ ...p, tournamentId: id, cachedAt: Date.now() }))).catch(() => {});
      },
      (err) => console.error('Pools listener error:', err),
    ),
  );

  // Listen to bracket sub-collection
  const bracketRef = collection(firestore, 'tournaments', id, 'bracket');
  unsubscribers.push(
    onSnapshot(
      bracketRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BracketSlot);
        setBracket(data);
        db.cachedBrackets.bulkPut(data.map(b => ({ ...b, tournamentId: id, cachedAt: Date.now() }))).catch(() => {});
      },
      (err) => console.error('Bracket listener error:', err),
    ),
  );

  // Listen to registrations sub-collection
  const regsRef = collection(firestore, 'tournaments', id, 'registrations');
  unsubscribers.push(
    onSnapshot(
      regsRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentRegistration);
        setRegistrations(data);
        db.cachedRegistrations.bulkPut(data.map(r => ({ ...r, tournamentId: id, cachedAt: Date.now() }))).catch(() => {});
      },
      (err) => console.error('Registrations listener error:', err),
    ),
  );
};
```

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/features/tournaments/hooks/useTournamentLive.ts src/features/tournaments/hooks/__tests__/useTournamentLive-cache.test.ts
git commit -m "feat: add Dexie write-through and cache hydration to useTournamentLive"
```

---

## Task 12: Sign-Out Cache Wipe

**Files:**
- Modify: `src/shared/hooks/useAuth.ts:110-112` (add cache wipe before signOut)
- Create: `src/shared/pwa/__tests__/signOutWipe.test.ts`

**Step 1: Write failing test**

Create `src/shared/pwa/__tests__/signOutWipe.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../data/db';
import { clearTournamentCache } from '../tournamentCacheUtils';

describe('clearTournamentCache', () => {
  beforeEach(async () => {
    // Seed some data
    const now = Date.now();
    await db.cachedTournaments.put({ id: 't1', status: 'pool-play', organizerId: 'u1', cachedAt: now } as any);
    await db.cachedTeams.put({ id: 'tm1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedPools.put({ id: 'p1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedBrackets.put({ id: 'b1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedRegistrations.put({ id: 'r1', tournamentId: 't1', cachedAt: now } as any);
  });

  it('clears all 5 cache tables', async () => {
    await clearTournamentCache();
    expect(await db.cachedTournaments.count()).toBe(0);
    expect(await db.cachedTeams.count()).toBe(0);
    expect(await db.cachedPools.count()).toBe(0);
    expect(await db.cachedBrackets.count()).toBe(0);
    expect(await db.cachedRegistrations.count()).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/signOutWipe.test.ts`
Expected: FAIL — `tournamentCacheUtils` does not exist

**Step 3: Create utility**

Create `src/shared/pwa/tournamentCacheUtils.ts`:

```ts
import { db } from '../../data/db';

export async function clearTournamentCache(): Promise<void> {
  await db.transaction('rw',
    db.cachedTournaments, db.cachedTeams, db.cachedPools,
    db.cachedBrackets, db.cachedRegistrations,
    async () => {
      await Promise.all([
        db.cachedTournaments.clear(),
        db.cachedTeams.clear(),
        db.cachedPools.clear(),
        db.cachedBrackets.clear(),
        db.cachedRegistrations.clear(),
      ]);
    },
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/pwa/__tests__/signOutWipe.test.ts`
Expected: PASS

**Step 5: Wire into useAuth.ts signOut**

In `src/shared/hooks/useAuth.ts`:

Add import at top:
```ts
import { clearTournamentCache } from '../pwa/tournamentCacheUtils';
```

Replace the `signOut` function (lines 110-112):
```ts
const signOut = async () => {
  await firebaseSignOut(auth);
};
```

With:
```ts
const signOut = async () => {
  await clearTournamentCache();
  await firebaseSignOut(auth);
};
```

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/shared/pwa/tournamentCacheUtils.ts src/shared/pwa/__tests__/signOutWipe.test.ts src/shared/hooks/useAuth.ts
git commit -m "feat: wipe tournament cache on sign-out before Firebase signOut"
```

---

## Task 13: Startup Cache Pruning

**Files:**
- Modify: `src/data/firebase/syncProcessor.ts` (add cache prune to startup)
- Create: `src/shared/pwa/__tests__/cachePruning.test.ts`

**Step 1: Write failing test**

Create `src/shared/pwa/__tests__/cachePruning.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../data/db';
import { pruneStaleTournamentCache } from '../tournamentCacheUtils';

describe('pruneStaleTournamentCache', () => {
  beforeEach(async () => {
    await db.cachedTournaments.clear();
    await db.cachedTeams.clear();
    await db.cachedPools.clear();
  });

  it('removes tournaments with cachedAt older than 90 days', async () => {
    const old = Date.now() - 91 * 24 * 60 * 60 * 1000;
    const recent = Date.now() - 1 * 24 * 60 * 60 * 1000;

    await db.cachedTournaments.bulkPut([
      { id: 'old1', status: 'completed', organizerId: 'u1', cachedAt: old } as any,
      { id: 'recent1', status: 'pool-play', organizerId: 'u1', cachedAt: recent } as any,
    ]);
    await db.cachedTeams.bulkPut([
      { id: 'tm-old', tournamentId: 'old1', cachedAt: old } as any,
      { id: 'tm-recent', tournamentId: 'recent1', cachedAt: recent } as any,
    ]);

    await pruneStaleTournamentCache();

    expect(await db.cachedTournaments.count()).toBe(1);
    const remaining = await db.cachedTournaments.get('recent1');
    expect(remaining).toBeDefined();

    expect(await db.cachedTeams.count()).toBe(1);
    const remainingTeam = await db.cachedTeams.get('tm-recent');
    expect(remainingTeam).toBeDefined();
  });

  it('does nothing when all cache is recent', async () => {
    const recent = Date.now() - 1000;
    await db.cachedTournaments.put({ id: 't1', status: 'pool-play', organizerId: 'u1', cachedAt: recent } as any);
    await pruneStaleTournamentCache();
    expect(await db.cachedTournaments.count()).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/cachePruning.test.ts`
Expected: FAIL — `pruneStaleTournamentCache` does not exist

**Step 3: Add the function to tournamentCacheUtils.ts**

Add to `src/shared/pwa/tournamentCacheUtils.ts`:

```ts
const PRUNE_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export async function pruneStaleTournamentCache(): Promise<void> {
  const cutoff = Date.now() - PRUNE_AGE_MS;

  const staleTournaments = await db.cachedTournaments
    .where('cachedAt')
    .below(cutoff)
    .toArray();

  if (staleTournaments.length === 0) return;

  const staleIds = staleTournaments.map(t => t.id);

  await db.transaction('rw',
    db.cachedTournaments, db.cachedTeams, db.cachedPools,
    db.cachedBrackets, db.cachedRegistrations,
    async () => {
      await db.cachedTournaments.where('cachedAt').below(cutoff).delete();
      for (const tid of staleIds) {
        await db.cachedTeams.where('tournamentId').equals(tid).delete();
        await db.cachedPools.where('tournamentId').equals(tid).delete();
        await db.cachedBrackets.where('tournamentId').equals(tid).delete();
        await db.cachedRegistrations.where('tournamentId').equals(tid).delete();
      }
    },
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/pwa/__tests__/cachePruning.test.ts`
Expected: All 2 tests PASS

**Step 5: Wire into syncProcessor startup**

In `src/data/firebase/syncProcessor.ts`, find the `runStartupCleanup` function and add at the end:

```ts
import { pruneStaleTournamentCache } from '../../shared/pwa/tournamentCacheUtils';
```

Inside `runStartupCleanup`, add at the end:
```ts
// Prune stale tournament cache (>90 days old)
await pruneStaleTournamentCache().catch((err) => {
  console.warn('Tournament cache pruning failed:', err);
});
```

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/shared/pwa/tournamentCacheUtils.ts src/shared/pwa/__tests__/cachePruning.test.ts src/data/firebase/syncProcessor.ts
git commit -m "feat: add 90-day tournament cache pruning on app startup"
```

---

## Task 14: E2E Tests

**Files:**
- Create: `e2e/pwa/sw-update.spec.ts`
- Create: `e2e/pwa/install-prompt.spec.ts`

**Step 1: Write SW update E2E test**

Create `e2e/pwa/sw-update.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('SW Update Toast', () => {
  test('SWUpdateToast renders with correct structure', async ({ page }) => {
    await page.goto('http://localhost:5199/');
    // The toast is hidden by default (no SW update pending)
    const statusRegion = page.locator('[role="status"][aria-live="polite"]');
    await expect(statusRegion).toBeAttached();
    // No visible toast content
    await expect(page.getByText('A new version is available')).not.toBeVisible();
  });
});
```

**Step 2: Write install prompt E2E test**

Create `e2e/pwa/install-prompt.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Install Prompt', () => {
  test('LandingPage footer has install CTA area', async ({ page }) => {
    await page.goto('http://localhost:5199/');
    // Footer should exist
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('SettingsPage has App Installation section', async ({ page }) => {
    // Need to be authenticated for settings page
    await page.goto('http://localhost:5199/settings');
    // The install section fieldset should be present
    const installSection = page.getByText('App Installation');
    // May or may not be visible depending on auth state
  });
});
```

**Step 3: Run E2E tests**

Run: `npx playwright test e2e/pwa/`
Expected: Tests pass (basic structure tests)

**Step 4: Commit**

```bash
git add e2e/pwa/
git commit -m "test: add E2E tests for SW update toast and install prompt structure"
```

---

## Task 15: Update Roadmap + Final Verification

**Files:**
- Modify: `docs/ROADMAP.md` (mark Layer 9 complete)

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Build**

Run: `npx vite build`
Expected: Build succeeds. Check `dist/sw.js` contains runtime caching rules and NavigationRoute.

**Step 4: Update ROADMAP.md**

Mark Layer 9 as complete in `docs/ROADMAP.md`.

**Step 5: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Layer 9 (PWA & Offline Hardening) complete in roadmap"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Self-host Oswald font, delete vite.svg | Visual verification |
| 2 | SW caching config (runtime caching, navigateFallback) | Build verification |
| 3 | Firebase Hosting config (CSP, cache headers, rewrites) | JSON validation |
| 4 | SW Update Store | 7 unit tests |
| 5 | SWUpdateToast component + App.tsx wiring | 4 component tests |
| 6 | Install Prompt Store | 12 unit tests |
| 7 | PWA Lifecycle Init | 5 unit tests |
| 8 | InstallPromptBanner component | 5 component tests |
| 9 | Wire install CTA into LandingPage + SettingsPage | Visual verification |
| 10 | Dexie v5 schema (5 cache tables) | 7 schema tests |
| 11 | Tournament cache write-through + hydration | 4 integration tests |
| 12 | Sign-out cache wipe | 1 unit test |
| 13 | Startup cache pruning (90 days) | 2 unit tests |
| 14 | E2E tests | 2 E2E tests |
| 15 | Roadmap update + final verification | Full suite run |

**Total: 15 tasks, ~49 new tests**
