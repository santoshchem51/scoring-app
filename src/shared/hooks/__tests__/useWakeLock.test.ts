import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockKeepAwake = vi.fn().mockResolvedValue(undefined);
const mockAllowSleep = vi.fn().mockResolvedValue(undefined);

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: mockKeepAwake, allowSleep: mockAllowSleep },
}));

const mockOnCleanup = vi.fn();
vi.mock('solid-js', () => ({ onCleanup: mockOnCleanup }));

describe('useWakeLock (native)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls KeepAwake.keepAwake on request', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    const { request } = useWakeLock();
    await request();
    expect(mockKeepAwake).toHaveBeenCalled();
  });

  it('calls KeepAwake.allowSleep on release', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    const { release } = useWakeLock();
    await release();
    expect(mockAllowSleep).toHaveBeenCalled();
  });

  it('registers onCleanup callback', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    useWakeLock();
    expect(mockOnCleanup).toHaveBeenCalledWith(expect.any(Function));
  });
});
