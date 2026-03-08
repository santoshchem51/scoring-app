import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Workbox configuration', () => {
  const config = readFileSync(resolve(__dirname, '../../../../vite.config.ts'), 'utf8');

  it('has navigateFallback for offline deep links', () => {
    expect(config).toContain("navigateFallback: '/index.html'");
  });

  it('has navigateFallbackDenylist', () => {
    expect(config).toContain('navigateFallbackDenylist');
  });

  it('has cleanupOutdatedCaches enabled', () => {
    expect(config).toContain('cleanupOutdatedCaches: true');
  });

  it('has CacheFirst rule for /assets/', () => {
    expect(config).toContain("cacheName: 'vite-assets'");
  });

  it('has CacheFirst rule for /fonts/', () => {
    expect(config).toContain("cacheName: 'local-fonts'");
  });

  it('has StaleWhileRevalidate for Google profile photos', () => {
    expect(config).toContain("cacheName: 'google-profile-photos'");
  });

  it('has cacheId for namespace isolation', () => {
    expect(config).toContain("cacheId: 'picklescore'");
  });

  it('has dontCacheBustURLsMatching for Vite hashes', () => {
    expect(config).toContain('dontCacheBustURLsMatching');
  });
});
