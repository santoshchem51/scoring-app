# Layer 9: PWA & Offline Hardening — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Harden PickleScore into a fully offline-capable, installable PWA with proper caching, install prompts, update notifications, offline tournament data, and security headers.

**Architecture:** Workbox runtime caching via vite-plugin-pwa's `generateSW` mode (Approach A). No custom service worker. Client-side only — no Cloud Functions or FCM.

**Tech Stack:** vite-plugin-pwa 1.2.0, Workbox 7.x, Dexie.js, SolidJS module-level signals, Firebase Hosting

---

## Section 1: Service Worker Caching Strategy

### Current State

- vite-plugin-pwa configured with `registerType: 'prompt'` and `generateSW`
- Workbox precaches all build assets via `globPatterns`
- No runtime caching rules
- No `navigateFallback` configured (deep links fail offline)
- Google Fonts loaded cross-origin (3 `<link>` tags)

### Runtime Caching Rules

Added to `vite.config.ts` inside `workbox: {}`:

| Pattern | Strategy | Max Entries | Max Age | Notes |
|---------|----------|-------------|---------|-------|
| `/assets/**` (JS/CSS chunks) | CacheFirst | — | 1 year | Content-hashed by Vite, immutable |
| `/fonts/**` | CacheFirst | 10 | 1 year | Self-hosted Oswald woff2 |
| Google profile photos (`lh3.googleusercontent.com`) | StaleWhileRevalidate | 50 | 30 days | Auth avatars |
| Firebase endpoints (`firebaseio.com`, `googleapis.com`) | Leave unmatched (NetworkOnly by default) | — | — | Never cache API responses |

### Additional Workbox Config

```ts
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/__\//, /\/[^/?]+\.[^/]+$/],
  cleanupOutdatedCaches: true,
  dontCacheBustURLsMatching: /\.[a-f0-9]{8}\./,
  cacheId: 'picklescore',
  runtimeCaching: [
    // ... rules from table above
  ],
}
```

### Key Decisions

- `dontCacheBustURLsMatching` prevents double-hashing Vite's content-hashed filenames
- `cacheId: 'picklescore'` namespaces caches for multi-PWA devices
- `navigateFallbackDenylist` blocks Firebase reserved paths (`/__/`) and static file requests
- `purgeOnQuotaError` scoped to fonts/images only (never JS chunks)
- Firebase endpoints left unmatched — Firestore offline persistence NOT enabled (Dexie is source of truth)

---

## Section 2: Install Prompt (A2HS)

### Architecture

**Module-level store** at `src/shared/pwa/installPromptStore.ts` (matches `useSyncStatus.ts` pattern):

- `installPromptEvent` — captured `BeforeInstallPromptEvent` (Chrome/Edge/Samsung/Opera/Brave only)
- `isInstalled` — true if `display-mode: standalone` or `navigator.standalone`
- `showInstallBanner` — derived: event captured + not installed + not dismissed + not on `/score/*` + update toast not visible
- `dismissState` — tiered from localStorage
- `iosInstallSupported` — true if Safari on iOS/iPadOS (not Chrome/Firefox iOS)

### Type Declaration

```ts
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
```

### Trigger Logic

1. **Primary**: After first completed match (`matchCount >= 1` from Dexie)
2. **Fallback**: 3rd visit if no match completed (visit count in localStorage)
3. **Gate**: Not on `/score/*` routes (mid-match protection)
4. **Position**: Fixed bottom banner, above BottomNav (`bottom-16`)

### Dismiss Tiers (localStorage key: `pwa-install-dismiss`)

| Action | Cooldown | Storage |
|--------|----------|---------|
| Tap "Not now" | 7 days | `{ tier: 'soft', until: timestamp }` |
| Tap "Not now" again after cooldown | 30 days | `{ tier: 'hard', until: timestamp }` |
| Tap "Don't ask again" | Permanent | `{ tier: 'never' }` |

### CTA Placements (3 locations)

1. **Auto-prompt banner** — fixed bottom above BottomNav, shows when `showInstallBanner` is true
2. **LandingPage section-break** — below hero, above features grid (fixed-height container for GSAP safety)
3. **SettingsPage** — bottom of right column, `fieldset` pattern matching Cloud Sync section

### iOS/iPadOS Flow

**Detection** (feature-based, not UA sniffing):
```ts
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!CriOS|FxiOS|OPiOS|EdgiOS).)*Safari/.test(navigator.userAgent);
const iosInstallSupported = isIOS && isSafari;
```

**UI**: Bottom sheet modal (not inline text) with:
- Safari share icon + "Add to Home Screen" icon (static illustrations)
- Step-by-step numbered instructions
- "Got it" dismiss button
- Only shown in Safari (Chrome/Firefox iOS cannot install PWAs)

### Post-Install

- Listen for `appinstalled` event → set `isInstalled = true`, hide all CTAs
- After `prompt()` resolves → null the event reference, re-listen for fresh event
- Show brief success toast: "App installed successfully!"

### Accessibility

- Banner: `role="banner"`, `aria-label="Install app"`
- All dismiss/install buttons: min 44x44px tap targets
- iOS modal: focus trap, `role="dialog"`, `aria-modal="true"`
- Announce install success via `aria-live="polite"` region

---

## Section 3: App Update Toast

### Architecture

**Module-level store** at `src/shared/pwa/swUpdateStore.ts`:

```ts
import { registerSW } from 'virtual:pwa-register';
import { createSignal } from 'solid-js';

const [swWaiting, setSwWaiting] = createSignal(false);
let _updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

// Called once from App onMount
export function initSWUpdate() {
  if (_updateSW) return; // guard against double-registration
  _updateSW = registerSW({
    onNeedRefresh() { setSwWaiting(true); },
    onRegisterError(error) { console.error('SW registration failed', error); },
  });
  // Post-update acknowledgment
  const pending = localStorage.getItem('sw-updated-pending-ack');
  if (pending) {
    localStorage.removeItem('sw-updated-pending-ack');
    // trigger brief "App updated!" snackbar
  }
}

export function applyUpdate() {
  localStorage.setItem('sw-updated-pending-ack', '1');
  _updateSW?.(true); // skip-waiting + reload
}
```

**TypeScript prerequisite**: Add `"vite-plugin-pwa/client"` to `types` in `tsconfig.app.json`.

### Dismiss Logic (24-hour time gate)

```ts
const DISMISS_KEY = 'sw-update-dismissed-at';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export function dismissUpdate() {
  localStorage.setItem(DISMISS_KEY, Date.now().toString());
  setSwWaiting(false);
}

export const swUpdateVisible = () => {
  if (!swWaiting()) return false;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (!dismissedAt) return true;
  return Date.now() - Number(dismissedAt) > SNOOZE_MS;
};
```

### Toast Component

`src/shared/pwa/SWUpdateToast.tsx` — mounted in `App.tsx` (alongside AchievementToast):

- **Position**: Fixed bottom-right, dynamically adjusted:
  - `bottom-20 right-4` when install banner NOT visible
  - `bottom-36 right-4` when install banner IS visible
  - Both include `env(safe-area-inset-bottom)` offset
- **Content**: "A new version is available" + **"Update"** (primary button) + **"Remind me tomorrow"** (text link)
- **Animation**: CSS `opacity` + `translate-y` transitions with `motion-safe:` prefix (matches AchievementToast pattern)
- **z-index**: `z-40`
- **Static strings only** — no dynamic interpolation, no `innerHTML`

### Co-Presence Rule

When update toast is visible, install banner is suppressed:
```ts
// In installPromptStore.ts
export const installBannerVisible = () =>
  showInstallBanner() && !swUpdateVisible();
```

### Mid-Match Protection

Don't show on `/score/*` routes.

### Integration Point

`initSWUpdate()` called in `App.tsx` via `onMount` — guarantees reactive owner exists.

### Accessibility

- `role="status"`, `aria-live="polite"` wrapper
- "Update" and "Remind me tomorrow": min 44x44px tap targets
- `motion-safe:` transitions respect `prefers-reduced-motion`

---

## Section 4: Offline Tournament Caching

### Architecture

Extend Dexie database with 5 cache tables (version bump 4→5):

| Table | Schema | Purpose |
|-------|--------|---------|
| `cachedTournaments` | `id, status, organizerId, cachedAt` | Tournament metadata |
| `cachedTeams` | `id, tournamentId, cachedAt` | Team names/compositions |
| `cachedPools` | `id, tournamentId, cachedAt` | Pool configs + schedules + standings |
| `cachedBrackets` | `id, tournamentId, cachedAt` | Bracket slots + results |
| `cachedRegistrations` | `id, tournamentId, cachedAt` | Registrations (role-gated) |

### What "Active" Means

Cache when status is in: `['registration', 'pool-play', 'bracket', 'paused']`
Do NOT cache: `setup`, `completed`, `cancelled`

### Sync Strategy: Write-Through from `onSnapshot`

No separate `getDocs` calls. Tap existing `onSnapshot` callbacks in `useTournamentLive.ts`:

```
Mount → Read Dexie immediately (stale-while-revalidate)
     → If cache hit: set signals, set loading(false)
     → Subscribe to onSnapshot (existing code)
     → On each onSnapshot event: update signal AND write to Dexie (fire-and-forget)
```

Benefits:
- Eliminates duplicate Firestore reads and double billing
- No race conditions between parallel fetches
- Automatic cache refresh on every live update

### Offline Fallback

```
Online?                    → onSnapshot delivers data, writes through to Dexie
Offline (onLine=false)?    → Read from Dexie immediately (fast path)
Online but unreachable?    → onSnapshot errors → fall back to Dexie
No cache + Offline?        → Show "No cached data available" message
Serving stale cache?       → Show "Offline — last updated at X:XX" banner
```

`navigator.onLine` used as fast-fail only; also handle Firestore network errors as offline fallback.

### Registration PII Protection (Role-Gated Caching)

| Role | What gets cached |
|------|-----------------|
| **Organizer / Scorekeeper** | Full registration (including paymentStatus, paymentNote, declineReason) |
| **Participant / Viewer** | Scrubbed: id, tournamentId, userId, playerName, teamId, status only |

### Sign-Out Wipe (REQUIRED)

On sign-out, **before** calling `firebaseSignOut()`:
```ts
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
  }
);
```

### TTL-Based Pruning

- `cachedAt: number` (Unix ms) set on every write-through
- On app startup (`runStartupCleanup` pattern): prune records where `cachedAt > 90 days` ago
- On tournament completion: when `onSnapshot` delivers `status === 'completed' | 'cancelled'`, delete all related cache rows in a single Dexie transaction

### Cleanup Atomicity

All multi-table cleanup operations wrapped in `db.transaction('rw', ...)` to prevent orphaned records on partial failure.

### Data Size

Per tournament: ~50-200 KB. 5 active tournaments ~ 1 MB. Well within Safari 50MB quota.

### Integration Points

- `src/data/db.ts` — version 5 schema with 5 new tables
- `src/features/tournaments/hooks/useTournamentLive.ts` — hydrate-from-Dexie on mount + write-through in `onSnapshot` callbacks
- `src/shared/hooks/useAuth.ts` — sign-out wipe before `firebaseSignOut()`
- `src/data/syncProcessor.ts` — add startup cache pruning to `runStartupCleanup`

---

## Section 5: Font Self-Hosting, CSP Headers & Cleanup

### 5A: Self-Host Oswald Font

1. Download `Oswald-Bold.woff2` (weight 700 only) → `public/fonts/Oswald-Bold.woff2`
2. Remove 3 Google Fonts `<link>` tags from `index.html` (lines 20-22)
3. Add preload in `index.html`:
   ```html
   <link rel="preload" href="/fonts/Oswald-Bold.woff2" as="font" type="font/woff2" crossorigin />
   ```
4. Add `@font-face` in `src/styles.css`:
   ```css
   @font-face {
     font-family: 'Oswald';
     font-style: normal;
     font-weight: 700;
     font-display: swap;
     src: url('/fonts/Oswald-Bold.woff2') format('woff2');
   }
   ```
5. CSS variable `--font-score` and `renderScoreCard.ts` — unchanged
6. SW precaches font via existing `woff2` glob pattern

### 5B: Delete `public/vite.svg`

Zero live references. Removes dead precache entry (~1.5KB).

### 5C: CSP & Security Headers

Full CSP (single line in `firebase.json`):
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data: blob: https://*.googleusercontent.com;
connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com;
frame-src https://*.firebaseapp.com;
child-src https://*.firebaseapp.com https://accounts.google.com;
worker-src 'self';
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self'
```

Additional headers on all routes:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

### 5D: Cache-Control Headers

| Source Pattern | Cache-Control | Why |
|---------------|--------------|-----|
| `/assets/**` | `public, max-age=31536000, immutable` | Vite content-hashed, immutable |
| `/sw.js` | `no-cache, no-store, must-revalidate` | Must always check for new SW |
| `/workbox-*.js` | `no-cache, no-store, must-revalidate` | SW dependency chunk |
| `/registerSW.js` | `no-cache, no-store, must-revalidate` | SW registration trigger |
| `/manifest.webmanifest` | `no-cache, no-store, must-revalidate` + `Content-Type: application/manifest+json` | PWA metadata must stay fresh |

### 5E: Firebase Hosting Config (`firebase.json`)

Full `hosting` section added with:
- `"public": "dist"`
- `"rewrites": [{ "source": "**", "destination": "/index.html" }]`
- `"ignore": ["firebase.json", "**/.*", "**/node_modules/**"]`
- All headers from 5C and 5D above

**Deploy command**: Always use `firebase deploy --only hosting` (avoid accidental Firestore rules push).

### 5F: TypeScript Config

Add `"vite-plugin-pwa/client"` to `types` in `tsconfig.app.json`.

---

## Summary of All Changes

### New Files
- `src/shared/pwa/installPromptStore.ts` — install prompt signals
- `src/shared/pwa/swUpdateStore.ts` — SW update signals
- `src/shared/pwa/pwaLifecycle.ts` — `beforeinstallprompt` + `appinstalled` event listeners
- `src/shared/pwa/SWUpdateToast.tsx` — update toast component
- `src/shared/pwa/InstallPromptBanner.tsx` — install CTA component
- `src/shared/pwa/IOSInstallSheet.tsx` — iOS install instructions modal
- `public/fonts/Oswald-Bold.woff2` — self-hosted font

### Modified Files
- `vite.config.ts` — runtime caching rules, navigateFallback, denylist
- `index.html` — remove Google Fonts links, add font preload
- `src/styles.css` — add @font-face block
- `src/app/App.tsx` — mount SWUpdateToast, initSWUpdate in onMount
- `src/features/landing/LandingPage.tsx` — install CTA section
- `src/features/settings/SettingsPage.tsx` — install section
- `src/data/db.ts` — version 5 with 5 cache tables
- `src/features/tournaments/hooks/useTournamentLive.ts` — Dexie hydration + write-through
- `src/shared/hooks/useAuth.ts` — sign-out cache wipe
- `src/data/syncProcessor.ts` — startup cache pruning
- `firebase.json` — hosting section with CSP + cache headers
- `tsconfig.app.json` — add vite-plugin-pwa/client type

### Deleted Files
- `public/vite.svg`
