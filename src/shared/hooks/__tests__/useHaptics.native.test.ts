import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const mockImpact = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: mockImpact },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

vi.mock('../../../stores/settingsStore', () => ({
  settings: () => ({ hapticFeedback: true }),
}));

describe('useHaptics (native)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls Capacitor Haptics.impact for light vibration', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { light } = useHaptics();
    light();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('calls Capacitor Haptics.impact for medium vibration', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { medium } = useHaptics();
    medium();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'MEDIUM' });
  });

  it('calls Capacitor Haptics.impact for heavy vibration', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { heavy } = useHaptics();
    heavy();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'HEAVY' });
  });

  it('calls double vibration with two impacts', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { double } = useHaptics();
    await double();
    expect(mockImpact).toHaveBeenCalledTimes(2);
  });

  it('double() uses ImpactStyle.Light for both calls', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { double } = useHaptics();
    await double();
    expect(mockImpact).toHaveBeenNthCalledWith(1, { style: 'LIGHT' });
    expect(mockImpact).toHaveBeenNthCalledWith(2, { style: 'LIGHT' });
  });

  it('suppresses all native haptic calls when hapticFeedback is false', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: false }),
    }));
    const { useHaptics } = await import('../useHaptics');
    const { light, medium, heavy } = useHaptics();
    light();
    medium();
    heavy();
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it('suppresses double() when hapticFeedback is false', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: false }),
    }));
    const { useHaptics } = await import('../useHaptics');
    const { double } = useHaptics();
    await double();
    expect(mockImpact).not.toHaveBeenCalled();
  });
});
