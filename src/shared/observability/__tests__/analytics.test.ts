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

  it('analyticsWasInitialized returns false when never initialized', async () => {
    const { analyticsWasInitialized } = await import('../analytics');
    expect(analyticsWasInitialized()).toBe(false);
  });

  it('caches analytics instance on second call (sync fast path in dev)', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: vi.fn(() => ({ analyticsConsent: 'accepted' })),
    }));
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { trackEvent } = await import('../analytics');
    await trackEvent('event_1', { key: 'val1' });
    await trackEvent('event_2', { key: 'val2' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('[Analytics:dev]', 'event_1', { key: 'val1' });
    expect(spy).toHaveBeenCalledWith('[Analytics:dev]', 'event_2', { key: 'val2' });
  });

  it('trackFeatureUsed skips duplicate feature within same session', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: vi.fn(() => ({ analyticsConsent: 'accepted' })),
    }));
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { trackFeatureUsed } = await import('../analytics');
    await trackFeatureUsed('scoring_started');
    await trackFeatureUsed('scoring_started'); // duplicate
    await trackFeatureUsed('history_viewed'); // different feature
    // Only 2 events should fire (scoring_started + history_viewed)
    const featureCalls = spy.mock.calls.filter(
      (call: any[]) => call[1] === 'feature_used'
    );
    expect(featureCalls).toHaveLength(2);
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
