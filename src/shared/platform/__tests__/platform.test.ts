import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

describe('platform (web)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('exports IS_NATIVE as false in web environment', async () => {
    const { IS_NATIVE } = await import('../platform');
    expect(IS_NATIVE).toBe(false);
  });

  it('exports PLATFORM as web in web environment', async () => {
    const { PLATFORM } = await import('../platform');
    expect(PLATFORM).toBe('web');
  });
});
