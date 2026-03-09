import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../installPromptStore', () => ({
  captureInstallEvent: vi.fn(),
  markInstalled: vi.fn(),
  incrementVisitCount: vi.fn(),
  setCompletedMatchCount: vi.fn(),
}));

vi.mock('../../../data/db', () => ({
  db: {
    matches: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
        }),
      }),
    },
  },
}));

describe('pwaLifecycle', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
  });

  it('initPWAListeners registers beforeinstallprompt and appinstalled listeners', async () => {
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const eventNames = addEventListenerSpy.mock.calls.map(c => c[0]);
    expect(eventNames).toContain('beforeinstallprompt');
    expect(eventNames).toContain('appinstalled');
  });

  it('initPWAListeners calls incrementVisitCount', async () => {
    const { incrementVisitCount } = await import('../installPromptStore');
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    expect(incrementVisitCount).toHaveBeenCalledTimes(1);
  });

  it('initPWAListeners queries Dexie for completed match count', async () => {
    const { setCompletedMatchCount } = await import('../installPromptStore');
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    // Allow the async query to resolve
    await new Promise(r => setTimeout(r, 10));
    expect(setCompletedMatchCount).toHaveBeenCalledWith(0);
  });

  it('initPWAListeners is idempotent', async () => {
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const count1 = addEventListenerSpy.mock.calls.length;
    initPWAListeners();
    const count2 = addEventListenerSpy.mock.calls.length;
    expect(count2).toBe(count1);
  });

  it('beforeinstallprompt handler calls captureInstallEvent', async () => {
    const { captureInstallEvent } = await import('../installPromptStore');
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const handler = addEventListenerSpy.mock.calls.find(c => c[0] === 'beforeinstallprompt')![1] as EventListener;
    const fakeEvent = new Event('beforeinstallprompt');
    handler(fakeEvent);
    expect(captureInstallEvent).toHaveBeenCalledWith(fakeEvent);
  });

  it('appinstalled handler calls markInstalled', async () => {
    const { markInstalled } = await import('../installPromptStore');
    const { initPWAListeners } = await import('../pwaLifecycle');
    initPWAListeners();
    const handler = addEventListenerSpy.mock.calls.find(c => c[0] === 'appinstalled')![1] as EventListener;
    handler(new Event('appinstalled'));
    expect(markInstalled).toHaveBeenCalledTimes(1);
  });
});
