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

  it('calls setAnalyticsCollectionEnabled(false) when analytics was initialized', async () => {
    const mockSetCollection = vi.fn();
    const mockGetAnalytics = vi.fn().mockReturnValue({ app: {} });
    const mockDeleteInstallations = vi.fn().mockResolvedValue(undefined);
    const mockGetInstallations = vi.fn().mockReturnValue({});

    vi.doMock('../analytics', () => ({
      analyticsWasInitialized: () => true,
    }));
    vi.doMock('../sentry', () => ({
      teardownSentry: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('firebase/analytics', () => ({
      setAnalyticsCollectionEnabled: mockSetCollection,
      getAnalytics: mockGetAnalytics,
    }));
    vi.doMock('firebase/installations', () => ({
      deleteInstallations: mockDeleteInstallations,
      getInstallations: mockGetInstallations,
    }));

    const { revokeObservabilityConsent } = await import('../consentCleanup');
    await revokeObservabilityConsent();

    expect(mockSetCollection).toHaveBeenCalledWith({ app: {} }, false);
    expect(mockDeleteInstallations).toHaveBeenCalled();
  });

  it('skips Firebase calls when analytics was never initialized', async () => {
    const mockSetCollection = vi.fn();

    vi.doMock('../analytics', () => ({
      analyticsWasInitialized: () => false,
    }));
    vi.doMock('../sentry', () => ({
      teardownSentry: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('firebase/analytics', () => ({
      setAnalyticsCollectionEnabled: mockSetCollection,
      getAnalytics: vi.fn(),
    }));

    const { revokeObservabilityConsent } = await import('../consentCleanup');
    await revokeObservabilityConsent();

    expect(mockSetCollection).not.toHaveBeenCalled();
  });

  it('calls teardownSentry before other cleanup', async () => {
    const callOrder: string[] = [];

    vi.doMock('../analytics', () => ({
      analyticsWasInitialized: () => true,
    }));
    vi.doMock('../sentry', () => ({
      teardownSentry: vi.fn().mockImplementation(async () => {
        callOrder.push('teardownSentry');
      }),
    }));
    vi.doMock('firebase/analytics', () => ({
      setAnalyticsCollectionEnabled: vi.fn().mockImplementation(() => {
        callOrder.push('disableAnalytics');
      }),
      getAnalytics: vi.fn().mockReturnValue({}),
    }));
    vi.doMock('firebase/installations', () => ({
      deleteInstallations: vi.fn().mockImplementation(async () => {
        callOrder.push('deleteInstallations');
      }),
      getInstallations: vi.fn().mockReturnValue({}),
    }));

    const { revokeObservabilityConsent } = await import('../consentCleanup');
    await revokeObservabilityConsent();

    expect(callOrder[0]).toBe('teardownSentry');
  });
});
