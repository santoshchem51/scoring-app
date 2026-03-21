import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));

vi.mock('../renderScoreCard', () => ({
  renderScoreCard: () => ({
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['test'], { type: 'image/png' })),
    toDataURL: () => 'data:image/png;base64,test',
  }),
}));

function mockCanvasOk() {
  vi.doMock('../renderScoreCard', () => ({
    renderScoreCard: () => ({
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['test'], { type: 'image/png' })),
      toDataURL: () => 'data:image/png;base64,test',
    }),
  }));
}

describe('shareScoreCard (web)', () => {
  const origShare = navigator.share;
  const origCanShare = navigator.canShare;
  const origClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'share', { value: origShare, writable: true, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: origCanShare, writable: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, writable: true, configurable: true });
  });

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

  it('returns shared when Web Share API is available and canShare returns true', async () => {
    mockCanvasOk();
    const mockShareFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: mockShareFn, writable: true, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, writable: true, configurable: true });

    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);
    expect(mockShareFn).toHaveBeenCalled();
    expect(result).toBe('shared');
  });

  it('returns copied when Web Share API is unavailable but clipboard is available', async () => {
    mockCanvasOk();
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, writable: true, configurable: true });
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { write: mockWrite }, writable: true, configurable: true });
    // Ensure ClipboardItem is available in jsdom
    if (typeof globalThis.ClipboardItem === 'undefined') {
      (globalThis as any).ClipboardItem = class ClipboardItem {
        constructor(public items: Record<string, Blob>) {}
      };
    }

    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);
    expect(mockWrite).toHaveBeenCalled();
    expect(result).toBe('copied');
  });

  it('returns downloaded when Web Share API and clipboard are unavailable', async () => {
    mockCanvasOk();
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: {}, writable: true, configurable: true });

    const mockClick = vi.fn();
    const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({ click: mockClick, href: '', download: '' } as any);
    const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);
    expect(mockClick).toHaveBeenCalled();
    expect(result).toBe('downloaded');

    mockCreateElement.mockRestore();
    mockCreateObjectURL.mockRestore();
    mockRevokeObjectURL.mockRestore();
  });

  it('falls through when navigator.share throws', async () => {
    mockCanvasOk();
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new Error('share failed')), writable: true, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, writable: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: {}, writable: true, configurable: true });

    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);
    expect(result).toBe('failed');
  });
});
