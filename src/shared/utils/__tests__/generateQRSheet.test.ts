import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test') },
}));

describe('generateQRSheet', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('generates a QR data URL for the given URL', async () => {
    const { generateQRDataUrl } = await import('../generateQRSheet');
    const result = await generateQRDataUrl('https://picklescore.co');
    expect(result).toContain('data:image/png');
  });

  it('calls QRCode.toDataURL with correct params', async () => {
    const QRCode = (await import('qrcode')).default;
    const { generateQRDataUrl } = await import('../generateQRSheet');
    await generateQRDataUrl('https://picklescore.co', 400);
    expect(QRCode.toDataURL).toHaveBeenCalledWith('https://picklescore.co', { width: 400, margin: 2 });
  });

  it('generateQRDataUrl with default size passes width: 300', async () => {
    const QRCode = (await import('qrcode')).default;
    const { generateQRDataUrl } = await import('../generateQRSheet');
    await generateQRDataUrl('https://picklescore.co');
    expect(QRCode.toDataURL).toHaveBeenCalledWith('https://picklescore.co', { width: 300, margin: 2 });
  });

  it('downloadQRSheet creates and clicks a download link', async () => {
    const mockCtx = {
      fillStyle: '',
      font: '',
      textAlign: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,sheetdata'),
    };

    const mockLink = {
      download: '',
      href: '',
      click: vi.fn(),
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLElement;
      if (tag === 'a') return mockLink as unknown as HTMLElement;
      return originalCreateElement(tag);
    });

    const OriginalImage = globalThis.Image;
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      src = '';
      constructor() {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;

    const { downloadQRSheet } = await import('../generateQRSheet');
    await downloadQRSheet();

    expect(mockLink.download).toBe('picklescore-qr-sheet.png');
    expect(mockLink.click).toHaveBeenCalled();

    globalThis.Image = OriginalImage;
    vi.restoreAllMocks();
  });
});
