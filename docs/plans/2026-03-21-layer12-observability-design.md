# Layer 12: Observability & Maintenance — Design Document

**Date:** 2026-03-21
**Status:** Approved
**Specialist Reviews:** 12 rounds (4 initial approach + 3x Section 1 + 3x Section 2 + 3x Section 3 + 2x Section 4 + 2x final review)

## Overview

Enterprise-grade observability for PickleScore, a launched offline-first PWA + Android app. Covers error tracking, feature adoption analytics, performance monitoring, Cloud Functions observability, and operational maintenance procedures.

### Design Principles

- **Free tier first** — Sentry free (5K errors/mo), Firebase Analytics free, Web Vitals (browser API)
- **Zero critical-path impact** — all observability lazy-loaded (<0.8KB on critical path)
- **Privacy by design** — consent-based, PII scrubbing at 5 layers, GDPR-compliant
- **Offline-first compatible** — error buffering, offline transport, graceful degradation
- **Fail-safe** — observability failures never crash the app

### Tool Stack

| Concern | Tool | Bundle Impact |
|---------|------|---------------|
| Error tracking | Sentry (`@sentry/browser`) | ~25-28KB gzipped, async |
| Feature analytics | Firebase Analytics (GA4) | ~18-22KB gzipped, async |
| Performance | Web Vitals (raw PerformanceObserver) | 0KB |
| Structured logging | Custom logger (sink pattern) | <0.5KB |
| Cloud Functions | `firebase-functions/logger` | Already included |
| Alerting | Sentry email + Firebase Alerts | N/A |

---

## Section 1: Architecture & Module Structure

### Module Layout

```
src/shared/observability/
  logger.ts             <- structured logger, ZERO external deps (<0.5KB)
  sentry.ts             <- Sentry init + registers as logger sink
  analytics.ts          <- Firebase Analytics lazy wrapper + event catalog
  webVitals.ts          <- raw PerformanceObserver -> pipes to Sentry breadcrumbs
  ErrorBoundary.tsx     <- ObservableErrorBoundary (uses logger, NOT sentry directly)
  earlyErrors.ts        <- tiny error buffer for pre-Sentry errors (<0.3KB)
  __tests__/
```

**No barrel `index.ts`.** All imports are direct to ensure tree-shaking:

```ts
import { logger } from '~/shared/observability/logger';
import { trackEvent } from '~/shared/observability/analytics';
```

ESLint rule enforces direct imports:

```ts
'no-restricted-imports': ['error', {
  paths: [{ name: '~/shared/observability', message: 'Import from specific module' }]
}]
```

### Logger: Sink Registration Pattern

The logger has **zero static dependencies** on Sentry or any external service. Sentry registers itself as a sink after lazy-loading:

```ts
// logger.ts -- ~30 lines, <0.5KB, no imports
type Sink = (level: string, msg: string, data?: unknown) => void;
const sinks: Sink[] = [];
export function registerSink(sink: Sink) { sinks.push(sink); }

function emit(level: string, msg: string, data?: unknown) {
  try {
    console[level as 'log'](msg, data);
    sinks.forEach(s => { try { s(level, msg, data); } catch { /* never throw */ } });
  } catch {
    console.error('[logger-fallback]', msg, data);
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => emit('debug', msg, data),
  info: (msg: string, data?: unknown) => emit('info', msg, data),
  warn: (msg: string, data?: unknown) => emit('warn', msg, data),
  error: (msg: string, data?: unknown) => emit('error', msg, data),
};
```

### Early Error Buffer

Captures errors before Sentry loads (or if it never loads):

```ts
// earlyErrors.ts -- <0.3KB, inlined in main bundle
const MAX_BUFFER = 20;
const earlyErrors: { error: unknown; timestamp: number }[] = [];

// Start capturing immediately
window.addEventListener('error', (e) => {
  if (earlyErrors.length < MAX_BUFFER) {
    earlyErrors.push({ error: e.error, timestamp: Date.now() });
  }
});
window.addEventListener('unhandledrejection', (e) => {
  if (earlyErrors.length < MAX_BUFFER) {
    earlyErrors.push({ error: e.reason, timestamp: Date.now() });
  }
});

export function flushEarlyErrors(captureException: (err: unknown) => void) {
  earlyErrors.forEach(({ error }) => captureException(error));
  earlyErrors.length = 0;
}

export function getEarlyErrorCount() { return earlyErrors.length; }
```

If Sentry loads: `flushEarlyErrors(Sentry.captureException)` replays buffered errors.
If Sentry never loads (no consent, blocked): errors stay in console only, buffer is GC'd with the page.

**Hard invariants:**

- Logger methods **never throw** -- every path has try/catch with console fallback
- Logger **never writes to a SolidJS signal** -- safe to call inside effects
- Console output is **never removed** -- Sentry is additive, not a replacement
- Before Sentry loads, logs go to console only (nothing is lost)

### Initialization Order

```
1. earlyErrors.ts buffer starts (inline, <0.3KB)     <- catches errors before consent/Sentry
2. initPWAListeners()                                  <- existing, unchanged
3. render(<RootErrorBoundary><AppRouter /></RootErrorBoundary>)
4. requestIdleCallback -> IF consent accepted: dynamic import('sentry.ts')
   <- loads Sentry, registers sink, flushes early errors
   <- if consent pending/declined: skip (errors stay in console only)
5. requestIdleCallback -> initWebVitals()
6. Firebase Analytics -> lazy on first trackEvent()     <- also gated on consent
```

**Consent gating:** Both Sentry (step 4) and Analytics (step 6) check `analyticsConsent === 'accepted'` before initializing. If consent is pending or declined, observability runs in console-only mode. If consent is granted later (via Settings), Sentry initializes on next app load.

**Early error buffer behavior:** If Sentry never loads (no consent, ad blocker, offline), buffered errors remain in memory for the session and are visible in console. They are never persisted or sent anywhere. Buffer is capped at 20 entries to prevent memory growth.

Sentry is fully async. If Sentry fails to load, the app works fine -- logs go to console.

`requestIdleCallback` polyfill for Safari:

```ts
const scheduleIdle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
```

### ErrorBoundary Placement (3 Tiers)

| Tier | Location | Catches | Fallback |
|------|----------|---------|----------|
| **Root** | `index.tsx`, wraps `<AppRouter />` | Router init, App shell crashes | Minimal static HTML, no design system |
| **Route** | `App.tsx`, wraps `props.children` **outside Suspense** | Per-route render/effect errors | Error card inside intact shell (BottomNav stays) |
| **Critical** | `ScoringPage` wrapper | Crash during live scoring | Reads match from URL params + Dexie directly (not parent signals), shows last known scores |

**What ErrorBoundary does NOT catch:** Async errors in `.catch()` handlers, promise rejections, XState callbacks. These need explicit `logger.error()` calls.

ErrorBoundary.tsx calls `logger.error()`, never imports `sentry.ts` directly.

### Vite Build Config

Function form to catch all sub-packages:

```ts
manualChunks(id) {
  if (id.includes('@sentry/')) return 'sentry';
  if (id.includes('firebase/analytics') || id.includes('@firebase/analytics'))
    return 'firebase-analytics';
}
```

Verify with `vite-bundle-visualizer` after implementation.

### Console Migration: Phased, Not Atomic

~77 `console.warn/error` calls across ~34 files, migrated in 4 phases:

| Phase | Scope | Files | Risk |
|-------|-------|-------|------|
| 1 | Low-risk utilities (settings, theme, wake lock) | ~5 | Logger gets battle-tested |
| 2 | Data layer (sync processor, cloudSync, repos) | ~6 | Sync error routing validated |
| 3 | Tournament features (densest error cluster) | ~11 | High-volume area covered |
| 4 | Scoring (critical path) | ~3 | Last, after logger is proven |

### Scope Boundaries

| In scope (client-side) | Out of scope |
|------------------------|-------------|
| Logger, Sentry, Analytics, WebVitals | Cloud Functions observability (Section 4) |
| ErrorBoundary components | Service worker internal errors (separate context) |
| SW registration error reporting | User-facing error toasts |

### Bundle Budget

| Component | Size (gzipped) | Load Strategy | Critical Path |
|-----------|---------------|---------------|---------------|
| Logger + early error buffer | <0.8 KB | Bundled | <0.8 KB |
| Sentry (error-only + offline transport) | ~25-28 KB | requestIdleCallback + dynamic import | 0 KB |
| Firebase Analytics | ~18-22 KB | Dynamic import on first event | 0 KB |
| Web Vitals (PerformanceObserver) | 0 KB | After idle | 0 KB |
| **Total critical path** | | | **<0.8 KB** |
| **Total async** | | | **~45 KB** |

---

## Section 2: Error Tracking & Sentry

### Sentry Configuration

**SDK:** `@sentry/browser` (NOT `@sentry/react` -- no SolidJS SDK exists). Error-only -- no BrowserTracing, Replay, or Profiling.

```ts
// sentry.ts -- consent-gated initialization
import { getSettings } from '../../stores/settingsStore';
import { registerSink } from './logger';
import { flushEarlyErrors } from './earlyErrors';

export async function initSentry() {
  // Consent gate -- do not initialize without explicit acceptance
  if (getSettings().analyticsConsent !== 'accepted') return;

  const Sentry = await import('@sentry/browser');

  Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
  transport: makeBrowserOfflineTransport(makeFetchTransport),
  sendDefaultPii: false,
  maxBreadcrumbs: 30,
  sampleRate: 1.0,            // Full capture at launch. Revisit at >500 MAU.
  autoSessionTracking: true,   // Crash-free session rate (separate from error quota)
  beforeSend: scrubAndRateLimit,
  beforeBreadcrumb: filterBreadcrumb,
  });

  // Register Sentry as a logger sink (Section 1 pattern)
  // ... sink registration code below ...

  // Flush pre-Sentry errors
  flushEarlyErrors((err) => Sentry.captureException(err));
}
```

**Offline Transport:** `makeBrowserOfflineTransport` queues events in IndexedDB when offline, replays when online. **Capped at 50 events** to prevent quota blowout after long offline sessions. Verify offline queue uses a separate IndexedDB store from Dexie.js.

### Sink Registration

```ts
registerSink((level, msg, data) => {
  const sentryLevel = level === 'warn' ? 'warning' : level;

  Sentry.addBreadcrumb({
    message: sanitizeMessage(msg),
    level: sentryLevel as Sentry.SeverityLevel,
    data: typeof data === 'object' && !(data instanceof Error) ? data : undefined,
  });

  if (level === 'error') {
    // Handle both Error objects AND non-Error thrown values (common in SolidJS)
    const exception = data instanceof Error
      ? data
      : new Error(typeof data === 'string' ? data : msg);
    Sentry.captureException(exception, { extra: { message: msg } });
  }
});
```

### PII Scrubbing (5 Layers)

**Layer 1 -- `beforeBreadcrumb`** (filters before storage):

- Keep `ui.click` but strip `textContent` and `target.innerText` (preserves debugging, removes player names)
- Drop `xhr` breadcrumbs containing `firestore` in URL (document paths with UIDs)
- Drop `console` breadcrumbs (logger sink handles these -- prevents duplication)

**Layer 2 -- `beforeSend`** (scrubs event before transmission):

- Strip `user.ip_address`, `user.email`
- Walk `event.extra` and `event.contexts` for sensitive field names (`email`, `displayName`, `playerName`, `teamName`)
- Scrub Firestore document paths: `users/abc123/...` -> `users/[redacted]/...`
- Strip Firebase auth tokens from breadcrumbs (bearer tokens in fetch breadcrumbs)

**Layer 3 -- `sanitizeMessage()`** (in sink):

- Strip email patterns: `[\w.+-]+@[\w-]+\.[\w.]+` -> `[email]`

**Layer 4 -- Sync queue context scrubbing** (before sending retry history):

- Strip `sharedWith` array (other users' UIDs) -> replace with `sharedWithCount`
- Truncate `entityId` to first 8 chars
- Scrub `lastError` for Firestore document paths

**Layer 5 -- Sentry project settings** (server-side):

- Enable "Require Scrub IP Addresses"
- Enable "Require Scrub Data"
- Configure Sensitive Data Scrubbing rules (emails, tokens, key-value pairs)
- Set data retention to 90 days

### User Context

Set imperatively in `useAuth.ts` auth state change callback:

- Sign-in: `Sentry.setUser({ id: user.uid })` -- UID only, no email/name
- Sign-out: `Sentry.flush(2000)` (clears offline queue) -> then `Sentry.setUser(null)`

### Custom Breadcrumbs

| Category | Events | Data (no PII) |
|----------|--------|---------------|
| `game` | score_update, side_out, game_over, undo | serving_team, scores (numbers), game_format |
| `sync` | sync_attempt, sync_success, sync_failure | queue_depth, operation, result, retry_count |
| `xstate` | state transitions via XState v5 `inspect` API | event type (SCORE_POINT), game number |

XState integration via `createActor(machine, { inspect })` -- callback calls `logger.debug()` only, never writes to SolidJS signals.

### Connectivity Context Tags

All Sentry events tagged:

```ts
Sentry.setTag('connectivity', navigator.onLine ? 'online' : 'offline');
Sentry.setTag('connection_type', navigator.connection?.effectiveType ?? 'unknown');
```

### Client-Side Rate Limiting

**Per-device** via localStorage (not per-session):

- Max **200 errors/day**, resets at midnight
- **Fatal errors bypass** the rate limit
- Dropped events logged to console with `[Sentry rate-limited]` prefix

### Sync Queue -> Sentry Routing

| Error Type | Local Action | Sentry Escalation |
|-----------|-------------|-------------------|
| retryable | Exponential backoff | After **5 consecutive failures within 2 min** -> `captureException` with retry history |
| rate-limited | 60s base backoff | After 5 min continuous -> `captureException` |
| auth-dependent | Silent re-auth | If re-auth fails -> `captureException` |
| fatal | Show SyncErrorBanner | **Immediately** -> `captureException` with scrubbed queue context |
| staleJob | Clean up | Only if **age > 10 min** -> `captureMessage` (warning) |

### Alerting Strategy (30-Day Ramp)

**Days 1-14 (Learning Mode):**

| Alert | Config | Delivery |
|-------|--------|----------|
| New issue spike | >20 events of same issue in 1 hour | Email |
| Absolute error rate | >50 total errors in 1 hour | Email |
| Fatal during game | Any `error_type: fatal` + `game_active: true` | Email (immediate) |
| Unhandled exceptions | Daily digest | Email (daily) |
| Quota warning | 80% (4K events) | Email |

**Days 15-30 (Tuning Mode):**

- Switch to percentage-based alerts (>5x baseline) once baseline established
- Promote recurring unhandled exceptions to monitored issues
- Enable regression detection for resolved issues

**Inbound filters (Day 1):** `ResizeObserver loop`, `Non-Error promise rejection`, browser extension errors.

### Sentry Self-Monitoring

| Check | Implementation |
|-------|---------------|
| Startup verification | After init, verify `Sentry.getClient()` exists |
| Weekly canary | `captureMessage('canary: health check', { level: 'debug' })` once/week per device |
| CSP compatibility | `connect-src` must include `*.ingest.sentry.io` |

### Crash-Free Session Target

**99% crash-free sessions** (measured weekly via `autoSessionTracking`).

| Rate | Action |
|------|--------|
| >99% | Ship features, fix bugs opportunistically |
| 95-99% | Prioritize bug fixes over features |
| <95% | Stop all feature work, fix stability |

### Source Maps

- Uploaded via `@sentry/vite-plugin` in CI only
- NOT served from production web server
- Auth token: **project-scoped** (not org-scoped), in GitHub Actions secrets
- Retention: 90 days (matches error data retention)

---

## Section 3: Analytics & Feature Adoption

### Consent Model

**Default: opted OUT.** Neither Sentry nor Analytics initializes until explicit consent.

First-launch consent dialog:

```
Help improve PickleScore by sharing de-identified usage data
and crash reports. This data is linked to a random identifier,
not your name or email.

[Accept]  [Decline]

You can change this anytime in Settings.
```

- Both buttons equally prominent (no dark patterns)
- Choice stored with timestamp: `analyticsConsent: 'pending' | 'accepted' | 'declined'`
- Settings toggle to change consent at any time
- On opt-out (consent revocation):
  - `setAnalyticsCollectionEnabled(false)` -- stops analytics collection
  - `deleteInstallations()` -- removes Firebase Installation ID
  - **Drop** Sentry offline queue (do NOT flush -- flushing sends events, which violates revoked consent)
  - `Sentry.close()` -- stops error reporting
  - Clear localStorage keys: `sentry_daily_count`, `sentry_last_canary`

### Firebase Analytics Initialization

```ts
let analyticsInstance: Analytics | null = null;
let logEventFn: ((instance: Analytics, name: string, params?: Record<string, any>) => void) | null = null;

export async function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  // Gate 1: consent check (before any module loading)
  if (getSettings().analyticsConsent !== 'accepted') return;

  // Gate 2: environment check (no dev/test pollution)
  if (!import.meta.env.PROD) {
    console.debug('[Analytics:dev]', name, params);
    return;
  }

  // Sync fast path -- no promise allocation after init
  if (logEventFn && analyticsInstance) {
    logEventFn(analyticsInstance, name, params);
    return;
  }

  // Cold path: lazy-load (runs at most once)
  try {
    const mod = await import('firebase/analytics');
    if (await mod.isSupported()) {
      analyticsInstance = mod.getAnalytics();
      logEventFn = mod.logEvent;
      logEventFn(analyticsInstance, name, params);
    }
  } catch {
    return; // blocked by extension or CSP
  }
}
```

**Chunk preloading** (during idle, after app loads):

```ts
requestIdleCallback(() => {
  import('firebase/analytics').catch(() => {});
}, { timeout: 5000 });
```

Prevents 140-330ms parse/eval jank if first event fires mid-gameplay.

### GA4 Configuration

| Setting | Value | Why |
|---------|-------|-----|
| Google Signals | **DISABLED** | Prevents cross-device ad profile linking |
| Data retention | **2 months** | Minimum GDPR-friendly setting |
| `setUserId()` | **NEVER called** | Keeps analytics fully anonymous |
| IP anonymization | Default since 2023 | No action needed |
| `app_version` user property | Set on init | Enables version-specific filtering |

### Event Catalog

**All params are TypeScript-enforced enums or numeric values. No free-text parameters permitted.**

**Match Lifecycle:**

| Event | Params | Purpose |
|-------|--------|---------|
| `match_started` | format, scoring_type, game_to | Format popularity |
| `match_completed` | format, duration_seconds (bucketed 30s), total_games | Completion rate |
| `match_abandoned` | format, duration_seconds, trigger (enum: `user_initiated` / `stale_cleanup`) | Drop-off (explicit user action only) |
| `match_settings_chosen` | scoring_mode, match_format, game_type | Config popularity |

**Tournament Lifecycle:**

| Event | Params | Purpose |
|-------|--------|---------|
| `tournament_created` | format, player_count | Tournament adoption |
| `tournament_completed` | format, duration_minutes (bucketed 5min), match_count | Completion rate |

**Feature Adoption (via `feature_used`, deduplicated once per feature per session):**

| feature_name | context | Measures |
|-------------|---------|----------|
| `leaderboard_viewed` | scope (global/friends) | Leaderboard engagement |
| `achievements_viewed` | badge_count | Trophy case engagement |
| `buddy_added` | source (search/qr) | Social adoption |
| `voice_announcements` | enabled/disabled | Voice usage |
| `theme_changed` | theme_name | Theme preference |
| `spectator_view` | -- | Spectator discovery |
| `match_shared` | method (link/qr) | Sharing adoption |
| `notification_opened` | type (enum) | Notification engagement |
| `profile_viewed` | own/other | Profile usage |

Session-level deduplication:

```ts
const trackedThisSession = new Set<string>();
export function trackFeatureUsed(name: string, context?: string) {
  if (trackedThisSession.has(name)) return;
  trackedThisSession.add(name);
  trackEvent('feature_used', { feature_name: name, ...(context && { context }) });
}
```

**Operational Events:**

| Event | Params | Purpose |
|-------|--------|---------|
| `sync_completed` | queue_depth | Sync health baseline |
| `sync_failed` | error_category, retry_count | Sync failure visibility |
| `pwa_install_prompt_shown` | -- | Install funnel top |
| `pwa_install_accepted` | -- | Install funnel conversion |

**Never include in any event:** Player names, email addresses, user IDs, opponent names, specific scores, match IDs, tournament names, free-text strings.

### Web Vitals -> Sentry Breadcrumbs (Not GA4)

Web Vitals are infrastructure telemetry, not engagement data. Piping to GA4 wastes event budget and pollutes the dashboard.

```ts
export function initWebVitals() {
  if (!('PerformanceObserver' in window)) return;

  // LCP
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lcp = entries[entries.length - 1];
    logger.info('web_vital:LCP', { value: Math.round(lcp.startTime) });
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // CLS -- accumulate, report on page hide
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput) clsValue += (entry as any).value;
    }
  }).observe({ type: 'layout-shift', buffered: true });

  // INP -- buffer worst value, report on page hide (NOT per-interaction)
  let worstInp = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      worstInp = Math.max(worstInp, entry.duration);
    }
  }).observe({ type: 'event', buffered: true });

  // Report on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (clsValue > 0) logger.info('web_vital:CLS', { value: Math.round(clsValue * 1000) });
      if (worstInp > 0) logger.info('web_vital:INP', { value: Math.round(worstInp) });
    }
  });
}
```

### GA4 Reporting Strategy (3 Bookmarked Reports)

1. **Weekly Feature Adoption**: `feature_used` grouped by `feature_name`, week-over-week trend
2. **Match Funnel**: `match_started` -> `match_completed` conversion rate
3. **Retention Cohort**: Built-in GA4 retention report

Calendar reminder: check weekly for first month, biweekly after.

---

## Section 4: Cloud Functions Observability, Maintenance & Compliance

### Cloud Functions Observability

**Logger migration:** Replace `console.warn/error` in `processMatchCompletion.ts` with `firebase-functions/logger`:

```ts
import { logger } from 'firebase-functions';

logger.error('Failed to update participant stats', { matchId, userId: uid, error: err.message });
logger.warn('Spectator projection write failed', { matchId, error: err.message });
```

Rules:

- `userId` field in warning/error logs only, NOT routine success logs
- Consistent field name `userId` across all entries (enables deletion queries)

**Execution timing + sub-operation outcomes:**

```ts
let isColdStart = true;

export const processMatchCompletion = onCall(async (request) => {
  const wasColdStart = isColdStart;
  isColdStart = false;
  const startTime = Date.now();

  // ... function body ...

  logger.info('Match processed', {
    matchId,
    executionTimeMs: Date.now() - startTime,
    coldStart: wasColdStart,
    playerCount: participants.length,
    statsWritten: true,
    leaderboardUpdated: leaderboardResult.success,
    spectatorProjectionWritten: projectionResult.success,
  });
});
```

**GCP Cloud Monitoring alerts:**

| Metric | Alert Threshold |
|--------|----------------|
| Error rate | >5% over 15 min |
| Warm invocation p95 | >3s |
| Cold start p95 | >8s |
| Invocation anomaly | >10x hourly baseline over 15 min |
| Memory usage | >80% allocation |

### Deploy Manifest

Static JSON at `/deploy.json`, updated during CI:

```json
{
  "version": "1.0.0",
  "commit": "a1b2c3d",
  "deployed": "2026-03-21T14:30:00Z"
}
```

### CI Post-Deploy Smoke Checks

| Check | What it catches |
|-------|----------------|
| curl deploy manifest, assert commit SHA matches `$GITHUB_SHA` | Partial deploys, caching |
| Check Cloud Function state via `gcloud` | Deployment failures |
| Verify no `sourceMappingURL=*.map` in served JS bundles | Source map exposure |

### Maintenance Procedures

**Weekly review (15 min, Sunday evening):**

| Step | Timebox |
|------|---------|
| Sentry triage (label P1/P2, do NOT investigate) | 5 min |
| GA4 reports (3 bookmarked reports) | 5 min |
| Cloud Functions metrics | 3 min |
| Sentry quota check | 2 min |

**When unavailable >3 days:** P2 alerts auto-acknowledged. P1 alerts checked via daily email.

**Dependency updates:** Sentry quarterly, Firebase as needed. No Dependabot.

**Cloud Logging retention:** 30 days (GCP default). Documented limitation.

### Rollback Runbook

**Web (Firebase Hosting):**

1. Firebase Console -> Hosting -> Release history -> "Rollback"
2. Verify: curl deploy manifest, confirm commit SHA
3. Alternative: `firebase hosting:clone <site>:<version> <site>:live`

**Cloud Functions:**

1. `git checkout <last-good-commit>`
2. `firebase deploy --only functions`
3. `git checkout main`

**Android (Play Store):**

1. Play Console -> "Halt rollout" immediately
2. Fast-track a fix release (no rollback in Play Store)

**When to rollback:**

- Function error rate >20% sustained 5+ min
- Sentry >10 new errors in first 10 min post-deploy
- Deploy manifest shows wrong version
- Users reporting data loss

### Data Deletion Runbook

| System | Data | Method |
|--------|------|--------|
| Firestore | User doc, stats, matches, leaderboard, public tier, all subcollections | Existing in-app account deletion (verify coverage) |
| Firebase Auth | Auth record | `admin.auth().deleteUser(uid)` |
| Firebase Installations | Installation ID | `deleteInstallations()` (client-side, called during opt-out and account deletion) |
| Sentry | Events tagged with UID | API: `DELETE /api/0/projects/{org}/{project}/users/{user_id}/` |
| Sentry offline queue | Queued error events in IndexedDB | Drop queue on consent revocation (do NOT flush). Clear Sentry IndexedDB store. |
| GA4 | User data | Admin -> Request user deletion (minimal data since no `setUserId`) |
| Cloud Logging | Log entries containing UID | Cannot selectively delete. 30-day retention expiry. Documented in privacy policy: "operational logs containing your identifier are automatically deleted within 30 days." |
| localStorage | `sentry_daily_count`, `sentry_last_canary` | Clear on account deletion |

### Compliance Checklist (29 Items, 5 Phases)

**Phase 1 -- Accounts & Legal (blocks everything):**

1. Create Sentry account + project
2. Sign Sentry DPA (sentry.io/legal/dpa/)
3. Enable 2FA on Sentry
4. Set Sentry data retention to 90 days
5. Enable server-side IP scrubbing
6. Configure Sentry Sensitive Data Scrubbing rules
7. Enable Sentry spike protection
8. Set GA4 data retention to 2 months
9. Disable Google Signals in GA4
10. Verify GA4 IP anonymization

**Phase 2 -- CI Secrets (blocks code integration):**

11. Create project-scoped Sentry auth token
12. Add `SENTRY_AUTH_TOKEN` + `VITE_SENTRY_DSN` to GitHub Actions secrets

**Phase 3 -- Code (ordered by dependency):**

13. Add consent dialog component (Accept/Decline, use "de-identified" not "anonymous", mention both usage data and crash reports)
14. Wire consent to Sentry + Analytics initialization (both gated on `analyticsConsent === 'accepted'`)
15. Verify consent persists across app restarts (stored in localStorage/Dexie, not memory)
16. Add analytics opt-out toggle in Settings (revocation drops Sentry queue, does NOT flush)
17. Strip Firebase auth tokens from Sentry breadcrumbs in `beforeSend`
18. Update PrivacyPolicy.tsx (Sentry, Analytics, Cloud Logging, Cookies & Local Storage, 30-day log retention disclosure)
19. Bump "Last updated" date on privacy policy
20. Add CSP `connect-src`: `*.ingest.sentry.io`, `*.google-analytics.com`, `*.analytics.google.com`, `firebaseinstallations.googleapis.com`
21. Ensure source maps NOT served in production
22. Add CI smoke checks (deploy manifest, function state, source map leak)

**Phase 4 -- Play Store (after code ships):**

23. Update Data Safety form: crash logs, diagnostics, app interactions, app-instance IDs (not device IDs)
24. Mark analytics collection as "optional"
25. Verify data deletion link in Data Safety
26. Submit updated Data Safety before next app update

**Phase 5 -- Ongoing:**

27. Document data deletion runbook
28. Enable Firestore daily backups (7-day retention) -- follow-up
29. Set annual privacy review reminder (DPA, GA4, retention, Data Safety accuracy)
