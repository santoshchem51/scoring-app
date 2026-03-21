import { settings } from '../../stores/settingsStore';
import { registerSink, removeSink } from './logger';
import { flushEarlyErrors } from './earlyErrors';

let initialized = false;
let SentryModule: typeof import('@sentry/browser') | null = null;
let registeredSinkFn: ((level: string, msg: string, data?: unknown) => void) | null = null;

const SENSITIVE_FIELDS = ['email', 'displayName', 'playerName', 'teamName'];

export function sanitizeMessage(msg: string): string {
  return msg.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]');
}

export function scrubPII(event: any): any | null {
  // Strip user PII
  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
  }
  // Walk extras for sensitive fields
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (SENSITIVE_FIELDS.includes(key)) {
        delete event.extra[key];
      }
    }
  }
  // Walk contexts for sensitive fields
  if (event.contexts) {
    for (const contextKey of Object.keys(event.contexts)) {
      const ctx = event.contexts[contextKey];
      if (typeof ctx === 'object' && ctx !== null) {
        for (const key of Object.keys(ctx)) {
          if (SENSITIVE_FIELDS.includes(key)) {
            delete ctx[key];
          }
        }
      }
    }
  }
  // Scrub Firestore paths
  if (event.message) {
    event.message = event.message.replace(/users\/[^/\s]+/g, 'users/[redacted]');
  }
  // Rate limiting
  try {
    const key = 'sentry_daily_count';
    const stored = localStorage.getItem(key);
    const today = new Date().toDateString();
    let daily = stored ? JSON.parse(stored) : { count: 0, date: today };
    if (daily.date !== today) daily = { count: 0, date: today };
    if (daily.count >= 200 && event.tags?.error_type !== 'fatal') return null;
    daily.count++;
    localStorage.setItem(key, JSON.stringify(daily));
  } catch {
    /* localStorage unavailable */
  }
  return event;
}

function scrubDataFields(data: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = { ...data };
  for (const key of Object.keys(scrubbed)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      delete scrubbed[key];
    }
  }
  return scrubbed;
}

export function filterBreadcrumb(breadcrumb: any): any | null {
  if (breadcrumb.category === 'ui.click') {
    if (breadcrumb.data) {
      delete breadcrumb.data.textContent;
      delete breadcrumb.data['target.innerText'];
    }
    return breadcrumb;
  }
  if (
    breadcrumb.category === 'xhr' &&
    breadcrumb.data?.url?.includes('firestore')
  )
    return null;
  if (breadcrumb.category === 'console') return null;

  // Strip auth tokens from XHR/fetch breadcrumbs
  if (breadcrumb.data) {
    delete breadcrumb.data.headers;
    delete breadcrumb.data.request_headers;
  }

  return breadcrumb;
}

export async function initSentry() {
  if (initialized) return;
  if (settings().analyticsConsent !== 'accepted') return;

  try {
    const Sentry = await import('@sentry/browser');
    SentryModule = Sentry;
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION,
      transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport, {
        maxQueueSize: 50,
      }),
      sendDefaultPii: false,
      maxBreadcrumbs: 30,
      sampleRate: 1.0,
      autoSessionTracking: true,
      beforeSend: scrubPII,
      beforeBreadcrumb: filterBreadcrumb,
    });

    // Connectivity tags
    Sentry.setTag('connectivity', navigator.onLine ? 'online' : 'offline');
    if ((navigator as any).connection?.effectiveType) {
      Sentry.setTag(
        'connection_type',
        (navigator as any).connection.effectiveType,
      );
    }

    // Register logger sink
    registeredSinkFn = (level, msg, data) => {
      if (!initialized) return; // consent gate — stop after teardown
      const sentryLevel = level === 'warn' ? 'warning' : level;
      const rawData =
        typeof data === 'object' && data !== null && !(data instanceof Error)
          ? (data as Record<string, unknown>)
          : undefined;
      Sentry.addBreadcrumb({
        message: sanitizeMessage(msg),
        level: sentryLevel as any,
        data: rawData ? scrubDataFields(rawData) : undefined,
      });
      if (level === 'error') {
        const exception =
          data instanceof Error
            ? data
            : new Error(typeof data === 'string' ? data : msg);
        Sentry.captureException(exception, { extra: { message: msg } });
      }
    };
    registerSink(registeredSinkFn);

    flushEarlyErrors((err) => Sentry.captureException(err));
    initialized = true;
  } catch {
    // Sentry blocked/failed — app continues with console-only logging
  }
}

export async function teardownSentry() {
  if (!initialized || !SentryModule) return;
  initialized = false; // stop sink immediately
  if (registeredSinkFn) {
    removeSink(registeredSinkFn);
    registeredSinkFn = null;
  }
  try {
    await SentryModule.close();
  } catch {
    // best effort
  }
  SentryModule = null;
}

export function setSentryUser(uid: string | null) {
  if (!initialized || !SentryModule) return;
  if (uid) {
    SentryModule.setUser({ id: uid });
  } else {
    SentryModule.flush(2000)
      .then(() => SentryModule?.setUser(null))
      .catch(() => {});
  }
}
