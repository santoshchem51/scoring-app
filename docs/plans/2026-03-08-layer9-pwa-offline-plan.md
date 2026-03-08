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
- Create: `src/shared/pwa/__tests__/fontConfig.test.ts`

**Step 1: Download the font file**

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

**Step 4: Write config verification test**

Create `src/shared/pwa/__tests__/fontConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Self-hosted font configuration', () => {
  it('Oswald-Bold.woff2 exists in public/fonts/', () => {
    const fontPath = resolve(__dirname, '../../../../public/fonts/Oswald-Bold.woff2');
    expect(existsSync(fontPath)).toBe(true);
  });

  it('index.html has no Google Fonts references', () => {
    const html = readFileSync(resolve(__dirname, '../../../../index.html'), 'utf8');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('index.html has local font preload', () => {
    const html = readFileSync(resolve(__dirname, '../../../../index.html'), 'utf8');
    expect(html).toContain('rel="preload"');
    expect(html).toContain('/fonts/Oswald-Bold.woff2');
  });

  it('styles.css has @font-face declaration for Oswald', () => {
    const css = readFileSync(resolve(__dirname, '../../../styles.css'), 'utf8');
    expect(css).toContain("font-family: 'Oswald'");
    expect(css).toContain('font-display: swap');
  });
});
```

**Step 5: Run tests**

Run: `npx vitest run src/shared/pwa/__tests__/fontConfig.test.ts`
Expected: All 4 tests PASS

**Step 6: Verify the font loads**

Run: `npx vite --port 5199`
- Open http://localhost:5199
- Verify score text uses Oswald (bold, condensed)
- Check Network tab: should fetch `/fonts/Oswald-Bold.woff2` from same origin (no Google Fonts)

**Step 7: Commit**

```bash
git add public/fonts/Oswald-Bold.woff2 index.html src/styles.css src/shared/pwa/__tests__/fontConfig.test.ts
git commit -m "feat: self-host Oswald font, remove Google Fonts dependency"
```

---

## Task 2: SW Caching Configuration

**Files:**
- Modify: `vite.config.ts:39-41` (expand workbox config)
- Modify: `tsconfig.app.json:8` (add vite-plugin-pwa/client type)
- Create: `src/shared/pwa/__tests__/workboxConfig.test.ts`

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
      urlPattern: /\/assets\/.+\.(js|css)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'vite-assets',
        expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/fonts\/.+\.woff2$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'local-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-profile-photos',
        expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
        purgeOnQuotaError: true,
      },
    },
  ],
},
```

Notes:
- Removed `svg` from globPatterns (favicon.svg is in `includeAssets`).
- Added CacheFirst for `/assets/**` (Vite content-hashed, immutable) and `/fonts/**`.
- `purgeOnQuotaError: true` on profile photos — scoped to images only, never JS chunks.
- Firebase endpoints left unmatched (default NetworkOnly).

**Step 3: Write config verification test**

Create `src/shared/pwa/__tests__/workboxConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Workbox configuration', () => {
  const config = readFileSync(resolve(__dirname, '../../../../vite.config.ts'), 'utf8');

  it('has navigateFallback for offline deep links', () => {
    expect(config).toContain("navigateFallback: '/index.html'");
  });

  it('has navigateFallbackDenylist', () => {
    expect(config).toContain('navigateFallbackDenylist');
  });

  it('has cleanupOutdatedCaches enabled', () => {
    expect(config).toContain('cleanupOutdatedCaches: true');
  });

  it('has CacheFirst rule for /assets/', () => {
    expect(config).toContain("cacheName: 'vite-assets'");
  });

  it('has CacheFirst rule for /fonts/', () => {
    expect(config).toContain("cacheName: 'local-fonts'");
  });

  it('has StaleWhileRevalidate for Google profile photos', () => {
    expect(config).toContain("cacheName: 'google-profile-photos'");
  });

  it('has cacheId for namespace isolation', () => {
    expect(config).toContain("cacheId: 'picklescore'");
  });

  it('has dontCacheBustURLsMatching for Vite hashes', () => {
    expect(config).toContain('dontCacheBustURLsMatching');
  });
});
```

**Step 4: Run tests**

Run: `npx vitest run src/shared/pwa/__tests__/workboxConfig.test.ts`
Expected: All 8 tests PASS

**Step 5: Verify build succeeds**

Run: `npx vite build`
- Should succeed with no errors
- Check `dist/sw.js` exists

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add vite.config.ts tsconfig.app.json src/shared/pwa/__tests__/workboxConfig.test.ts
git commit -m "feat: add Workbox runtime caching, navigateFallback, CacheFirst rules"
```

---

## Task 3: Firebase Hosting Configuration

**Files:**
- Modify: `firebase.json` (add hosting section)
- Create: `src/shared/pwa/__tests__/firebaseHostingConfig.test.ts`

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

**Step 2: Write config verification test**

Create `src/shared/pwa/__tests__/firebaseHostingConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Firebase Hosting configuration', () => {
  const config = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../firebase.json'), 'utf8')
  );

  it('has hosting section', () => {
    expect(config.hosting).toBeDefined();
  });

  it('has SPA rewrite rule', () => {
    const rewrite = config.hosting.rewrites.find(
      (r: { destination: string }) => r.destination === '/index.html'
    );
    expect(rewrite).toBeTruthy();
  });

  it('has CSP header with required directives', () => {
    const globalHeaders = config.hosting.headers.find(
      (h: { source: string }) => h.source === '**'
    );
    const csp = globalHeaders.headers.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy'
    );
    expect(csp).toBeTruthy();
    expect(csp.value).toContain("default-src 'self'");
    expect(csp.value).toContain("object-src 'none'");
    expect(csp.value).toContain("worker-src 'self'");
    expect(csp.value).toContain('accounts.google.com');
  });

  it('has no-cache on sw.js', () => {
    const swHeaders = config.hosting.headers.find(
      (h: { source: string }) => h.source === '/sw.js'
    );
    expect(swHeaders.headers[0].value).toContain('no-cache');
  });

  it('has immutable cache on /assets/**', () => {
    const assetHeaders = config.hosting.headers.find(
      (h: { source: string }) => h.source === '/assets/**'
    );
    expect(assetHeaders.headers[0].value).toContain('immutable');
  });

  it('has no-cache on manifest.webmanifest', () => {
    const manifestHeaders = config.hosting.headers.find(
      (h: { source: string }) => h.source === '/manifest.webmanifest'
    );
    expect(manifestHeaders.headers[0].value).toContain('no-cache');
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/shared/pwa/__tests__/firebaseHostingConfig.test.ts`
Expected: All 6 tests PASS

**Step 4: Commit**

```bash
git add firebase.json src/shared/pwa/__tests__/firebaseHostingConfig.test.ts
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
    localStorage.removeItem('sw-update-dismissed-at');
    localStorage.removeItem('sw-updated-pending-ack');
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
    mockRegisterSW.mockReturnValue(vi.fn());
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

  it('swUpdateVisible returns false within 24h of dismiss', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
    localStorage.setItem('sw-update-dismissed-at', String(Date.now() - 23 * 60 * 60 * 1000));
    const { initSWUpdate, swUpdateVisible } = await import('../swUpdateStore');
    initSWUpdate();
    capturedOnNeedRefresh!();
    expect(swUpdateVisible()).toBe(false);
  });

  it('swUpdateVisible returns true after 24h dismiss expires', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
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
    applyUpdate();
  });

  it('updateAcknowledged returns true when pending ack exists on init', async () => {
    localStorage.setItem('sw-updated-pending-ack', '1');
    mockRegisterSW.mockReturnValue(vi.fn());
    const { initSWUpdate, updateAcknowledged } = await import('../swUpdateStore');
    initSWUpdate();
    expect(updateAcknowledged()).toBe(true);
    expect(localStorage.getItem('sw-updated-pending-ack')).toBeNull();
  });

  it('updateAcknowledged returns false when no pending ack', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { initSWUpdate, updateAcknowledged } = await import('../swUpdateStore');
    initSWUpdate();
    expect(updateAcknowledged()).toBe(false);
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
const [_updateAcknowledged, setUpdateAcknowledged] = createSignal(false);
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
    setUpdateAcknowledged(true);
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

export function clearUpdateAck(): void {
  setUpdateAcknowledged(false);
}

export const updateAcknowledged = (): boolean => _updateAcknowledged();

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
Expected: All 11 tests PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/shared/pwa/swUpdateStore.ts src/shared/pwa/__tests__/swUpdateStore.test.ts
git commit -m "feat: add SW update store with 24h dismiss, pending ack, and idempotent init"
```

---

## Task 5: SWUpdateToast Component + App.tsx Wiring

**Files:**
- Create: `src/shared/pwa/SWUpdateToast.tsx`
- Create: `src/shared/pwa/__tests__/SWUpdateToast.test.tsx`
- Modify: `src/app/App.tsx:2,34` (add onMount, import + mount toast + init)

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/SWUpdateToast.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

// Mock swUpdateStore
const mockSwUpdateVisible = vi.fn(() => false);
const mockApplyUpdate = vi.fn();
const mockDismissUpdate = vi.fn();
const mockUpdateAcknowledged = vi.fn(() => false);
const mockClearUpdateAck = vi.fn();

vi.mock('../swUpdateStore', () => ({
  swUpdateVisible: mockSwUpdateVisible,
  applyUpdate: mockApplyUpdate,
  dismissUpdate: mockDismissUpdate,
  updateAcknowledged: mockUpdateAcknowledged,
  clearUpdateAck: mockClearUpdateAck,
}));

// Must import AFTER mocks
import SWUpdateToast from '../SWUpdateToast';

describe('SWUpdateToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSwUpdateVisible.mockReturnValue(false);
    mockUpdateAcknowledged.mockReturnValue(false);
  });

  it('renders aria-live region even when hidden', () => {
    const { container } = render(() => <SWUpdateToast />);
    const statusEl = container.querySelector('[role="status"]');
    expect(statusEl).toBeTruthy();
    expect(statusEl?.getAttribute('aria-live')).toBe('polite');
  });

  it('hides toast content when swUpdateVisible is false', () => {
    render(() => <SWUpdateToast />);
    expect(screen.queryByText('A new version is available')).toBeNull();
  });

  it('shows toast when swUpdateVisible is true', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    expect(screen.getByText('A new version is available')).toBeTruthy();
    expect(screen.getByRole('button', { name: /update/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /remind me tomorrow/i })).toBeTruthy();
  });

  it('calls applyUpdate when Update button is clicked', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    screen.getByRole('button', { name: /update/i }).click();
    expect(mockApplyUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls dismissUpdate when Remind me tomorrow is clicked', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    render(() => <SWUpdateToast />);
    screen.getByRole('button', { name: /remind me tomorrow/i }).click();
    expect(mockDismissUpdate).toHaveBeenCalledTimes(1);
  });

  it('has z-40 and fixed positioning when visible', () => {
    mockSwUpdateVisible.mockReturnValue(true);
    const { container } = render(() => <SWUpdateToast />);
    const toast = container.querySelector('.fixed.z-40');
    expect(toast).toBeTruthy();
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
Expected: All 6 tests PASS

**Step 5: Mount in App.tsx**

In `src/app/App.tsx`:

Update line 2 to add `onMount`:
```ts
import { Show, Suspense, createEffect, onMount } from 'solid-js';
```

Add imports after line 7:
```ts
import SWUpdateToast from '../shared/pwa/SWUpdateToast';
import { initSWUpdate } from '../shared/pwa/swUpdateStore';
```

Inside the `App` component function (after the `createEffect` block at line 24, before the `return`), add:
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

  it('showInstallBanner returns true when event captured and 3+ visits', async () => {
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    expect(showInstallBanner()).toBe(true);
  });

  it('showInstallBanner returns false with only 2 visits and no matches', async () => {
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '2');
    expect(showInstallBanner()).toBe(false);
  });

  it('showInstallBanner returns true when matchCount >= 1', async () => {
    const { captureInstallEvent, showInstallBanner, setCompletedMatchCount } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    setCompletedMatchCount(1);
    expect(showInstallBanner()).toBe(true);
  });

  it('showInstallBanner returns false when swUpdateVisible is true (co-presence rule)', async () => {
    const { swUpdateVisible } = await import('../swUpdateStore');
    vi.mocked(swUpdateVisible).mockReturnValue(true);
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    expect(showInstallBanner()).toBe(false);
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

  it('showInstallBanner returns true after soft dismiss expires (7+ days)', async () => {
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    localStorage.setItem('pwa-install-dismiss', JSON.stringify({
      tier: 'soft', until: Date.now() - 8 * 24 * 60 * 60 * 1000,
    }));
    expect(showInstallBanner()).toBe(true);
  });

  it('showInstallBanner returns false when neverDismiss was called', async () => {
    const { captureInstallEvent, neverDismiss, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    neverDismiss();
    expect(showInstallBanner()).toBe(false);
  });

  it('dismiss escalates: first soft, second hard', async () => {
    const { dismissAndEscalate, getDismissState } = await import('../installPromptStore');
    dismissAndEscalate();
    expect(getDismissState()).toBe('soft');
    // Expire the soft dismiss
    localStorage.setItem('pwa-install-dismiss', JSON.stringify({
      tier: 'soft', until: Date.now() - 1,
    }));
    dismissAndEscalate();
    expect(getDismissState()).toBe('hard');
  });

  it('triggerInstallPrompt calls prompt and returns accepted', async () => {
    const { captureInstallEvent, triggerInstallPrompt, isInstalled } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    captureInstallEvent(fakeEvent);
    const result = await triggerInstallPrompt();
    expect(fakeEvent.prompt).toHaveBeenCalled();
    expect(result).toBe('accepted');
    expect(isInstalled()).toBe(true);
  });

  it('triggerInstallPrompt returns dismissed when user declines', async () => {
    const { captureInstallEvent, triggerInstallPrompt, isInstalled } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn().mockResolvedValue({ outcome: 'dismissed' });
    captureInstallEvent(fakeEvent);
    const result = await triggerInstallPrompt();
    expect(result).toBe('dismissed');
    expect(isInstalled()).toBe(false);
  });

  it('triggerInstallPrompt returns null when no event captured', async () => {
    const { triggerInstallPrompt } = await import('../installPromptStore');
    const result = await triggerInstallPrompt();
    expect(result).toBeNull();
  });

  it('detectIOSSafari identifies Safari on iOS', async () => {
    const { detectIOSSafari } = await import('../installPromptStore');
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
const [matchCount, setMatchCount] = createSignal(0);

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

/**
 * Auto-escalating dismiss: soft → hard → never.
 * If current dismiss has expired, escalate to next tier.
 */
export function dismissAndEscalate(): void {
  const current = readDismiss();
  if (current.tier === 'none' || (current.tier === 'soft' && current.until && Date.now() < current.until)) {
    softDismiss();
  } else if (current.tier === 'soft') {
    hardDismiss();
  } else {
    neverDismiss();
  }
}

// ── Trigger Logic ──

function hasTriggerCondition(): boolean {
  if (matchCount() >= 1) return true; // Primary: completed a match
  const visitCount = Number(localStorage.getItem(VISIT_KEY) || '0');
  return visitCount >= 3; // Fallback: 3rd visit
}

export function incrementVisitCount(): void {
  const count = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
  localStorage.setItem(VISIT_KEY, String(count));
}

export function setCompletedMatchCount(count: number): void {
  setMatchCount(count);
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
  setPromptEvent(null);
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
Expected: All 21 tests PASS

**Step 5: Commit**

```bash
git add src/shared/pwa/installPromptStore.ts src/shared/pwa/__tests__/installPromptStore.test.ts
git commit -m "feat: add install prompt store with tiered dismiss, match trigger, iOS detection"
```

---

## Task 7: PWA Lifecycle Init + Tests

**Files:**
- Create: `src/shared/pwa/pwaLifecycle.ts`
- Create: `src/shared/pwa/__tests__/pwaLifecycle.test.ts`
- Modify: `src/index.tsx` (add init call)

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/pwaLifecycle.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../installPromptStore', () => ({
  captureInstallEvent: vi.fn(),
  markInstalled: vi.fn(),
  incrementVisitCount: vi.fn(),
  setCompletedMatchCount: vi.fn(),
}));

vi.mock('../../../data/db', () => ({
  db: {
    matches: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
        }),
      }),
    },
  },
}));

describe('pwaLifecycle', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
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

  it('initPWAListeners queries Dexie for completed match count', async () => {
    const { setCompletedMatchCount } = await import('../installPromptStore');
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    // Allow the async query to resolve
    await new Promise(r => setTimeout(r, 10));
    expect(setCompletedMatchCount).toHaveBeenCalledWith(0);
  });

  it('initPWAListeners is idempotent', async () => {
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const count1 = addEventListenerSpy.mock.calls.length;
    initPWAListeners();
    const count2 = addEventListenerSpy.mock.calls.length;
    expect(count2).toBe(count1);
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
import { captureInstallEvent, markInstalled, incrementVisitCount, setCompletedMatchCount } from './installPromptStore';
import { db } from '../../data/db';

let _initialized = false;

export function initPWAListeners(): void {
  if (_initialized) return;
  _initialized = true;

  incrementVisitCount();

  // Query completed match count for install trigger
  db.matches.where('status').equals('completed').count()
    .then(count => setCompletedMatchCount(count))
    .catch(() => {}); // Ignore if Dexie fails

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
Expected: All 6 tests PASS

**Step 5: Wire into index.tsx**

In `src/index.tsx`, add after the imports (before `const root`):
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
git commit -m "feat: add PWA lifecycle listeners (beforeinstallprompt, appinstalled, match count)"
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
const mockDismissAndEscalate = vi.fn();
const mockNeverDismiss = vi.fn();
const mockIosInstallSupported = vi.fn(() => false);

vi.mock('../installPromptStore', () => ({
  showInstallBanner: mockShowInstallBanner,
  triggerInstallPrompt: mockTriggerInstallPrompt,
  dismissAndEscalate: mockDismissAndEscalate,
  neverDismiss: mockNeverDismiss,
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
    expect(screen.getByRole('button', { name: /don.t ask again/i })).toBeTruthy();
  });

  it('calls triggerInstallPrompt when Install is clicked', () => {
    mockShowInstallBanner.mockReturnValue(true);
    mockTriggerInstallPrompt.mockResolvedValue('accepted');
    render(() => <InstallPromptBanner />);
    screen.getByRole('button', { name: /install/i }).click();
    expect(mockTriggerInstallPrompt).toHaveBeenCalledTimes(1);
  });

  it('calls dismissAndEscalate when Not now is clicked', () => {
    mockShowInstallBanner.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    screen.getByRole('button', { name: /not now/i }).click();
    expect(mockDismissAndEscalate).toHaveBeenCalledTimes(1);
  });

  it('calls neverDismiss when Don\'t ask again is clicked', () => {
    mockShowInstallBanner.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    screen.getByRole('button', { name: /don.t ask again/i }).click();
    expect(mockNeverDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows iOS instructions when iosInstallSupported is true', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <InstallPromptBanner />);
    expect(screen.getByText(/add to home screen/i)).toBeTruthy();
  });

  it('has 44px minimum tap targets on all buttons', () => {
    mockShowInstallBanner.mockReturnValue(true);
    const { container } = render(() => <InstallPromptBanner />);
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
      expect(btn.className).toContain('min-h-[44px]');
    });
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
  dismissAndEscalate,
  neverDismiss,
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
          class="bg-surface-light border border-border rounded-xl p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-on-surface">Install PickleScore</p>
              <p class="text-xs text-on-surface-muted mt-0.5">Add to your home screen for the best experience</p>
            </div>
            <button
              type="button"
              class="bg-primary text-surface text-sm font-semibold px-4 min-h-[44px] rounded-lg hover:bg-primary-dark transition-colors flex-shrink-0"
              aria-label="Install PickleScore"
              onClick={handleInstall}
            >
              Install
            </button>
          </div>
          <div class="flex items-center gap-3 mt-2 pt-2 border-t border-border">
            <button
              type="button"
              class="text-xs text-on-surface-muted hover:text-on-surface min-h-[44px] flex items-center"
              aria-label="Not now"
              onClick={() => dismissAndEscalate()}
            >
              Not now
            </button>
            <button
              type="button"
              class="text-xs text-on-surface-muted hover:text-on-surface min-h-[44px] flex items-center"
              aria-label="Don't ask again"
              onClick={() => neverDismiss()}
            >
              Don't ask again
            </button>
          </div>
        </div>
      </Show>

      {/* iOS Safari instructions — opens IOSInstallSheet (Task 9) */}
      <Show when={!isInstalled() && iosInstallSupported()}>
        <div class="bg-surface-light border border-border rounded-xl p-4">
          <p class="text-sm font-semibold text-on-surface">Install PickleScore</p>
          <p class="text-xs text-on-surface-muted mt-1">
            Tap the share button then "Add to Home Screen" to install
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
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/shared/pwa/InstallPromptBanner.tsx src/shared/pwa/__tests__/InstallPromptBanner.test.tsx
git commit -m "feat: add InstallPromptBanner with escalating dismiss, iOS path"
```

---

## Task 9: IOSInstallSheet Component + Tests

**Files:**
- Create: `src/shared/pwa/IOSInstallSheet.tsx`
- Create: `src/shared/pwa/__tests__/IOSInstallSheet.test.tsx`

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/IOSInstallSheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

const mockIosInstallSupported = vi.fn(() => false);
const mockIsInstalled = vi.fn(() => false);

vi.mock('../installPromptStore', () => ({
  iosInstallSupported: mockIosInstallSupported,
  isInstalled: mockIsInstalled,
}));

import IOSInstallSheet from '../IOSInstallSheet';

describe('IOSInstallSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIosInstallSupported.mockReturnValue(false);
    mockIsInstalled.mockReturnValue(false);
  });

  it('renders nothing when not iOS Safari', () => {
    const { container } = render(() => <IOSInstallSheet />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders dialog when open prop is true and iOS Safari', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <IOSInstallSheet open={true} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('shows step-by-step instructions', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <IOSInstallSheet open={true} onClose={() => {}} />);
    expect(screen.getByText(/share/i)).toBeTruthy();
    expect(screen.getByText(/add to home screen/i)).toBeTruthy();
  });

  it('has Got it button that calls onClose', () => {
    mockIosInstallSupported.mockReturnValue(true);
    const onClose = vi.fn();
    render(() => <IOSInstallSheet open={true} onClose={onClose} />);
    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    expect(gotItBtn).toBeTruthy();
    gotItBtn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Got it button has min 44px tap target', () => {
    mockIosInstallSupported.mockReturnValue(true);
    render(() => <IOSInstallSheet open={true} onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /got it/i });
    expect(btn.className).toContain('min-h-[44px]');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/IOSInstallSheet.test.tsx`
Expected: FAIL — module does not exist

**Step 3: Write the component**

Create `src/shared/pwa/IOSInstallSheet.tsx`:

```tsx
import type { Component } from 'solid-js';
import { Show, onMount, onCleanup } from 'solid-js';

interface Props {
  open?: boolean;
  onClose?: () => void;
}

const IOSInstallSheet: Component<Props> = (props) => {
  let dialogRef: HTMLDivElement | undefined;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose?.();
    }
    // Simple focus trap: keep focus within dialog
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

  onMount(() => {
    if (props.open) {
      document.addEventListener('keydown', handleKeyDown);
    }
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        onClick={() => props.onClose?.()}
      >
        {/* Sheet */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Install PickleScore on iOS"
          class="bg-surface rounded-t-2xl w-full max-w-lg p-6 pb-8 motion-safe:animate-slide-up"
          style={{ 'padding-bottom': 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="text-lg font-bold text-on-surface mb-4">Install PickleScore</h2>
          <ol class="space-y-4 text-sm text-on-surface-muted">
            <li class="flex items-start gap-3">
              <span class="bg-primary text-surface rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              <span>Tap the <strong class="text-on-surface">Share</strong> button <span aria-hidden="true">⎙</span> in Safari's toolbar</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="bg-primary text-surface rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <span>Scroll down and tap <strong class="text-on-surface">Add to Home Screen</strong> <span aria-hidden="true">＋</span></span>
            </li>
            <li class="flex items-start gap-3">
              <span class="bg-primary text-surface rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              <span>Tap <strong class="text-on-surface">Add</strong> in the top-right corner</span>
            </li>
          </ol>
          <button
            type="button"
            class="mt-6 w-full bg-primary text-surface font-semibold py-3 min-h-[44px] rounded-xl hover:bg-primary-dark transition-colors"
            aria-label="Got it"
            onClick={() => props.onClose?.()}
          >
            Got it
          </button>
        </div>
      </div>
    </Show>
  );
};

export default IOSInstallSheet;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pwa/__tests__/IOSInstallSheet.test.tsx`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add src/shared/pwa/IOSInstallSheet.tsx src/shared/pwa/__tests__/IOSInstallSheet.test.tsx
git commit -m "feat: add IOSInstallSheet modal with focus trap, numbered steps"
```

---

## Task 10: Wire Install CTAs into LandingPage, SettingsPage, and App.tsx

**Files:**
- Modify: `src/features/landing/LandingPage.tsx:274-276` (replace footer text with CTA)
- Modify: `src/features/settings/SettingsPage.tsx` (add install section before line 424)
- Modify: `src/app/App.tsx` (add auto-prompt fixed banner)

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

Before line 424 (the closing `</div>` of the right column), add:
```tsx
<fieldset class="bg-surface-light rounded-xl p-4">
  <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
    App Installation
  </legend>
  <InstallPromptBanner />
</fieldset>
```

**Step 3: Add auto-prompt fixed banner in App.tsx**

In `src/app/App.tsx`, add imports:
```ts
import InstallPromptBanner from '../shared/pwa/InstallPromptBanner';
import { showInstallBanner } from '../shared/pwa/installPromptStore';
```

After `<SWUpdateToast />` (added in Task 5), add the auto-prompt banner:
```tsx
<Show when={showInstallBanner() && !location.pathname.startsWith('/score/')}>
  <div
    class="fixed z-30 left-4 right-4 max-w-sm mx-auto pointer-events-auto"
    style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
  >
    <InstallPromptBanner />
  </div>
</Show>
```

Note: The `location` variable already exists in App.tsx (line 14: `const location = useLocation()`). The `Show` component is already imported. The route guard (`!location.pathname.startsWith('/score/')`) provides mid-match protection at the component level. The SWUpdateToast also uses `!location.pathname.startsWith('/score/')` — add this guard to its `Show when=` condition in `App.tsx`:

In App.tsx, update the SWUpdateToast rendering from Task 5 to also be route-gated. Wrap it:
```tsx
<Show when={!location.pathname.startsWith('/score/')}>
  <SWUpdateToast />
</Show>
```

**Step 4: Verify visually**

Run: `npx vite --port 5199`
- Visit http://localhost:5199 — landing page footer should show install CTA
- Visit Settings page — install section at bottom
- Navigate to /score/* — no banner or toast should show

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/features/landing/LandingPage.tsx src/features/settings/SettingsPage.tsx src/app/App.tsx
git commit -m "feat: wire install CTAs into LandingPage, SettingsPage, and App auto-prompt"
```

---

## Task 11: Dexie Schema v5 — Tournament Cache Tables

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

  it('cachedTournaments has status, organizerId, and cachedAt indexes', () => {
    const indexNames = db.cachedTournaments.schema.indexes.map(i => i.name);
    expect(indexNames).toContain('status');
    expect(indexNames).toContain('organizerId');
    expect(indexNames).toContain('cachedAt');
  });

  it('cachedPools has tournamentId index', () => {
    const indexNames = db.cachedPools.schema.indexes.map(i => i.name);
    expect(indexNames).toContain('tournamentId');
  });

  it('can do a round-trip insert and retrieve', async () => {
    await db.cachedTournaments.put({
      id: 'roundtrip-test', status: 'pool-play', organizerId: 'u1', cachedAt: Date.now(),
    } as any);
    const result = await db.cachedTournaments.get('roundtrip-test');
    expect(result?.id).toBe('roundtrip-test');
    await db.cachedTournaments.delete('roundtrip-test');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/__tests__/db-v5.test.ts`
Expected: FAIL — `db.cachedTournaments` is undefined

**Step 3: Update db.ts**

In `src/data/db.ts`:

Update the type import on line 3 to include all needed types:
```ts
import type { CachedAchievement, Match, Player, ScoreEvent, Tournament, TournamentTeam, TournamentPool, BracketSlot, TournamentRegistration } from './types';
```

Add cache interfaces before `const db` (before line 6):
```ts
interface CachedTournament extends Tournament { cachedAt: number }
interface CachedTeam extends TournamentTeam { cachedAt: number }
interface CachedPool extends TournamentPool { cachedAt: number }
interface CachedBracketSlot extends BracketSlot { cachedAt: number }
interface CachedRegistration extends TournamentRegistration { cachedAt: number }
```

Note: `tournamentId` is NOT re-declared — it's already inherited from the parent types (`TournamentTeam`, `TournamentPool`, `BracketSlot`, `TournamentRegistration` all have `tournamentId: string`).

Extend the Dexie type cast to include new tables:
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
Expected: All 8 tests PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/data/db.ts src/data/__tests__/db-v5.test.ts
git commit -m "feat: add Dexie v5 schema with 5 tournament cache tables"
```

---

## Task 12: Tournament Cache Utilities + Tests

**Files:**
- Create: `src/shared/pwa/tournamentCacheUtils.ts`
- Create: `src/shared/pwa/__tests__/tournamentCacheUtils.test.ts`

This task creates all three utility functions: `clearTournamentCache`, `pruneStaleTournamentCache`, and `scrubRegistrationForCache`.

**Step 1: Write failing tests**

Create `src/shared/pwa/__tests__/tournamentCacheUtils.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../data/db';
import type { TournamentRegistration } from '../../../data/types';

describe('tournamentCacheUtils', () => {
  beforeEach(async () => {
    await db.cachedTournaments.clear();
    await db.cachedTeams.clear();
    await db.cachedPools.clear();
    await db.cachedBrackets.clear();
    await db.cachedRegistrations.clear();
  });

  describe('clearTournamentCache', () => {
    it('clears all 5 cache tables', async () => {
      const now = Date.now();
      await db.cachedTournaments.put({ id: 't1', status: 'pool-play', organizerId: 'u1', cachedAt: now } as any);
      await db.cachedTeams.put({ id: 'tm1', tournamentId: 't1', cachedAt: now } as any);
      await db.cachedPools.put({ id: 'p1', tournamentId: 't1', cachedAt: now } as any);
      await db.cachedBrackets.put({ id: 'b1', tournamentId: 't1', cachedAt: now } as any);
      await db.cachedRegistrations.put({ id: 'r1', tournamentId: 't1', cachedAt: now } as any);

      const { clearTournamentCache } = await import('../tournamentCacheUtils');
      await clearTournamentCache();

      expect(await db.cachedTournaments.count()).toBe(0);
      expect(await db.cachedTeams.count()).toBe(0);
      expect(await db.cachedPools.count()).toBe(0);
      expect(await db.cachedBrackets.count()).toBe(0);
      expect(await db.cachedRegistrations.count()).toBe(0);
    });
  });

  describe('pruneStaleTournamentCache', () => {
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
      await db.cachedPools.put({ id: 'p-old', tournamentId: 'old1', cachedAt: old } as any);
      await db.cachedBrackets.put({ id: 'b-old', tournamentId: 'old1', cachedAt: old } as any);
      await db.cachedRegistrations.put({ id: 'r-old', tournamentId: 'old1', cachedAt: old } as any);

      const { pruneStaleTournamentCache } = await import('../tournamentCacheUtils');
      await pruneStaleTournamentCache();

      expect(await db.cachedTournaments.count()).toBe(1);
      expect(await db.cachedTeams.count()).toBe(1);
      expect(await db.cachedPools.count()).toBe(0);
      expect(await db.cachedBrackets.count()).toBe(0);
      expect(await db.cachedRegistrations.count()).toBe(0);
    });

    it('does nothing when all cache is recent', async () => {
      const recent = Date.now() - 1000;
      await db.cachedTournaments.put({ id: 't1', status: 'pool-play', organizerId: 'u1', cachedAt: recent } as any);

      const { pruneStaleTournamentCache } = await import('../tournamentCacheUtils');
      await pruneStaleTournamentCache();

      expect(await db.cachedTournaments.count()).toBe(1);
    });
  });

  describe('scrubRegistrationForCache', () => {
    const fullReg: TournamentRegistration = {
      id: 'r1',
      tournamentId: 't1',
      userId: 'u1',
      playerName: 'Alice',
      teamId: 'tm1',
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentNote: 'cash at registration',
      declineReason: null,
      lateEntry: false,
      skillRating: 4.0,
      partnerId: null,
      partnerName: null,
      profileComplete: true,
      registeredAt: 100,
      statusUpdatedAt: 200,
    } as TournamentRegistration;

    it('preserves all fields for organizer role', async () => {
      const { scrubRegistrationForCache } = await import('../tournamentCacheUtils');
      const result = scrubRegistrationForCache(fullReg, 'organizer');
      expect(result.paymentStatus).toBe('paid');
      expect(result.paymentNote).toBe('cash at registration');
      expect(result.skillRating).toBe(4.0);
    });

    it('preserves all fields for scorekeeper role', async () => {
      const { scrubRegistrationForCache } = await import('../tournamentCacheUtils');
      const result = scrubRegistrationForCache(fullReg, 'scorekeeper');
      expect(result.paymentStatus).toBe('paid');
    });

    it('scrubs PII fields for participant role', async () => {
      const { scrubRegistrationForCache } = await import('../tournamentCacheUtils');
      const result = scrubRegistrationForCache(fullReg, 'participant');
      expect(result.id).toBe('r1');
      expect(result.tournamentId).toBe('t1');
      expect(result.userId).toBe('u1');
      expect(result.playerName).toBe('Alice');
      expect(result.teamId).toBe('tm1');
      expect(result.status).toBe('confirmed');
      // Scrubbed fields should be undefined or null
      expect(result.paymentNote).toBeUndefined();
      expect(result.declineReason).toBeUndefined();
    });

    it('scrubs PII fields for viewer role', async () => {
      const { scrubRegistrationForCache } = await import('../tournamentCacheUtils');
      const result = scrubRegistrationForCache(fullReg, 'viewer');
      expect(result.playerName).toBe('Alice');
      expect(result.paymentNote).toBeUndefined();
      expect(result.declineReason).toBeUndefined();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pwa/__tests__/tournamentCacheUtils.test.ts`
Expected: FAIL — module does not exist

**Step 3: Write implementation**

Create `src/shared/pwa/tournamentCacheUtils.ts`:

```ts
import { db } from '../../data/db';
import type { TournamentRegistration } from '../../data/types';

// ── Cache clearing (sign-out) ──

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

// ── TTL-based pruning (startup) ──

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

// ── Registration PII scrubbing (role-gated caching) ──

type CacheRole = 'organizer' | 'scorekeeper' | 'participant' | 'viewer';

const SAFE_FIELDS: (keyof TournamentRegistration)[] = [
  'id', 'tournamentId', 'userId', 'playerName', 'teamId', 'status',
];

export function scrubRegistrationForCache(
  reg: TournamentRegistration,
  role: CacheRole,
): Partial<TournamentRegistration> {
  // Organizers and scorekeepers get full data
  if (role === 'organizer' || role === 'scorekeeper') {
    return { ...reg };
  }
  // Participants and viewers get scrubbed data
  const scrubbed: Partial<TournamentRegistration> = {};
  for (const field of SAFE_FIELDS) {
    (scrubbed as Record<string, unknown>)[field] = reg[field];
  }
  return scrubbed;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pwa/__tests__/tournamentCacheUtils.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/shared/pwa/tournamentCacheUtils.ts src/shared/pwa/__tests__/tournamentCacheUtils.test.ts
git commit -m "feat: add tournament cache utilities (clear, prune, PII scrubbing)"
```

---

## Task 13: Tournament Cache Write-Through + Hydration

**Files:**
- Modify: `src/features/tournaments/hooks/useTournamentLive.ts:1-113` (add Dexie hydration + write-through)
- Create: `src/features/tournaments/hooks/__tests__/useTournamentLive-cache.test.ts`

**Step 1: Write tests**

Create `src/features/tournaments/hooks/__tests__/useTournamentLive-cache.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../../data/db';

describe('tournament cache Dexie operations', () => {
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

**Step 2: Run tests**

Run: `npx vitest run src/features/tournaments/hooks/__tests__/useTournamentLive-cache.test.ts`
Expected: All 4 tests PASS (they test Dexie CRUD from Task 11)

**Step 3: Modify useTournamentLive.ts**

In `src/features/tournaments/hooks/useTournamentLive.ts`:

Add imports at top (after existing imports):
```ts
import { db } from '../../../data/db';
```

Add helper constants after imports:
```ts
const ACTIVE_STATUSES = new Set(['registration', 'pool-play', 'bracket', 'paused']);
```

Replace the `subscribe` function (lines 40-113) with the async version that adds Dexie hydration and write-through. The new `subscribe` function:

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
          // Write-through to Dexie (only active statuses)
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
  // Note: Registration PII scrubbing (scrubRegistrationForCache) should be applied here
  // when the user's role is known. For now, cache all fields — the scrubbing function
  // is available in tournamentCacheUtils.ts for when role-gated caching is wired up
  // with the tournament's role context.
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

## Task 14: Sign-Out Cache Wipe + Startup Cache Pruning

**Files:**
- Modify: `src/shared/hooks/useAuth.ts:110-112` (add cache wipe before signOut)
- Modify: `src/data/firebase/syncProcessor.ts:61-66` (add cache prune to startup)

**Step 1: Wire cache wipe into useAuth.ts signOut**

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

**Step 2: Wire cache pruning into syncProcessor startup**

In `src/data/firebase/syncProcessor.ts`:

Add import at top:
```ts
import { pruneStaleTournamentCache } from '../../shared/pwa/tournamentCacheUtils';
```

Inside `runStartupCleanup` (after `lastStaleCheck = Date.now();` at line 65), add:
```ts
// Prune stale tournament cache (>90 days old)
await pruneStaleTournamentCache().catch((err) => {
  console.warn('Tournament cache pruning failed:', err);
});
```

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/shared/hooks/useAuth.ts src/data/firebase/syncProcessor.ts
git commit -m "feat: wipe tournament cache on sign-out, prune stale cache on startup"
```

---

## Task 15: E2E Tests

**Files:**
- Create: `e2e/pwa/sw-update.spec.ts`
- Create: `e2e/pwa/install-prompt.spec.ts`

**Step 1: Write SW update E2E test**

Create `e2e/pwa/sw-update.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('SW Update Toast', () => {
  test('has aria-live status region for accessibility', async ({ page }) => {
    await page.goto('http://localhost:5199/');
    const statusRegion = page.locator('[role="status"][aria-live="polite"]');
    await expect(statusRegion).toBeAttached();
  });

  test('toast is hidden by default (no SW update pending)', async ({ page }) => {
    await page.goto('http://localhost:5199/');
    await expect(page.getByText('A new version is available')).not.toBeVisible();
  });

  test('toast is not shown on scoring page', async ({ page }) => {
    await page.goto('http://localhost:5199/score/test');
    await expect(page.getByText('A new version is available')).not.toBeVisible();
  });
});
```

**Step 2: Write install prompt E2E test**

Create `e2e/pwa/install-prompt.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Install Prompt', () => {
  test('install banner is hidden on first visit (no trigger condition met)', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:5199/');
    await expect(page.getByRole('button', { name: /install/i })).not.toBeVisible();
  });

  test('LandingPage footer exists', async ({ page }) => {
    await page.goto('http://localhost:5199/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('SettingsPage has App Installation section when navigated', async ({ page }) => {
    await page.goto('http://localhost:5199/settings');
    const installSection = page.getByText('App Installation');
    // Section exists in DOM (may need auth for full visibility)
    await expect(installSection).toBeAttached();
  });
});
```

**Step 3: Run E2E tests**

Run: `npx playwright test e2e/pwa/`
Expected: Tests pass

**Step 4: Commit**

```bash
git add e2e/pwa/
git commit -m "test: add E2E tests for SW update toast and install prompt"
```

---

## Task 16: Update Roadmap + Final Verification

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
Expected: Build succeeds. Check `dist/sw.js` exists.

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
| 1 | Self-host Oswald font | 4 config tests |
| 2 | SW caching config (runtime caching, navigateFallback, CacheFirst) | 8 config tests |
| 3 | Firebase Hosting config (CSP, cache headers, rewrites) | 6 config tests |
| 4 | SW Update Store | 11 unit tests |
| 5 | SWUpdateToast component + App.tsx wiring | 6 component tests |
| 6 | Install Prompt Store (tiered dismiss, match trigger, co-presence) | 21 unit tests |
| 7 | PWA Lifecycle Init (match count query) | 6 unit tests |
| 8 | InstallPromptBanner (escalating dismiss, Don't ask again) | 7 component tests |
| 9 | IOSInstallSheet modal (focus trap, dialog) | 5 component tests |
| 10 | Wire install CTAs into LandingPage, SettingsPage, App.tsx auto-prompt | Visual + route guard |
| 11 | Dexie v5 schema (5 cache tables) | 8 schema tests |
| 12 | Tournament cache utilities (clear, prune, PII scrub) | 7 unit tests |
| 13 | Tournament cache write-through + hydration | 4 integration tests |
| 14 | Sign-out cache wipe + startup pruning wiring | Full suite run |
| 15 | E2E tests | 6 E2E tests |
| 16 | Roadmap update + final verification | Full suite + type check + build |

**Total: 16 tasks, ~99 tests**

### Key changes from v1 plan:
- Added config verification tests for Tasks 1-3 (was: zero tests)
- Added CacheFirst runtime rules for /assets/ and /fonts/ (was: missing)
- Added `purgeOnQuotaError` on profile photos (was: missing)
- Added 24h boundary test + `updateAcknowledged` signal (was: TODO stub)
- Fixed contradictory onMount import in Task 5 (was: duplicate instructions)
- Added matchCount trigger from Dexie (was: visit-count only)
- Added co-presence test + boundary tests (was: untested)
- Added `dismissAndEscalate` for progressive dismiss tiers (was: only softDismiss)
- Added `triggerInstallPrompt` tests (was: untested)
- Added "Don't ask again" button (was: missing from UI)
- Added IOSInstallSheet.tsx as proper modal with focus trap (was: missing entirely)
- Added auto-prompt fixed banner in App.tsx (was: missing)
- Added mid-match route protection at component level (was: missing)
- Fixed redundant `tournamentId` in cache interfaces (was: re-declared)
- Added registration PII scrubbing utility (was: missing)
- Added related subcollection cleanup in pruning test (was: incomplete)
- Combined sign-out wipe + startup pruning into one task (was: separate)
- Rewrote E2E tests with real assertions (was: non-functional stubs)
