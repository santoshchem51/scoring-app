import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Self-hosted font configuration', () => {
  it('Oswald-Bold.woff2 exists in public/fonts/', () => {
    const fontPath = resolve(__dirname, '../../../../public/fonts/Oswald-Bold.woff2');
    expect(existsSync(fontPath)).toBe(true);
  });

  it('index.html has no Google Fonts references', () => {
    const html = readFileSync(resolve(__dirname, '../../../../index.html'), 'utf8');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('index.html has local font preload', () => {
    const html = readFileSync(resolve(__dirname, '../../../../index.html'), 'utf8');
    expect(html).toContain('rel="preload"');
    expect(html).toContain('/fonts/Oswald-Bold.woff2');
  });

  it('styles.css has @font-face declaration for Oswald', () => {
    const css = readFileSync(resolve(__dirname, '../../../styles.css'), 'utf8');
    expect(css).toContain("font-family: 'Oswald'");
    expect(css).toContain('font-display: swap');
  });
});
