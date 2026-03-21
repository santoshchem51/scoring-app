import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
  },
}));

describe('platform (native)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('exports IS_NATIVE as true in native environment', async () => {
    const { IS_NATIVE } = await import('../platform');
    expect(IS_NATIVE).toBe(true);
  });

  it('exports PLATFORM as android in native environment', async () => {
    const { PLATFORM } = await import('../platform');
    expect(PLATFORM).toBe('android');
  });
});
