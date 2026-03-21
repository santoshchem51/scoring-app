import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('webVitals', () => {
  let mockLoggerInfo: ReturnType<typeof vi.fn>;
  let observerCallbacks: Map<string, (list: any) => void>;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    observerCallbacks = new Map();
    mockLoggerInfo = vi.fn();

    vi.doMock('../logger', () => ({
      logger: {
        debug: vi.fn(),
        info: mockLoggerInfo,
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    // Mock PerformanceObserver to capture callbacks
    vi.stubGlobal('PerformanceObserver', class {
      private callback: (list: any) => void;
      constructor(callback: (list: any) => void) {
        this.callback = callback;
      }
      observe(options: { type: string }) {
        observerCallbacks.set(options.type, this.callback);
      }
      disconnect() {}
    });
  });

  afterEach(() => {
    // Restore visibilityState for other tests
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('reports LCP when largest-contentful-paint entry is observed', async () => {
    const { initWebVitals } = await import('../webVitals');
    initWebVitals();

    const lcpCallback = observerCallbacks.get('largest-contentful-paint');
    expect(lcpCallback).toBeDefined();
    lcpCallback!({ getEntries: () => [{ startTime: 1234.5 }] });

    expect(mockLoggerInfo).toHaveBeenCalledWith('web_vital:LCP', { value: 1235 });
  });

  it('reports CLS on visibilitychange', async () => {
    const { initWebVitals } = await import('../webVitals');
    initWebVitals();

    const clsCallback = observerCallbacks.get('layout-shift');
    expect(clsCallback).toBeDefined();
    clsCallback!({ getEntries: () => [{ hadRecentInput: false, value: 0.05 }] });
    clsCallback!({ getEntries: () => [{ hadRecentInput: false, value: 0.03 }] });

    // Trigger visibilitychange
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // (0.05 + 0.03) * 1000 = 80
    expect(mockLoggerInfo).toHaveBeenCalledWith('web_vital:CLS', { value: 80 });
  });

  it('ignores layout shifts with recent input', async () => {
    const { initWebVitals } = await import('../webVitals');
    initWebVitals();

    const clsCallback = observerCallbacks.get('layout-shift');
    clsCallback!({ getEntries: () => [{ hadRecentInput: true, value: 0.5 }] });

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // CLS is 0 — should NOT be reported
    const clsCalls = mockLoggerInfo.mock.calls.filter(
      (call: any[]) => call[0] === 'web_vital:CLS'
    );
    expect(clsCalls).toHaveLength(0);
  });

  it('reports worst INP on visibilitychange', async () => {
    const { initWebVitals } = await import('../webVitals');
    initWebVitals();

    const inpCallback = observerCallbacks.get('event');
    expect(inpCallback).toBeDefined();
    inpCallback!({ getEntries: () => [{ duration: 50 }, { duration: 200 }] });
    inpCallback!({ getEntries: () => [{ duration: 150 }] });

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockLoggerInfo).toHaveBeenCalledWith('web_vital:INP', { value: 200 });
  });

  it('does not throw when PerformanceObserver is unavailable', async () => {
    vi.stubGlobal('PerformanceObserver', undefined);
    vi.resetModules();
    vi.doMock('../logger', () => ({
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    const { initWebVitals } = await import('../webVitals');
    expect(() => initWebVitals()).not.toThrow();
  });

  it('does not report CLS or INP when values are 0', async () => {
    const { initWebVitals } = await import('../webVitals');
    initWebVitals();

    // Don't trigger any layout shifts or events

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    const clsCalls = mockLoggerInfo.mock.calls.filter(
      (call: any[]) => call[0] === 'web_vital:CLS'
    );
    const inpCalls = mockLoggerInfo.mock.calls.filter(
      (call: any[]) => call[0] === 'web_vital:INP'
    );
    expect(clsCalls).toHaveLength(0);
    expect(inpCalls).toHaveLength(0);
  });
});
