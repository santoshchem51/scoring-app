import { teardownSentry } from './sentry';
import { analyticsWasInitialized } from './analytics';

export async function revokeObservabilityConsent() {
  // 1. Teardown Sentry (close + deregister sink)
  await teardownSentry();

  // 2. Stop analytics (only if it was initialized)
  if (analyticsWasInitialized()) {
    try {
      const { setAnalyticsCollectionEnabled, getAnalytics } = await import('firebase/analytics');
      const analytics = getAnalytics();
      setAnalyticsCollectionEnabled(analytics, false);
    } catch { /* not loaded or blocked */ }

    // 3. Delete Firebase Installation ID
    try {
      const { deleteInstallations, getInstallations } = await import('firebase/installations');
      const installations = getInstallations();
      await deleteInstallations(installations);
    } catch { /* best effort */ }
  }

  // 4. Clear Sentry localStorage keys
  try {
    localStorage.removeItem('sentry_daily_count');
    localStorage.removeItem('sentry_last_canary');
  } catch { /* localStorage unavailable */ }
}
