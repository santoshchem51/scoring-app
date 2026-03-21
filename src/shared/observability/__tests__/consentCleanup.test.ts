import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('revokeObservabilityConsent', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('clears sentry localStorage keys', async () => {
    localStorage.setItem('sentry_daily_count', '5');
    localStorage.setItem('sentry_last_canary', '123');

    const { revokeObservabilityConsent } = await import('../consentCleanup');
    await revokeObservabilityConsent();

    expect(localStorage.getItem('sentry_daily_count')).toBeNull();
    expect(localStorage.getItem('sentry_last_canary')).toBeNull();
  });

  it('does not throw when localStorage is empty', async () => {
    const { revokeObservabilityConsent } = await import('../consentCleanup');
    await expect(revokeObservabilityConsent()).resolves.toBeUndefined();
  });

  it('does not throw when firebase modules are unavailable', async () => {
    // In test environment, firebase modules won't be available
    const { revokeObservabilityConsent } = await import('../consentCleanup');
    await expect(revokeObservabilityConsent()).resolves.toBeUndefined();
  });
});
