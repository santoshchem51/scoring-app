import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
vi.mock('../swUpdateStore', () => ({ swUpdateVisible: () => false }));

describe('installPromptStore (native)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('showInstallBanner returns false when IS_NATIVE is true', async () => {
    const { showInstallBanner } = await import('../installPromptStore');
    expect(showInstallBanner()).toBe(false);
  });

  it('showInstallBanner returns false even when all other conditions are met', async () => {
    const mod = await import('../installPromptStore');
    // Set up conditions that would normally show the banner
    mod.captureInstallEvent(new Event('beforeinstallprompt'));
    mod.setCompletedMatchCount(5);
    expect(mod.showInstallBanner()).toBe(false);
  });

  it('iosInstallSupported returns false when IS_NATIVE is true', async () => {
    const { iosInstallSupported } = await import('../installPromptStore');
    expect(iosInstallSupported()).toBe(false);
  });
});
