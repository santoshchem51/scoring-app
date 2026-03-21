import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const mockWriteFile = vi.fn().mockResolvedValue({ uri: 'file:///cache/picklescore-share.png' });
const mockDeleteFile = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: mockWriteFile, deleteFile: mockDeleteFile },
  Directory: { Cache: 'CACHE' },
}));

const mockShare = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/share', () => ({
  Share: { share: mockShare },
}));

vi.mock('../renderScoreCard', () => ({
  renderScoreCard: () => ({
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['test'], { type: 'image/png' })),
    toDataURL: () => 'data:image/png;base64,dGVzdA==',
  }),
}));

describe('shareScoreCard (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('writes PNG to cache and shares file URI on native', async () => {
    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);

    expect(mockWriteFile).toHaveBeenCalledWith({
      path: 'picklescore-share.png',
      data: 'dGVzdA==',
      directory: 'CACHE',
    });
    expect(mockShare).toHaveBeenCalledWith({
      title: 'PickleScore Result',
      text: 'Check out my pickleball score!',
      files: ['file:///cache/picklescore-share.png'],
    });
    expect(mockDeleteFile).toHaveBeenCalledWith({
      path: 'picklescore-share.png',
      directory: 'CACHE',
    });
    expect(result).toBe('shared');
  });

  it('returns failed when Filesystem.writeFile rejects', async () => {
    vi.doMock('@capacitor/filesystem', () => ({
      Filesystem: {
        writeFile: vi.fn().mockRejectedValue(new Error('disk full')),
        deleteFile: vi.fn().mockResolvedValue(undefined),
      },
      Directory: { Cache: 'CACHE' },
    }));
    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);
    expect(result).toBe('failed');
  });

  it('returns failed when Share.share rejects', async () => {
    vi.doMock('@capacitor/share', () => ({
      Share: { share: vi.fn().mockRejectedValue(new Error('share cancelled')) },
    }));
    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);
    expect(result).toBe('failed');
  });
});
