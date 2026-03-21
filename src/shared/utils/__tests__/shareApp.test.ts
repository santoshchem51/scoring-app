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
});
