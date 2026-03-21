import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('webVitals', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('exports initWebVitals function', async () => {
    const { initWebVitals } = await import('../webVitals');
    expect(typeof initWebVitals).toBe('function');
  });

  it('does not throw when PerformanceObserver is unavailable', async () => {
    const original = globalThis.PerformanceObserver;
    // @ts-ignore
    delete (globalThis as any).PerformanceObserver;
    vi.resetModules();
    const { initWebVitals } = await import('../webVitals');
    expect(() => initWebVitals()).not.toThrow();
    globalThis.PerformanceObserver = original;
  });

  it('does not throw when called normally', async () => {
    const { initWebVitals } = await import('../webVitals');
    // jsdom may not support all PerformanceObserver types, but should not throw
    expect(() => initWebVitals()).not.toThrow();
  });
});
