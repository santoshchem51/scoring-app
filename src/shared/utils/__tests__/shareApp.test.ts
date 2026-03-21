import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockShare = vi.fn().mockResolvedValue(undefined);
vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
vi.mock('@capacitor/share', () => ({ Share: { share: mockShare } }));

describe('shareApp', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls Capacitor Share on native', async () => {
    const { shareApp } = await import('../shareApp');
    await shareApp();
    expect(mockShare).toHaveBeenCalledWith({
      title: 'PickleScore',
      text: 'Score your pickleball games with PickleScore!',
      url: 'https://picklescore.co',
    });
  });

  it('uses Web Share API when not native and navigator.share exists', async () => {
    vi.doMock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
    const mockNavigatorShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: mockNavigatorShare, configurable: true });

    const { shareApp } = await import('../shareApp');
    const result = await shareApp();

    expect(result).toBe('shared');
    expect(mockNavigatorShare).toHaveBeenCalledWith({
      title: 'PickleScore',
      text: 'Score your pickleball games with PickleScore!',
      url: 'https://picklescore.co',
    });

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('falls back to clipboard when no share API available', async () => {
    vi.doMock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    });

    const { shareApp } = await import('../shareApp');
    const result = await shareApp();

    expect(result).toBe('copied');
    expect(mockWriteText).toHaveBeenCalledWith(
      'Score your pickleball games with PickleScore! https://picklescore.co'
    );
  });

  it('returns failed when no share or clipboard available', async () => {
    vi.doMock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    const { shareApp } = await import('../shareApp');
    const result = await shareApp();

    expect(result).toBe('failed');
  });

  it('returns failed when Share.share rejects (does not throw)', async () => {
    mockShare.mockRejectedValueOnce(new Error('share cancelled'));

    const { shareApp } = await import('../shareApp');
    const result = await shareApp();

    expect(result).toBe('failed');
  });
});
