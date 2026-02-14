import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const publicDir = resolve(projectRoot, 'public');

// Create a higher-resolution SVG for better PNG rendering
function createSvg(size) {
  // Scale rx proportionally: original rx=6 at viewBox 32 => rx/size ratio
  const rx = Math.round((6 / 32) * size);
  const fontSize = Math.round((16 / 32) * size);
  const textY = Math.round((22 / 32) * size);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#1e1e2e"/>
  <text x="${size / 2}" y="${textY}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="${fontSize}" fill="#22c55e">PS</text>
</svg>`);
}

const icons = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const icon of icons) {
  const svgBuffer = createSvg(icon.size);
  const outputPath = resolve(publicDir, icon.name);

  await sharp(svgBuffer)
    .resize(icon.size, icon.size)
    .png()
    .toFile(outputPath);

  console.log(`Generated ${icon.name} (${icon.size}x${icon.size})`);
}

console.log('All icons generated successfully.');
