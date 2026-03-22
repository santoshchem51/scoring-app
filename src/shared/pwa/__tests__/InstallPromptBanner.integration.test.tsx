import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

// Mock only external dependencies, NOT the store itself
vi.mock('../swUpdateStore', () => ({
  swUpdateVisible: vi.fn(() => false),
}));

vi.mock('../../platform/platform', () => ({
  IS_NATIVE: false,
}));

vi.mock('../../observability/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('InstallPromptBanner integration (real store)', () => {
  beforeEach(() => {
    vi.resetModules();
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

  async function setupBannerVisible() {
    const store = await import('../installPromptStore');
    const fakeEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<{ outcome: string }>;
    };
    fakeEvent.prompt = vi.fn().mockResolvedValue({ outcome: 'dismissed' });
    store.captureInstallEvent(fakeEvent);
    localStorage.setItem('pwa-visit-count', '3');
    return store;
  }

  it('banner disappears after clicking "Not now"', async () => {
    await setupBannerVisible();
    const InstallPromptBanner = (await import('../InstallPromptBanner')).default;

    render(() => <InstallPromptBanner />);

    // Banner should be visible
    expect(screen.getByRole('banner', { name: /install app/i })).toBeTruthy();

    // Click "Not now"
    fireEvent.click(screen.getByRole('button', { name: /not now/i }));

    // Banner should disappear
    await waitFor(() => {
      expect(screen.queryByRole('banner', { name: /install app/i })).toBeNull();
    });
  });

  it('banner disappears after clicking "Don\'t ask again"', async () => {
    await setupBannerVisible();
    const InstallPromptBanner = (await import('../InstallPromptBanner')).default;

    render(() => <InstallPromptBanner />);

    // Banner should be visible
    expect(screen.getByRole('banner', { name: /install app/i })).toBeTruthy();

    // Click "Don't ask again"
    fireEvent.click(screen.getByRole('button', { name: /don.t ask again/i }));

    // Banner should disappear
    await waitFor(() => {
      expect(screen.queryByRole('banner', { name: /install app/i })).toBeNull();
    });
  });
});
