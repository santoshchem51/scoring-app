import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn() },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

describe('useHaptics (web)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls navigator.vibrate on web when haptics enabled', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: true }),
    }));
    const mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: mockVibrate, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { light } = useHaptics();
    light();
    expect(mockVibrate).toHaveBeenCalledWith(10);
  });

  it('does not vibrate when hapticFeedback is false', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: false }),
    }));
    const mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: mockVibrate, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { light } = useHaptics();
    light();
    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it('does not crash when navigator.vibrate is undefined', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: true }),
    }));
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { medium } = useHaptics();
    expect(() => medium()).not.toThrow();
  });

  it('double() calls navigator.vibrate with [15, 50, 15]', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: true }),
    }));
    const mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: mockVibrate, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { double } = useHaptics();
    await double();
    expect(mockVibrate).toHaveBeenCalledWith([15, 50, 15]);
  });

  it('medium() calls navigator.vibrate with 25', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: true }),
    }));
    const mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: mockVibrate, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { medium } = useHaptics();
    medium();
    expect(mockVibrate).toHaveBeenCalledWith(25);
  });

  it('heavy() calls navigator.vibrate with 50', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: true }),
    }));
    const mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: mockVibrate, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { heavy } = useHaptics();
    heavy();
    expect(mockVibrate).toHaveBeenCalledWith(50);
  });

  it('double() is suppressed when hapticFeedback is false', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: false }),
    }));
    const mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: mockVibrate, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { double } = useHaptics();
    await double();
    expect(mockVibrate).not.toHaveBeenCalled();
  });
});
