import QRCode from 'qrcode';

export async function generateQRDataUrl(url: string, size = 300): Promise<string> {
  return QRCode.toDataURL(url, { width: size, margin: 2 });
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.picklescore.app';

export async function downloadQRSheet(): Promise<void> {
  const [webQR, storeQR] = await Promise.all([
    generateQRDataUrl('https://picklescore.co', 400),
    generateQRDataUrl(PLAY_STORE_URL, 400),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1000, 600);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PickleScore — Scan to Get the App', 500, 40);

  const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });

  const [webImg, storeImg] = await Promise.all([loadImg(webQR), loadImg(storeQR)]);

  ctx.drawImage(webImg, 100, 80, 350, 350);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('iOS — Visit Website', 275, 460);
  ctx.font = '16px sans-serif';
  ctx.fillText('picklescore.co', 275, 490);

  ctx.drawImage(storeImg, 550, 80, 350, 350);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Android — Google Play', 725, 460);
  ctx.font = '16px sans-serif';
  ctx.fillText('Search "PickleScore"', 725, 490);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.fillText('Print at 100% scale for best scan results', 500, 560);

  const link = document.createElement('a');
  link.download = 'picklescore-qr-sheet.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
