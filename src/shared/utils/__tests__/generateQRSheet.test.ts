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
});
