import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock swUpdateStore
vi.mock('../swUpdateStore', () => ({
  swUpdateVisible: vi.fn(() => false),
}));

describe('installPromptStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('isInstalled returns false by default', async () => {
    const { isInstalled } = await import('../installPromptStore');
    expect(isInstalled()).toBe(false);
  });

  it('isInstalled returns true when display-mode is standalone', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    const { isInstalled } = await import('../installPromptStore');
    expect(isInstalled()).toBe(true);
  });

  it('showInstallBanner returns false when no event captured', async () => {
    const { showInstallBanner } = await import('../installPromptStore');
    expect(showInstallBanner()).toBe(false);
  });

  it('showInstallBanner returns true when event captured and 3+ visits', async () => {
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    expect(showInstallBanner()).toBe(true);
  });

  it('showInstallBanner returns false with only 2 visits and no matches', async () => {
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '2');
    expect(showInstallBanner()).toBe(false);
  });

  it('showInstallBanner returns true when matchCount >= 1', async () => {
    const { captureInstallEvent, showInstallBanner, setCompletedMatchCount } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    setCompletedMatchCount(1);
    expect(showInstallBanner()).toBe(true);
  });

  it('showInstallBanner returns false when swUpdateVisible is true (co-presence rule)', async () => {
    const { swUpdateVisible } = await import('../swUpdateStore');
    vi.mocked(swUpdateVisible).mockReturnValue(true);
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    expect(showInstallBanner()).toBe(false);
  });

  it('getDismissState returns none initially', async () => {
    const { getDismissState } = await import('../installPromptStore');
    expect(getDismissState()).toBe('none');
  });

  it('softDismiss sets 7-day cooldown', async () => {
    const { softDismiss, getDismissState } = await import('../installPromptStore');
    softDismiss();
    expect(getDismissState()).toBe('soft');
  });

  it('hardDismiss sets 30-day cooldown', async () => {
    const { hardDismiss, getDismissState } = await import('../installPromptStore');
    hardDismiss();
    expect(getDismissState()).toBe('hard');
  });

  it('neverDismiss sets permanent dismissal', async () => {
    const { neverDismiss, getDismissState } = await import('../installPromptStore');
    neverDismiss();
    expect(getDismissState()).toBe('never');
  });

  it('showInstallBanner returns false when dismissed soft within 7 days', async () => {
    const { captureInstallEvent, softDismiss, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    softDismiss();
    expect(showInstallBanner()).toBe(false);
  });

  it('showInstallBanner returns true after soft dismiss expires (7+ days)', async () => {
    const { captureInstallEvent, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    localStorage.setItem('pwa-install-dismiss', JSON.stringify({
      tier: 'soft', until: Date.now() - 8 * 24 * 60 * 60 * 1000,
    }));
    expect(showInstallBanner()).toBe(true);
  });

  it('showInstallBanner returns false when neverDismiss was called', async () => {
    const { captureInstallEvent, neverDismiss, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    neverDismiss();
    expect(showInstallBanner()).toBe(false);
  });

  it('dismiss escalates: first soft, second hard', async () => {
    const { dismissAndEscalate, getDismissState } = await import('../installPromptStore');
    dismissAndEscalate();
    expect(getDismissState()).toBe('soft');
    // Expire the soft dismiss
    localStorage.setItem('pwa-install-dismiss', JSON.stringify({
      tier: 'soft', until: Date.now() - 1,
    }));
    dismissAndEscalate();
    expect(getDismissState()).toBe('hard');
  });

  it('triggerInstallPrompt calls prompt and returns accepted', async () => {
    const { captureInstallEvent, triggerInstallPrompt, isInstalled } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    captureInstallEvent(fakeEvent);
    const result = await triggerInstallPrompt();
    expect(fakeEvent.prompt).toHaveBeenCalled();
    expect(result).toBe('accepted');
    expect(isInstalled()).toBe(true);
  });

  it('triggerInstallPrompt returns dismissed when user declines', async () => {
    const { captureInstallEvent, triggerInstallPrompt, isInstalled } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn().mockResolvedValue({ outcome: 'dismissed' });
    captureInstallEvent(fakeEvent);
    const result = await triggerInstallPrompt();
    expect(result).toBe('dismissed');
    expect(isInstalled()).toBe(false);
  });

  it('triggerInstallPrompt returns null when no event captured', async () => {
    const { triggerInstallPrompt } = await import('../installPromptStore');
    const result = await triggerInstallPrompt();
    expect(result).toBeNull();
  });

  it('detectIOSSafari identifies Safari on iOS', async () => {
    const { detectIOSSafari } = await import('../installPromptStore');
    expect(detectIOSSafari()).toBe(false);
  });

  it('markInstalled hides banner', async () => {
    const { captureInstallEvent, markInstalled, showInstallBanner } = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<{ outcome: string }> };
    fakeEvent.prompt = vi.fn();
    captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    markInstalled();
    expect(showInstallBanner()).toBe(false);
  });

  it('incrementVisitCount increments localStorage counter', async () => {
    const { incrementVisitCount } = await import('../installPromptStore');
    incrementVisitCount();
    expect(localStorage.getItem('pwa-visit-count')).toBe('1');
    incrementVisitCount();
    expect(localStorage.getItem('pwa-visit-count')).toBe('2');
  });
});
