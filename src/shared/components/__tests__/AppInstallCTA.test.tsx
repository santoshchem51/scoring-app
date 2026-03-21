import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@solidjs/testing-library';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('../../pwa/installPromptStore', () => ({
  isInstalled: () => false,
}));

describe('AppInstallCTA', () => {
  beforeEach(() => { vi.resetModules(); });

  it('renders Play Store badge for Android mobile web', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
      configurable: true,
    });

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { queryByText } = render(() => <AppInstallCTA />);
    expect(queryByText('Get it on Google Play')).toBeTruthy();
  });

  it('renders iOS install button for iPhone', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      configurable: true,
    });

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { queryByText } = render(() => <AppInstallCTA />);
    expect(queryByText('Install PickleScore')).toBeTruthy();
  });

  it('renders nothing when IS_NATIVE is true', async () => {
    vi.doMock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { container } = render(() => <AppInstallCTA />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on desktop', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { container } = render(() => <AppInstallCTA />);
    expect(container.innerHTML).toBe('');
  });
});
