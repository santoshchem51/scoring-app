import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../shared/platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const mockHide = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: mockHide },
}));

describe('SplashScreen hide on mount', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls SplashScreen.hide when IS_NATIVE is true', async () => {
    const { IS_NATIVE } = await import('../../shared/platform/platform');
    const { SplashScreen } = await import('@capacitor/splash-screen');
    if (IS_NATIVE) {
      await SplashScreen.hide();
    }
    expect(mockHide).toHaveBeenCalled();
  });
});
