import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const listeners: Record<string, Function> = {};
const mockExitApp = vi.fn();
const mockAddListener = vi.fn((event: string, cb: Function) => { listeners[event] = cb; });
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mockAddListener,
    removeAllListeners: vi.fn(),
    exitApp: mockExitApp,
  },
}));

describe('appLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    for (const key of Object.keys(listeners)) delete listeners[key];
    // Re-register the default platform mock (doMock from prior tests persists)
    vi.doMock('../platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
  });

  it('registers backButton listener on native', async () => {
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(mockAddListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('registers appStateChange listener on native', async () => {
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(mockAddListener).toHaveBeenCalledWith('appStateChange', expect.any(Function));
  });

  it('calls window.history.back when canGoBack is true', async () => {
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['backButton']({ canGoBack: true });
    expect(historyBack).toHaveBeenCalled();
    historyBack.mockRestore();
  });

  it('calls App.exitApp when canGoBack is false', async () => {
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['backButton']({ canGoBack: false });
    expect(mockExitApp).toHaveBeenCalled();
  });

  it('dispatches app-state-change custom event on appStateChange', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['appStateChange']({ isActive: false });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app-state-change', detail: { isActive: false } })
    );
    dispatchSpy.mockRestore();
  });

  it('does not register listeners when IS_NATIVE is false', async () => {
    vi.doMock('../platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it('dispatches app-state-change with isActive: true', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['appStateChange']({ isActive: true });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app-state-change', detail: { isActive: true } })
    );
    dispatchSpy.mockRestore();
  });

  it('only registers listeners once when initAppLifecycle is called twice', async () => {
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    initAppLifecycle();
    // addListener is called twice per init (backButton + appStateChange), so only 2 total
    expect(mockAddListener).toHaveBeenCalledTimes(2);
  });

  it('shows confirm dialog on back button during scoring when canGoBack is true', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/score/abc123' },
      writable: true,
      configurable: true,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['backButton']({ canGoBack: true });

    expect(confirmSpy).toHaveBeenCalledWith('Leave this game? Your progress is saved.');
    expect(historyBack).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
    historyBack.mockRestore();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
      configurable: true,
    });
  });

  it('does not call exitApp on back button during scoring when canGoBack is false', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/score/abc123' },
      writable: true,
      configurable: true,
    });

    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['backButton']({ canGoBack: false });

    expect(mockExitApp).not.toHaveBeenCalled();

    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
      configurable: true,
    });
  });
});
