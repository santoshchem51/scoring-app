import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns silently when consent is pending', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: vi.fn(() => ({ analyticsConsent: 'pending' })),
    }));
    const { trackEvent } = await import('../analytics');
    // Should not throw
    await expect(trackEvent('test_event')).resolves.toBeUndefined();
  });

  it('returns silently when consent is declined', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: vi.fn(() => ({ analyticsConsent: 'declined' })),
    }));
    const { trackEvent } = await import('../analytics');
    await expect(trackEvent('test_event')).resolves.toBeUndefined();
  });

  it('logs to console.debug in dev mode', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: vi.fn(() => ({ analyticsConsent: 'accepted' })),
    }));
    // import.meta.env.PROD is false in test mode by default
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { trackEvent } = await import('../analytics');
    await trackEvent('test_event', { key: 'value' });
    expect(spy).toHaveBeenCalledWith('[Analytics:dev]', 'test_event', { key: 'value' });
  });

  it('deduplicates feature_used events per session', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: vi.fn(() => ({ analyticsConsent: 'accepted' })),
    }));
    const { trackFeatureUsed, _getTrackedFeatures } = await import('../analytics');
    await trackFeatureUsed('leaderboard_viewed', 'global');
    await trackFeatureUsed('leaderboard_viewed', 'global');
    expect(_getTrackedFeatures().size).toBe(1);
  });
});
