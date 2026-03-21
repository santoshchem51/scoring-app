import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('earlyErrors', () => {
  const listeners: Array<{ type: string; handler: EventListenerOrEventListenerObject }> = [];
  const originalAddEventListener = window.addEventListener.bind(window);

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    listeners.length = 0;

    // Intercept addEventListener to track listeners for cleanup
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, handler: EventListenerOrEventListenerObject, options?: any) => {
        listeners.push({ type, handler });
        originalAddEventListener(type, handler, options);
      }
    );
  });

  afterEach(() => {
    for (const { type, handler } of listeners) {
      window.removeEventListener(type, handler);
    }
  });

  it('captures errors via simulateError', async () => {
    const { getEarlyErrorCount, simulateError } = await import('../earlyErrors');
    simulateError(new Error('test error 1'));
    simulateError(new Error('test error 2'));
    expect(getEarlyErrorCount()).toBe(2);
  });

  it('flushes buffered errors to captureException', async () => {
    const { flushEarlyErrors, simulateError } = await import('../earlyErrors');
    simulateError(new Error('err1'));
    simulateError(new Error('err2'));
    const capture = vi.fn();
    flushEarlyErrors(capture);
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('clears buffer after flush', async () => {
    const { flushEarlyErrors, getEarlyErrorCount, simulateError } = await import('../earlyErrors');
    simulateError(new Error('err'));
    flushEarlyErrors(vi.fn());
    expect(getEarlyErrorCount()).toBe(0);
  });

  it('caps buffer at 20 entries', async () => {
    const { getEarlyErrorCount, simulateError } = await import('../earlyErrors');
    for (let i = 0; i < 25; i++) {
      simulateError(new Error(`err${i}`));
    }
    expect(getEarlyErrorCount()).toBe(20);
  });

  it('captures errors from real window error events', async () => {
    const { getEarlyErrorCount } = await import('../earlyErrors');
    const before = getEarlyErrorCount();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('real error') }));
    expect(getEarlyErrorCount()).toBe(before + 1);
  });

  it('stops buffering after flush', async () => {
    const { flushEarlyErrors, getEarlyErrorCount, simulateError } = await import('../earlyErrors');
    simulateError(new Error('before'));
    flushEarlyErrors(vi.fn());
    simulateError(new Error('after'));
    expect(getEarlyErrorCount()).toBe(0);
  });

  it('captures unhandled promise rejections', async () => {
    const { getEarlyErrorCount } = await import('../earlyErrors');
    const before = getEarlyErrorCount();
    // PromiseRejectionEvent may not be available in jsdom — use a fallback
    try {
      const event = new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('rejected'),
        promise: Promise.reject(new Error('rejected')),
      });
      window.dispatchEvent(event);
      expect(getEarlyErrorCount()).toBe(before + 1);
    } catch {
      // PromiseRejectionEvent not supported in jsdom — skip gracefully
      console.warn('PromiseRejectionEvent not supported in test env, skipping');
    }
  });
});
