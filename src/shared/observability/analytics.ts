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

  // Sync fast path — no promise allocation after init
  if (logEventFn && analyticsInstance) {
    logEventFn(analyticsInstance, name, params);
    return;
  }

  // Cold path — lazy load
  try {
    const mod = await import('firebase/analytics');
    if (await mod.isSupported()) {
      analyticsInstance = mod.getAnalytics();
      logEventFn = mod.logEvent;
      logEventFn(analyticsInstance, name, params);
    }
  } catch {
    // Blocked by extension or CSP — graceful degradation
  }
}

export async function trackFeatureUsed(name: string, context?: string) {
  if (trackedThisSession.has(name)) return;
  trackedThisSession.add(name);
  await trackEvent('feature_used', { feature_name: name, ...(context && { context }) });
}

export function analyticsWasInitialized(): boolean {
  return analyticsInstance !== null;
}

// For testing
export function _getTrackedFeatures() {
  return trackedThisSession;
}
