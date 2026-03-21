import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHide = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: mockHide },
}));

describe('hideSplashScreen', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls SplashScreen.hide when IS_NATIVE is true', async () => {
    vi.doMock('../../shared/platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
    const { hideSplashScreen } = await import('../../shared/platform/splashScreen');
    hideSplashScreen();
    expect(mockHide).toHaveBeenCalled();
  });

  it('does NOT call SplashScreen.hide when IS_NATIVE is false', async () => {
    vi.doMock('../../shared/platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
    const { hideSplashScreen } = await import('../../shared/platform/splashScreen');
    hideSplashScreen();
    expect(mockHide).not.toHaveBeenCalled();
  });
});
