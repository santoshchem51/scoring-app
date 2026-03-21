import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@solidjs/testing-library';
import { setSettings } from '../../stores/settingsStore';

// ── Mock dependencies ──

vi.mock('../../shared/components/BottomNav', () => ({
  default: () => <nav data-testid="bottom-nav">Nav</nav>,
}));

vi.mock('../../shared/hooks/useTheme', () => ({
  useTheme: () => {},
}));

vi.mock('../../shared/components/Skeleton', () => ({
  PageSkeleton: () => <div>Skeleton</div>,
}));

vi.mock('../../features/achievements/components/AchievementToast', () => ({
  default: () => <div>AchievementToast</div>,
}));

vi.mock('../../shared/pwa/SWUpdateToast', () => ({
  default: () => <div>SWUpdateToast</div>,
}));

vi.mock('../../shared/pwa/InstallPromptBanner', () => ({
  default: () => <div>InstallPromptBanner</div>,
}));

vi.mock('../../shared/pwa/swUpdateStore', () => ({
  initSWUpdate: vi.fn(),
}));

vi.mock('../../shared/pwa/installPromptStore', () => ({
  showInstallBanner: () => false,
}));

vi.mock('../../shared/platform/appLifecycle', () => ({
  initAppLifecycle: vi.fn(),
}));

vi.mock('../../shared/platform/splashScreen', () => ({
  hideSplashScreen: vi.fn(),
}));

vi.mock('../../shared/observability/ErrorBoundary', () => ({
  ObservableErrorBoundary: (props: any) => <div>{props.children}</div>,
}));

vi.mock('@solidjs/router', () => ({
  useLocation: () => ({ pathname: '/settings' }),
}));

import App from '../App';

describe('App consent dialog wiring', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows ConsentDialog when analyticsConsent is pending', () => {
    setSettings({ analyticsConsent: 'pending' });
    const { getByText } = render(() => <App />);
    expect(getByText('Help Improve PickleScore')).toBeTruthy();
  });

  it('hides ConsentDialog when analyticsConsent is accepted', () => {
    setSettings({ analyticsConsent: 'accepted', analyticsConsentTimestamp: Date.now() });
    const { queryByText } = render(() => <App />);
    expect(queryByText('Help Improve PickleScore')).toBeNull();
  });

  it('hides ConsentDialog when analyticsConsent is declined', () => {
    setSettings({ analyticsConsent: 'declined', analyticsConsentTimestamp: Date.now() });
    const { queryByText } = render(() => <App />);
    expect(queryByText('Help Improve PickleScore')).toBeNull();
  });

  it('clicking Accept updates settings to accepted', async () => {
    setSettings({ analyticsConsent: 'pending' });
    const { getByText } = render(() => <App />);
    const acceptBtn = getByText('Accept');
    acceptBtn.click();
    const { settings } = await import('../../stores/settingsStore');
    expect(settings().analyticsConsent).toBe('accepted');
    expect(settings().analyticsConsentTimestamp).toBeGreaterThan(0);
  });

  it('clicking Decline updates settings to declined', async () => {
    setSettings({ analyticsConsent: 'pending' });
    const { getByText } = render(() => <App />);
    const declineBtn = getByText('Decline');
    declineBtn.click();
    const { settings } = await import('../../stores/settingsStore');
    expect(settings().analyticsConsent).toBe('declined');
    expect(settings().analyticsConsentTimestamp).toBeGreaterThan(0);
  });
});
