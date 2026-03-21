import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: vi.fn(), allowSleep: vi.fn() },
}));

const mockOnCleanup = vi.fn();
vi.mock('solid-js', () => ({ onCleanup: mockOnCleanup }));

describe('useWakeLock (web)', () => {
  const mockRelease = vi.fn().mockResolvedValue(undefined);
  let mockRequest: ReturnType<typeof vi.fn>;
  let originalNavigator: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = vi.fn().mockResolvedValue({ release: mockRelease });

    originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...globalThis.navigator,
        wakeLock: { request: mockRequest },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
  });

  it('request() calls navigator.wakeLock.request("screen") on web', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    const { request } = useWakeLock();
    await request();
    expect(mockRequest).toHaveBeenCalledWith('screen');
  });

  it('release() calls wakeLockSentinel.release() and clears reference', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    const { request, release } = useWakeLock();
    await request();
    await release();
    expect(mockRelease).toHaveBeenCalled();

    // Second release should be a no-op (reference cleared)
    mockRelease.mockClear();
    await release();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('release() when no lock is held is a no-op', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    const { release } = useWakeLock();
    await expect(release()).resolves.toBeUndefined();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('request() when navigator.wakeLock is not available is a no-op', async () => {
    // Remove wakeLock from navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test' },
      configurable: true,
      writable: true,
    });

    const { useWakeLock } = await import('../useWakeLock');
    const { request } = useWakeLock();
    await expect(request()).resolves.toBeUndefined();
  });

  it('request() when navigator.wakeLock.request() throws warns via console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockRequest.mockRejectedValueOnce(new Error('NotAllowedError'));

    const { useWakeLock } = await import('../useWakeLock');
    const { request } = useWakeLock();
    await request();

    expect(warnSpy).toHaveBeenCalledWith('Wake Lock request failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('onCleanup callback should be registered', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    useWakeLock();
    expect(mockOnCleanup).toHaveBeenCalledWith(expect.any(Function));
  });
});
