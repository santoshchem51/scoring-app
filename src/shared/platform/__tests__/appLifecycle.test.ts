import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const listeners: Record<string, Function> = {};
const mockExitApp = vi.fn();
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event: string, cb: Function) => { listeners[event] = cb; }),
    removeAllListeners: vi.fn(),
    exitApp: mockExitApp,
  },
}));

describe('appLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    for (const key of Object.keys(listeners)) delete listeners[key];
  });

  it('registers backButton listener on native', async () => {
    const { App } = await import('@capacitor/app');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(App.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('registers appStateChange listener on native', async () => {
    const { App } = await import('@capacitor/app');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(App.addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function));
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
    const { App } = await import('@capacitor/app');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(App.addListener).not.toHaveBeenCalled();
  });
});
