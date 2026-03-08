import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Firebase Hosting configuration', () => {
  const config = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../firebase.json'), 'utf8')
  );

  it('has hosting section', () => {
    expect(config.hosting).toBeDefined();
  });

  it('has SPA rewrite rule', () => {
    const rewrite = config.hosting.rewrites.find(
      (r: { destination: string }) => r.destination === '/index.html'
    );
    expect(rewrite).toBeTruthy();
  });

  it('has CSP header with required directives', () => {
    const globalHeaders = config.hosting.headers.find(
      (h: { source: string }) => h.source === '**'
    );
    const csp = globalHeaders.headers.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy'
    );
    expect(csp).toBeTruthy();
    expect(csp.value).toContain("default-src 'self'");
    expect(csp.value).toContain("object-src 'none'");
    expect(csp.value).toContain("worker-src 'self'");
    expect(csp.value).toContain('accounts.google.com');
  });

  it('has no-cache on sw.js', () => {
    const swHeaders = config.hosting.headers.find(
      (h: { source: string }) => h.source === '/sw.js'
    );
    expect(swHeaders.headers[0].value).toContain('no-cache');
  });

  it('has immutable cache on /assets/**', () => {
    const assetHeaders = config.hosting.headers.find(
      (h: { source: string }) => h.source === '/assets/**'
    );
    expect(assetHeaders.headers[0].value).toContain('immutable');
  });

  it('has no-cache on manifest.webmanifest', () => {
    const manifestHeaders = config.hosting.headers.find(
      (h: { source: string }) => h.source === '/manifest.webmanifest'
    );
    expect(manifestHeaders.headers[0].value).toContain('no-cache');
  });
});
