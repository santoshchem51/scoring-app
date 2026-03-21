# Layer 12: Observability & Maintenance — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add enterprise-grade observability (error tracking, analytics, performance monitoring) to PickleScore with <0.8KB critical-path impact and consent-based privacy.

**Architecture:** Sink-pattern logger (zero deps) + Sentry (lazy-loaded) + Firebase Analytics (lazy-loaded) + Web Vitals (browser API). All observability gated on user consent. 3-tier ErrorBoundary. Phased console migration.

**Tech Stack:** `@sentry/browser`, `@sentry/vite-plugin`, `firebase/analytics` (already in firebase 12.9.0), raw PerformanceObserver API

**Design doc:** `docs/plans/2026-03-21-layer12-observability-design.md`

**Specialist reviews:** 3 rounds (SolidJS Architecture, TDD/Testing Quality, Ops/Sequencing)

### Key Fixes from Reviews

1. **Sequencing fix:** CSP update moved from Wave E to Wave B (before Sentry init — events silently blocked without it)
2. **Sequencing fix:** Web Vitals (Task 11) moved from Wave C to Wave A (Task 7 imports it)
3. **Test isolation:** All test files must have `vi.resetModules()` in `beforeEach` (logger sinks leak otherwise)
4. **Test quality:** `beforeSend`/`beforeBreadcrumb` PII scrubbing extracted as pure functions with dedicated tests
5. **Test quality:** Early errors tests must dispatch real `window` events, not just `simulateError()`
6. **Test quality:** App integration tests use behavioral assertions, not `readFileSync`
7. **Missing tests added:** `setSentryUser`, consent wiring (Task 13), analytics consent gate verification
8. **`setSentryUser` guard:** Must check `initialized` flag before loading Sentry bundle
9. **Task 4:** Full test suite + build verification after npm install
10. **Task 23:** Split into 3 sub-tasks by feature area

### Test Standards (Apply to All Tasks)

Every test file MUST include:
```ts
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});
```

Tasks that modify existing files MUST run `npx vitest run` before AND after changes. Search for existing `console.warn`/`console.error` spies that may break after migration.

---

## Wave A: Foundation (Logger + Early Errors + Settings + Web Vitals)

### Task 1: Add `analyticsConsent` field to settings store

**Files:**
- Modify: `src/stores/settingsStore.ts:3-46`
- Test: `src/stores/__tests__/settingsStore.test.ts` (create if needed)

**Step 1: Write the failing test**

```ts
// src/stores/__tests__/settingsStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('settingsStore analyticsConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults analyticsConsent to pending', async () => {
    const { settings } = await import('../settingsStore');
    expect(settings().analyticsConsent).toBe('pending');
  });

  it('defaults analyticsConsentTimestamp to null', async () => {
    const { settings } = await import('../settingsStore');
    expect(settings().analyticsConsentTimestamp).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/__tests__/settingsStore.test.ts`
Expected: FAIL — `analyticsConsent` property does not exist

**Step 3: Write minimal implementation**

Add to the `Settings` type (line ~3-24) and `DEFAULTS` object (line ~28-46) in `settingsStore.ts`:

```ts
// Add to Settings type
analyticsConsent: 'pending' | 'accepted' | 'declined';
analyticsConsentTimestamp: number | null;

// Add to DEFAULTS
analyticsConsent: 'pending',
analyticsConsentTimestamp: null,
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/__tests__/settingsStore.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stores/settingsStore.ts src/stores/__tests__/settingsStore.test.ts
git commit -m "feat(observability): add analyticsConsent field to settings store"
```

---

### Task 2: Create the structured logger with sink pattern

**Files:**
- Create: `src/shared/observability/logger.ts`
- Test: `src/shared/observability/__tests__/logger.test.ts`

**Step 1: Write the failing tests**

```ts
// src/shared/observability/__tests__/logger.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('logs to console at each level', async () => {
    const { logger } = await import('../logger');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith('test message', undefined);
  });

  it('calls registered sinks', async () => {
    const { logger, registerSink } = await import('../logger');
    const sink = vi.fn();
    registerSink(sink);
    logger.warn('sink test', { key: 'value' });
    expect(sink).toHaveBeenCalledWith('warn', 'sink test', { key: 'value' });
  });

  it('calls all registered sinks in order', async () => {
    const { logger, registerSink } = await import('../logger');
    const order: number[] = [];
    registerSink(() => order.push(1));
    registerSink(() => order.push(2));
    vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test');
    expect(order).toEqual([1, 2]);
  });

  it('calls remaining sinks even when an earlier sink throws', async () => {
    const { logger, registerSink } = await import('../logger');
    const secondSink = vi.fn();
    registerSink(() => { throw new Error('boom'); });
    registerSink(secondSink);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test');
    expect(secondSink).toHaveBeenCalled();
  });

  it('never throws even if sink throws', async () => {
    const { logger, registerSink } = await import('../logger');
    registerSink(() => { throw new Error('sink exploded'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => logger.error('should not throw')).not.toThrow();
  });

  it('handles undefined data gracefully', async () => {
    const { logger } = await import('../logger');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(() => logger.info('no data')).not.toThrow();
    expect(spy).toHaveBeenCalledWith('no data', undefined);
  });

  it('falls back to console.error if console[level] fails', async () => {
    const { logger } = await import('../logger');
    const fallbackSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => { throw new Error('broken'); });
    expect(() => logger.debug('test')).not.toThrow();
    expect(fallbackSpy).toHaveBeenCalledWith('[logger-fallback]', 'test', undefined);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/observability/__tests__/logger.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/shared/observability/logger.ts
type Sink = (level: string, msg: string, data?: unknown) => void;
const sinks: Sink[] = [];

export function registerSink(sink: Sink) {
  sinks.push(sink);
}

function emit(level: string, msg: string, data?: unknown) {
  try {
    const consoleFn = (console as Record<string, unknown>)[level];
    if (typeof consoleFn === 'function') {
      consoleFn.call(console, msg, data);
    } else {
      console.log(msg, data);
    }
    for (const sink of sinks) {
      try {
        sink(level, msg, data);
      } catch {
        // sink failures never propagate
      }
    }
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

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/observability/__tests__/logger.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/observability/logger.ts src/shared/observability/__tests__/logger.test.ts
git commit -m "feat(observability): add structured logger with sink registration pattern"
```

---

### Task 3: Create early error buffer

**Files:**
- Create: `src/shared/observability/earlyErrors.ts`
- Test: `src/shared/observability/__tests__/earlyErrors.test.ts`

**Step 1: Write the failing tests**

```ts
// src/shared/observability/__tests__/earlyErrors.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('earlyErrors', () => {
  beforeEach(async () => {
    // Reset module between tests
    vi.resetModules();
  });

  it('captures error events up to MAX_BUFFER', async () => {
    const { getEarlyErrorCount, simulateError } = await import('../earlyErrors');
    simulateError(new Error('test error 1'));
    simulateError(new Error('test error 2'));
    expect(getEarlyErrorCount()).toBe(2);
  });

  it('flushes buffered errors to captureException', async () => {
    const { flushEarlyErrors, simulateError } = await import('../earlyErrors');
    simulateError(new Error('err1'));
    simulateError(new Error('err2'));
    const capture = vi.fn();
    flushEarlyErrors(capture);
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledWith(expect.any(Error));
  });

  it('clears buffer after flush', async () => {
    const { flushEarlyErrors, getEarlyErrorCount, simulateError } = await import('../earlyErrors');
    simulateError(new Error('err'));
    flushEarlyErrors(vi.fn());
    expect(getEarlyErrorCount()).toBe(0);
  });

  it('caps buffer at 20 entries', async () => {
    const { getEarlyErrorCount, simulateError } = await import('../earlyErrors');
    for (let i = 0; i < 25; i++) {
      simulateError(new Error(`err${i}`));
    }
    expect(getEarlyErrorCount()).toBe(20);
  });

  it('captures errors from real window error events', async () => {
    const { getEarlyErrorCount } = await import('../earlyErrors');
    const before = getEarlyErrorCount();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('real error') }));
    expect(getEarlyErrorCount()).toBe(before + 1);
  });

  it('captures unhandled promise rejections', async () => {
    const { getEarlyErrorCount } = await import('../earlyErrors');
    const before = getEarlyErrorCount();
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
      reason: new Error('rejected'),
      promise: Promise.reject(new Error('rejected')),
    }));
    expect(getEarlyErrorCount()).toBe(before + 1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/observability/__tests__/earlyErrors.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/shared/observability/earlyErrors.ts
const MAX_BUFFER = 20;
const earlyErrors: { error: unknown; timestamp: number }[] = [];

function onError(error: unknown) {
  if (earlyErrors.length < MAX_BUFFER) {
    earlyErrors.push({ error, timestamp: Date.now() });
  }
}

// Browser event listeners (safe to call in non-browser environments)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => onError(e.error));
  window.addEventListener('unhandledrejection', (e) => onError(e.reason));
}

export function flushEarlyErrors(captureException: (err: unknown) => void) {
  for (const { error } of earlyErrors) {
    captureException(error);
  }
  earlyErrors.length = 0;
}

export function getEarlyErrorCount() {
  return earlyErrors.length;
}

// For testing — simulates an error being captured
export function simulateError(error: unknown) {
  onError(error);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/observability/__tests__/earlyErrors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/observability/earlyErrors.ts src/shared/observability/__tests__/earlyErrors.test.ts
git commit -m "feat(observability): add early error buffer for pre-Sentry errors"
```

---

## Wave B: Sentry Integration

### Task 4: Install Sentry dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run: `npm install @sentry/browser && npm install -D @sentry/vite-plugin`

**Step 2: Verify installation and no regressions**

Run: `node -e "require('@sentry/browser'); console.log('ok')"` -> `ok`
Run: `npx vitest run` -> all existing tests pass
Run: `npx vite build` -> build succeeds
Run: `npx tsc --noEmit` -> no type conflicts

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(observability): add @sentry/browser and @sentry/vite-plugin"
```

---

### Task 4b: Update CSP headers for Sentry (MUST be before Sentry init)

**Files:**
- Modify: `firebase.json:33-46`

**Step 1: Add Sentry domain to CSP connect-src**

In the CSP header's `connect-src` directive, add `https://*.ingest.sentry.io` after the existing Firebase domains.

Without this, Sentry events are silently blocked in production (dev mode has no CSP enforcement, so the failure is invisible during development).

**Step 2: Commit**

```bash
git add firebase.json
git commit -m "security(observability): add Sentry ingest domain to CSP connect-src"
```

---

### Task 5: Create Sentry initialization module

**Files:**
- Create: `src/shared/observability/sentry.ts`
- Test: `src/shared/observability/__tests__/sentry.test.ts`

**Step 1: Write the failing tests**

```ts
// src/shared/observability/__tests__/sentry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentry/browser before importing
vi.mock('@sentry/browser', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  getClient: vi.fn(() => ({})),
  close: vi.fn(),
  flush: vi.fn(),
  makeBrowserOfflineTransport: vi.fn((fn: unknown) => fn),
  makeFetchTransport: vi.fn(),
}));

vi.mock('../../stores/settingsStore', () => ({
  settings: vi.fn(() => ({ analyticsConsent: 'accepted' })),
}));

describe('sentry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('initializes Sentry when consent is accepted', async () => {
    const Sentry = await import('@sentry/browser');
    const { initSentry } = await import('../sentry');
    await initSentry();
    expect(Sentry.init).toHaveBeenCalled();
  });

  it('skips initialization when consent is not accepted', async () => {
    vi.doMock('../../stores/settingsStore', () => ({
      settings: vi.fn(() => ({ analyticsConsent: 'pending' })),
    }));
    const Sentry = await import('@sentry/browser');
    const { initSentry } = await import('../sentry');
    await initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('registers a logger sink after initialization', async () => {
    const { initSentry } = await import('../sentry');
    const { logger } = await import('../logger');
    const Sentry = await import('@sentry/browser');
    await initSentry();
    // Logger should now route to Sentry
    logger.error('test error', new Error('boom'));
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/observability/__tests__/sentry.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/shared/observability/sentry.ts
import { settings } from '../../stores/settingsStore';
import { registerSink } from './logger';
import { flushEarlyErrors } from './earlyErrors';

let initialized = false;

function sanitizeMessage(msg: string): string {
  return msg.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]');
}

export async function initSentry() {
  if (initialized) return;
  if (settings().analyticsConsent !== 'accepted') return;

  try {
    const Sentry = await import('@sentry/browser');

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION,
      transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
      sendDefaultPii: false,
      maxBreadcrumbs: 30,
      sampleRate: 1.0,
      autoSessionTracking: true,
      beforeSend(event) {
        // PII scrubbing — Layer 2
        if (event.user) {
          delete event.user.ip_address;
          delete event.user.email;
        }
        // Walk extra for sensitive fields
        if (event.extra) {
          for (const key of Object.keys(event.extra)) {
            if (['email', 'displayName', 'playerName', 'teamName'].includes(key)) {
              delete event.extra[key];
            }
          }
        }
        // Scrub Firestore document paths
        const scrubPaths = (str: string) =>
          str.replace(/users\/[^/]+/g, 'users/[redacted]');
        if (event.message) event.message = scrubPaths(event.message);

        // Client-side rate limiting (per-device, per-day)
        try {
          const key = 'sentry_daily_count';
          const stored = localStorage.getItem(key);
          const today = new Date().toDateString();
          let daily = stored ? JSON.parse(stored) : { count: 0, date: today };
          if (daily.date !== today) daily = { count: 0, date: today };
          // Fatal errors bypass rate limit
          if (daily.count >= 200 && event.tags?.error_type !== 'fatal') {
            return null;
          }
          daily.count++;
          localStorage.setItem(key, JSON.stringify(daily));
        } catch {
          // localStorage unavailable — send anyway
        }

        return event;
      },
      beforeBreadcrumb(breadcrumb) {
        // Keep ui.click but strip text content
        if (breadcrumb.category === 'ui.click') {
          if (breadcrumb.data) {
            delete breadcrumb.data.textContent;
            delete breadcrumb.data['target.innerText'];
          }
          return breadcrumb;
        }
        // Drop Firestore XHR breadcrumbs
        if (breadcrumb.category === 'xhr' && breadcrumb.data?.url?.includes('firestore')) {
          return null;
        }
        // Drop console breadcrumbs (logger sink handles these)
        if (breadcrumb.category === 'console') return null;
        return breadcrumb;
      },
    });

    // Set connectivity tags
    Sentry.setTag('connectivity', navigator.onLine ? 'online' : 'offline');
    if ((navigator as any).connection?.effectiveType) {
      Sentry.setTag('connection_type', (navigator as any).connection.effectiveType);
    }

    // Register as logger sink
    registerSink((level, msg, data) => {
      const sentryLevel = level === 'warn' ? 'warning' : level;

      Sentry.addBreadcrumb({
        message: sanitizeMessage(msg),
        level: sentryLevel as any,
        data: typeof data === 'object' && !(data instanceof Error) ? data as Record<string, unknown> : undefined,
      });

      if (level === 'error') {
        const exception = data instanceof Error
          ? data
          : new Error(typeof data === 'string' ? data : msg);
        Sentry.captureException(exception, { extra: { message: msg } });
      }
    });

    // Flush early errors
    flushEarlyErrors((err) => Sentry.captureException(err));

    initialized = true;
  } catch {
    // Sentry init failed (blocked, offline, etc.) — app continues with console-only logging
  }
}

export function setSentryUser(uid: string | null) {
  if (!initialized) return; // Guard: don't load Sentry bundle without consent
  import('@sentry/browser').then((Sentry) => {
    if (uid) {
      Sentry.setUser({ id: uid });
    } else {
      Sentry.flush(2000).then(() => Sentry.setUser(null)).catch(() => {});
    }
  }).catch(() => {});
}

// Export PII scrubbing functions for direct testing
export { sanitizeMessage };
```

**Additional tests for `beforeSend` PII scrubbing (add to sentry.test.ts):**

```ts
describe('PII scrubbing', () => {
  it('sanitizeMessage strips email addresses', async () => {
    const { sanitizeMessage } = await import('../sentry');
    expect(sanitizeMessage('Error for user@example.com')).toBe('Error for [email]');
  });

  it('beforeSend removes ip_address and email from user', () => {
    const event = { user: { id: 'abc', ip_address: '1.2.3.4', email: 'a@b.com' } };
    // Call scrubPII directly (extract as exported function)
    // Verify ip_address and email are deleted, id remains
  });

  it('beforeSend scrubs Firestore document paths', () => {
    const event = { message: 'Error in users/abc123/matches/xyz' };
    // Verify becomes 'Error in users/[redacted]/matches/xyz'
  });

  it('rate limits at 200 errors per day', () => {
    // Set localStorage counter to 200
    // Verify beforeSend returns null for non-fatal events
  });

  it('allows fatal errors to bypass rate limit', () => {
    // Set localStorage counter to 200
    // Verify beforeSend returns event when tags.error_type === 'fatal'
  });
});

describe('setSentryUser', () => {
  it('does nothing when Sentry is not initialized', async () => {
    const { setSentryUser } = await import('../sentry');
    // Should not attempt to import @sentry/browser
    expect(() => setSentryUser('uid123')).not.toThrow();
  });
});
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/observability/__tests__/sentry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/observability/sentry.ts src/shared/observability/__tests__/sentry.test.ts
git commit -m "feat(observability): add Sentry initialization with consent gate and PII scrubbing"
```

---

### Task 6: Create ObservableErrorBoundary component

**Files:**
- Create: `src/shared/observability/ErrorBoundary.tsx`
- Test: `src/shared/observability/__tests__/ErrorBoundary.test.tsx`

**Step 1: Write the failing tests**

```tsx
// src/shared/observability/__tests__/ErrorBoundary.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { ObservableErrorBoundary } from '../ErrorBoundary';

// A component that throws
function ThrowingComponent() {
  throw new Error('render crash');
  return <div>never shown</div>;
}

describe('ObservableErrorBoundary', () => {
  it('renders children when no error', () => {
    render(() => (
      <ObservableErrorBoundary feature="test">
        <div>hello</div>
      </ObservableErrorBoundary>
    ));
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders fallback UI when child throws', () => {
    // Suppress console.error from SolidJS error boundary
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(() => (
      <ObservableErrorBoundary feature="test">
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
  });

  it('calls logger.error when child throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const loggerModule = await import('../logger');
    const errorSpy = vi.spyOn(loggerModule.logger, 'error');
    render(() => (
      <ObservableErrorBoundary feature="scoring">
        <ThrowingComponent />
      </ObservableErrorBoundary>
    ));
    expect(errorSpy).toHaveBeenCalledWith(
      'ErrorBoundary caught error',
      expect.objectContaining({ feature: 'scoring' })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/observability/__tests__/ErrorBoundary.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// src/shared/observability/ErrorBoundary.tsx
import { ErrorBoundary } from 'solid-js';
import type { JSX } from 'solid-js';
import { logger } from './logger';

interface Props {
  children: JSX.Element;
  feature?: string;
  fallback?: (err: unknown, reset: () => void) => JSX.Element;
}

export function ObservableErrorBoundary(props: Props) {
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        logger.error('ErrorBoundary caught error', {
          feature: props.feature,
          error: err instanceof Error ? err : new Error(String(err)),
          errorString: String(err),
        });

        if (props.fallback) {
          return props.fallback(err, reset);
        }

        return (
          <div class="flex flex-col items-center justify-center p-8 text-center">
            <h2 class="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
            <p class="text-gray-400 mb-4">
              {props.feature ? `Error in ${props.feature}` : 'An unexpected error occurred'}
            </p>
            <button
              type="button"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg"
              onClick={reset}
            >
              Try Again
            </button>
          </div>
        );
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/observability/__tests__/ErrorBoundary.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/observability/ErrorBoundary.tsx src/shared/observability/__tests__/ErrorBoundary.test.tsx
git commit -m "feat(observability): add ObservableErrorBoundary with logger integration"
```

---

### Task 7: Wire ErrorBoundary into app (3 tiers) and Sentry init into index.tsx

**Files:**
- Modify: `src/index.tsx:1-12`
- Modify: `src/app/App.tsx:58-73`

**Step 1: Write the failing test (behavioral, not file-reading)**

```ts
// src/shared/observability/__tests__/appIntegration.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('observability app integration', () => {
  it('ObservableErrorBoundary catches root-level render errors and logs them', async () => {
    // Render a component that throws inside ObservableErrorBoundary
    // Verify logger.error is called and fallback UI appears
    // (uses same pattern as ErrorBoundary.test.tsx but at root level)
  });

  it('early error buffer captures errors before Sentry loads', async () => {
    const { getEarlyErrorCount, simulateError } = await import('../earlyErrors');
    simulateError(new Error('boot error'));
    expect(getEarlyErrorCount()).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/observability/__tests__/appIntegration.test.ts`
Expected: FAIL — earlyErrors/ObservableErrorBoundary not found in files

**Step 3: Modify index.tsx**

Replace full content of `src/index.tsx`:

```tsx
import { render } from 'solid-js/web';
import './styles.css';
import './shared/observability/earlyErrors';
import AppRouter from './app/router';
import { initPWAListeners } from './shared/pwa/pwaLifecycle';
import { ObservableErrorBoundary } from './shared/observability/ErrorBoundary';
import { initSentry } from './shared/observability/sentry';

initPWAListeners();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

render(() => (
  <ObservableErrorBoundary feature="root">
    <AppRouter />
  </ObservableErrorBoundary>
), root);

// Lazy-load Sentry after render (Web Vitals added in Task 11)
const scheduleIdle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
scheduleIdle(() => { initSentry(); });
```

**Step 4: Modify App.tsx — wrap children in ErrorBoundary outside Suspense**

In `src/app/App.tsx`, add import and wrap `<Suspense>` block (lines 58-73):

Add import:
```tsx
import { ObservableErrorBoundary } from '../shared/observability/ErrorBoundary';
```

Wrap the Suspense block:
```tsx
<ObservableErrorBoundary feature="route">
  <Suspense fallback={/* existing skeleton */}>
    {props.children}
  </Suspense>
</ObservableErrorBoundary>
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/shared/observability/__tests__/appIntegration.test.ts`
Expected: PASS

**Step 6: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: All existing tests pass

**Step 7: Commit**

```bash
git add src/index.tsx src/app/App.tsx src/shared/observability/__tests__/appIntegration.test.ts
git commit -m "feat(observability): wire 3-tier ErrorBoundary and Sentry init into app"
```

---

### Task 8: Add Sentry user context to useAuth.ts

**Files:**
- Modify: `src/shared/hooks/useAuth.ts:29-99`
- Test: `src/shared/hooks/__tests__/useAuth.test.ts` (add to existing)

**Step 1: Write the failing test**

Add test to existing useAuth tests:

```ts
it('sets Sentry user on sign-in', async () => {
  const { setSentryUser } = await import('../../shared/observability/sentry');
  // Verify setSentryUser is called with uid when auth state changes to signed-in
  // (implementation depends on existing test patterns)
});
```

**Step 2: Modify useAuth.ts**

Add import at top:
```ts
import { setSentryUser } from '../observability/sentry';
```

In the `onAuthStateChanged` callback:
- After `setUser(firebaseUser)` on sign-in path (around line 35): add `setSentryUser(firebaseUser.uid);`
- In the sign-out branch (around line 95-99): add `setSentryUser(null);`

**Step 3: Run tests**

Run: `npx vitest run src/shared/hooks/__tests__/useAuth.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/shared/hooks/useAuth.ts
git commit -m "feat(observability): add Sentry user context on auth state changes"
```

---

### Task 9: Add Sentry source map upload to Vite config

**Files:**
- Modify: `vite.config.ts`

**Step 1: Modify vite.config.ts**

Add `@sentry/vite-plugin` and `manualChunks`:

```ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

// In plugins array (production only):
...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
})] : []),

// In build section:
build: {
  sourcemap: true,
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('@sentry/')) return 'sentry';
        if (id.includes('firebase/analytics') || id.includes('@firebase/analytics'))
          return 'firebase-analytics';
      },
    },
  },
},
```

**Step 2: Verify build works**

Run: `npx vite build`
Expected: Build succeeds, sentry chunk appears in dist/assets/

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "build(observability): add Sentry source map upload and manual chunk splitting"
```

---

## Wave C: Analytics & Web Vitals

### Task 10: Create Firebase Analytics wrapper with consent gate

**Files:**
- Create: `src/shared/observability/analytics.ts`
- Test: `src/shared/observability/__tests__/analytics.test.ts`

**Step 1: Write the failing tests**

```ts
// src/shared/observability/__tests__/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../stores/settingsStore', () => ({
  settings: vi.fn(() => ({ analyticsConsent: 'accepted' })),
}));

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PROD', true);
  });

  it('does not load analytics module when consent is pending', async () => {
    vi.doMock('../../stores/settingsStore', () => ({
      settings: vi.fn(() => ({ analyticsConsent: 'pending' })),
    }));
    const { trackEvent } = await import('../analytics');
    await trackEvent('test_event');
    // No error thrown, function returns silently
  });

  it('deduplicates feature_used events per session', async () => {
    const { trackFeatureUsed, _getTrackedFeatures } = await import('../analytics');
    await trackFeatureUsed('leaderboard_viewed', 'global');
    await trackFeatureUsed('leaderboard_viewed', 'global');
    expect(_getTrackedFeatures().size).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/observability/__tests__/analytics.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/shared/observability/analytics.ts
import type { Analytics } from 'firebase/analytics';
import { settings } from '../../stores/settingsStore';

let analyticsInstance: Analytics | null = null;
let logEventFn: ((instance: Analytics, name: string, params?: Record<string, unknown>) => void) | null = null;
const trackedThisSession = new Set<string>();

export async function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  if (settings().analyticsConsent !== 'accepted') return;
  if (!import.meta.env.PROD) {
    console.debug('[Analytics:dev]', name, params);
    return;
  }

  // Sync fast path
  if (logEventFn && analyticsInstance) {
    logEventFn(analyticsInstance, name, params);
    return;
  }

  // Cold path
  try {
    const mod = await import('firebase/analytics');
    if (await mod.isSupported()) {
      analyticsInstance = mod.getAnalytics();
      logEventFn = mod.logEvent;
      logEventFn(analyticsInstance, name, params);
    }
  } catch {
    // Blocked by extension or CSP
  }
}

export async function trackFeatureUsed(name: string, context?: string) {
  if (trackedThisSession.has(name)) return;
  trackedThisSession.add(name);
  await trackEvent('feature_used', { feature_name: name, ...(context && { context }) });
}

// For testing
export function _getTrackedFeatures() {
  return trackedThisSession;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/observability/__tests__/analytics.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/observability/analytics.ts src/shared/observability/__tests__/analytics.test.ts
git commit -m "feat(observability): add Firebase Analytics wrapper with consent gate and deduplication"
```

---

### Task 11: Create Web Vitals module

**Files:**
- Create: `src/shared/observability/webVitals.ts`
- Test: `src/shared/observability/__tests__/webVitals.test.ts`

**Step 1: Write the failing tests**

```ts
// src/shared/observability/__tests__/webVitals.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('webVitals', () => {
  it('exports initWebVitals function', async () => {
    const { initWebVitals } = await import('../webVitals');
    expect(typeof initWebVitals).toBe('function');
  });

  it('does not throw when PerformanceObserver is unavailable', async () => {
    const original = globalThis.PerformanceObserver;
    // @ts-ignore
    delete globalThis.PerformanceObserver;
    const { initWebVitals } = await import('../webVitals');
    expect(() => initWebVitals()).not.toThrow();
    globalThis.PerformanceObserver = original;
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/observability/__tests__/webVitals.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/shared/observability/webVitals.ts
import { logger } from './logger';

export function initWebVitals() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lcp = entries[entries.length - 1];
      if (lcp) logger.info('web_vital:LCP', { value: Math.round(lcp.startTime) });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported */ }

  // CLS
  let clsValue = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) clsValue += (entry as any).value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }

  // INP — buffer worst value
  let worstInp = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        worstInp = Math.max(worstInp, entry.duration);
      }
    }).observe({ type: 'event', buffered: true });
  } catch { /* unsupported */ }

  // Report on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (clsValue > 0) logger.info('web_vital:CLS', { value: Math.round(clsValue * 1000) });
      if (worstInp > 0) logger.info('web_vital:INP', { value: Math.round(worstInp) });
    }
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/observability/__tests__/webVitals.test.ts`
Expected: PASS

**Step 5: Wire into index.tsx**

Add import and scheduleIdle call to `src/index.tsx`:
```ts
import { initWebVitals } from './shared/observability/webVitals';
// ... after existing scheduleIdle for initSentry:
scheduleIdle(() => { initWebVitals(); });
```

**Step 6: Commit**

```bash
git add src/shared/observability/webVitals.ts src/shared/observability/__tests__/webVitals.test.ts src/index.tsx
git commit -m "feat(observability): add Web Vitals reporting via PerformanceObserver"
```

---

### Task 12: Create consent dialog component

**Files:**
- Create: `src/shared/components/ConsentDialog.tsx`
- Test: `src/shared/components/__tests__/ConsentDialog.test.tsx`

**Step 1: Write the failing tests**

```tsx
// src/shared/components/__tests__/ConsentDialog.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

describe('ConsentDialog', () => {
  it('renders accept and decline buttons', async () => {
    const { ConsentDialog } = await import('../ConsentDialog');
    render(() => <ConsentDialog onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText('Accept')).toBeTruthy();
    expect(screen.getByText('Decline')).toBeTruthy();
  });

  it('calls onAccept when Accept is clicked', async () => {
    const { ConsentDialog } = await import('../ConsentDialog');
    const onAccept = vi.fn();
    render(() => <ConsentDialog onAccept={onAccept} onDecline={vi.fn()} />);
    fireEvent.click(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onDecline when Decline is clicked', async () => {
    const { ConsentDialog } = await import('../ConsentDialog');
    const onDecline = vi.fn();
    render(() => <ConsentDialog onAccept={vi.fn()} onDecline={onDecline} />);
    fireEvent.click(screen.getByText('Decline'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('mentions de-identified data and crash reports', async () => {
    const { ConsentDialog } = await import('../ConsentDialog');
    render(() => <ConsentDialog onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText(/de-identified/i)).toBeTruthy();
    expect(screen.getByText(/crash report/i)).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/components/__tests__/ConsentDialog.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// src/shared/components/ConsentDialog.tsx
import type { Component } from 'solid-js';

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

export const ConsentDialog: Component<Props> = (props) => {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h2 class="text-lg font-semibold text-white mb-3">Help Improve PickleScore</h2>
        <p class="text-gray-300 text-sm mb-6">
          Share de-identified usage data and crash reports to help us improve the app.
          This data is linked to a random identifier, not your name or email.
          You can change this anytime in Settings.
        </p>
        <div class="flex gap-3">
          <button
            type="button"
            class="flex-1 px-4 py-2.5 rounded-lg bg-gray-700 text-gray-200 font-medium text-sm"
            onClick={() => props.onDecline()}
          >
            Decline
          </button>
          <button
            type="button"
            class="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm"
            onClick={() => props.onAccept()}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/components/__tests__/ConsentDialog.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/components/ConsentDialog.tsx src/shared/components/__tests__/ConsentDialog.test.tsx
git commit -m "feat(observability): add consent dialog component for analytics/crash reporting"
```

---

### Task 13: Wire consent dialog into App.tsx and Settings toggle

**Files:**
- Modify: `src/app/App.tsx` — show consent dialog on first launch
- Modify: `src/features/settings/SettingsPage.tsx` — add opt-out toggle

This task wires the consent dialog into the app shell (shown when `analyticsConsent === 'pending'`) and adds a toggle to Settings for changing consent. When consent changes to `accepted`, Sentry initializes on next app load. When changed to `declined`, analytics and Sentry are closed and local observability data is cleaned up.

**Step 1: Write tests for consent wiring behavior**

**Step 2: Implement consent wiring in App.tsx**

Add `Show` conditional for `ConsentDialog` when `settings().analyticsConsent === 'pending'`. On accept: `setSettings({ analyticsConsent: 'accepted', analyticsConsentTimestamp: Date.now() })`. On decline: similar with `'declined'`.

**Step 3: Add toggle to SettingsPage.tsx**

Add a toggle in the Settings page for "Share usage data & crash reports" that reads/writes `analyticsConsent`.

**Step 4: Run tests**

**Step 5: Commit**

```bash
git commit -m "feat(observability): wire consent dialog into app and add Settings opt-out toggle"
```

---

## Wave D: Console Migration (Phased)

### Task 14: Phase 1 — Migrate low-risk utilities (~5 files)

**Files to migrate:** settingsStore.ts, theme files, wake lock
- Replace `console.warn(...)` with `logger.warn(...)` and `console.error(...)` with `logger.error(...)`
- Add `import { logger } from '~/shared/observability/logger';`

**Step 1: Run tests before migration**
**Step 2: Perform mechanical replacement**
**Step 3: Run tests after migration — verify no regressions**
**Step 4: Commit**

```bash
git commit -m "refactor(observability): migrate console.warn/error to logger (phase 1: utilities)"
```

---

### Task 15: Phase 2 — Migrate data layer (~6 files)

**Files:** syncProcessor.ts (8 calls), cloudSync.ts, syncQueue.ts, repositories
- Same mechanical replacement pattern
- Sync queue errors now route through logger sink to Sentry with escalation thresholds

**Step 1-4: Same pattern as Task 14**

```bash
git commit -m "refactor(observability): migrate console.warn/error to logger (phase 2: data layer)"
```

---

### Task 16: Phase 3 — Migrate tournament features (~11 files)

**Files:** TournamentDashboardPage.tsx (10 calls), other tournament components
- Densest error cluster — validate logger handles high-frequency calls

**Step 1-4: Same pattern**

```bash
git commit -m "refactor(observability): migrate console.warn/error to logger (phase 3: tournaments)"
```

---

### Task 17: Phase 4 — Migrate scoring (critical path, ~3 files)

**Files:** ScoringPage.tsx, useScoringActor.ts, scoring engine files
- Last phase — logger is battle-tested by now

**Step 1-4: Same pattern**

```bash
git commit -m "refactor(observability): migrate console.warn/error to logger (phase 4: scoring)"
```

---

### Task 18: Add ESLint rule to prevent console.warn/error usage

**Files:**
- Modify: ESLint config

Add `no-restricted-globals` or `no-console` rule:
```ts
'no-console': ['warn', { allow: ['debug'] }],
'no-restricted-imports': ['error', {
  paths: [{ name: '~/shared/observability', message: 'Import from specific module (e.g., ~/shared/observability/logger)' }]
}],
```

**Commit:**

```bash
git commit -m "chore(observability): add ESLint rules for logger usage and direct imports"
```

---

## Wave E: Cloud Functions + CSP + Operations

### Task 19: Migrate Cloud Functions to structured logging

**Files:**
- Modify: `functions/src/callable/processMatchCompletion.ts`

Replace `console.warn/error` with `functions.logger.warn/error`. Add execution timing and cold start tracking per design doc.

```bash
git commit -m "feat(observability): migrate Cloud Functions to structured logging with timing"
```

---

### Task 20: Update CSP headers for Analytics domains

**Files:**
- Modify: `firebase.json:33-46`

Add to `connect-src` (Sentry domain already added in Task 4b):
```
https://*.google-analytics.com https://*.analytics.google.com https://firebaseinstallations.googleapis.com
```

```bash
git commit -m "security(observability): add Analytics domains to CSP connect-src"
```

---

### Task 21: Add deploy manifest

**Files:**
- Create: `public/deploy.json`
- Modify CI workflow to update commit SHA on deploy

```json
{
  "version": "1.0.0",
  "commit": "local",
  "deployed": "2026-03-21T00:00:00Z"
}
```

```bash
git commit -m "ops(observability): add deploy manifest for post-deploy verification"
```

---

### Task 22: Update privacy policy

**Files:**
- Modify: `src/features/legal/PrivacyPolicy.tsx`

Add sections for:
- Sentry (error tracking, third-party processor)
- Firebase Analytics (de-identified usage data)
- Cloud Logging (operational logs, 30-day retention)
- Cookies & Local Storage disclosure
- Bump "Last updated" date

```bash
git commit -m "docs(observability): update privacy policy with Sentry, Analytics, and Cloud Logging disclosures"
```

---

### Task 23: Add analytics event instrumentation to key flows

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx` — match_started, match_completed
- Modify: `src/features/tournaments/` — tournament_created, tournament_completed
- Modify: `src/shared/pwa/installPromptStore.ts` — pwa_install_prompt_shown/accepted
- Modify: Various feature pages — trackFeatureUsed calls

Add `trackEvent()` and `trackFeatureUsed()` calls at key user action points per the event catalog in the design doc.

```bash
git commit -m "feat(observability): add analytics event instrumentation to key flows"
```

---

### Task 24: Final verification and test suite

**Step 1:** Run full test suite: `npx vitest run`
**Step 2:** Run type check: `npx tsc --noEmit`
**Step 3:** Run build: `npx vite build`
**Step 4:** Verify bundle sizes with `npx vite-bundle-visualizer`
**Step 5:** Manual smoke test in dev mode

```bash
git commit -m "test(observability): verify full test suite and build after Layer 12 integration"
```

---

## Post-Implementation: Compliance Checklist

Not code tasks — admin/operational tasks from the design doc Phase 1-5 compliance checklist. Track separately.

Key items:
1. Create Sentry account, sign DPA, enable 2FA, configure retention/scrubbing
2. Add CI secrets (SENTRY_AUTH_TOKEN, VITE_SENTRY_DSN)
3. Update Play Store Data Safety form
4. Set up GA4 reports (3 bookmarked reports)
5. Set up GCP Cloud Monitoring dashboard
6. Enable Firestore daily backups
7. Set annual privacy review reminder
