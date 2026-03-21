import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));

vi.mock('../renderScoreCard', () => ({
  renderScoreCard: () => ({
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['test'], { type: 'image/png' })),
    toDataURL: () => 'data:image/png;base64,test',
  }),
}));

describe('shareScoreCard (web)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns failed when toBlob returns null', async () => {
    vi.doMock('../renderScoreCard', () => ({
      renderScoreCard: () => ({
        toBlob: (cb: (b: Blob | null) => void) => cb(null),
        toDataURL: () => '',
      }),
    }));
    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);
    expect(result).toBe('failed');
  });
});
