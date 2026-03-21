import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { settings, setSettings } from '../../../stores/settingsStore';

// ── Mock dependencies ──

vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => null,
    loading: () => false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../shared/components/PageLayout', () => ({
  default: (props: any) => <div>{props.children}</div>,
}));

vi.mock('../../../shared/components/OptionCard', () => ({
  default: (props: any) => <button onClick={props.onClick}>{props.label}</button>,
}));

vi.mock('../../../shared/components/Logo', () => ({
  default: () => <span>Logo</span>,
}));

vi.mock('../../../shared/pwa/InstallPromptBanner', () => ({
  default: () => <div data-testid="install-banner">InstallPromptBanner</div>,
}));

vi.mock('../../../data/firebase/useSyncStatus', () => ({
  syncStatus: () => 'idle',
  pendingCount: () => 0,
  failedCount: () => 0,
}));

vi.mock('../../../data/firebase/syncProcessor', () => ({
  wakeProcessor: vi.fn(),
}));

vi.mock('../../../shared/observability/consentCleanup', () => ({
  revokeObservabilityConsent: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/observability/sentry', () => ({
  initSentry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../DeleteAccountButton', () => ({
  DeleteAccountButton: () => <button>Delete Account</button>,
}));

vi.mock('../../../shared/utils/shareApp', () => ({
  shareApp: vi.fn(),
}));

import SettingsPage from '../SettingsPage';

describe('SettingsPage analytics toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    setSettings({ analyticsConsent: 'accepted', analyticsConsentTimestamp: Date.now() });
  });

  it('renders the analytics toggle', () => {
    const { getByText } = render(() => <SettingsPage />);
    expect(getByText('Share usage data & crash reports')).toBeTruthy();
  });

  it('shows toggle as ON when consent is accepted', () => {
    const { getByRole } = render(() => <SettingsPage />);
    const toggle = getByRole('switch', { name: /share usage data/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('shows toggle as OFF when consent is declined', () => {
    setSettings({ analyticsConsent: 'declined', analyticsConsentTimestamp: Date.now() });
    const { getByRole } = render(() => <SettingsPage />);
    const toggle = getByRole('switch', { name: /share usage data/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('shows toggle as OFF when consent is pending', () => {
    setSettings({ analyticsConsent: 'pending', analyticsConsentTimestamp: null });
    const { getByRole } = render(() => <SettingsPage />);
    const toggle = getByRole('switch', { name: /share usage data/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('toggling OFF sets consent to declined and records timestamp', () => {
    setSettings({ analyticsConsent: 'accepted', analyticsConsentTimestamp: 1000 });
    const { getByRole } = render(() => <SettingsPage />);
    const toggle = getByRole('switch', { name: /share usage data/i });
    fireEvent.click(toggle);
    expect(settings().analyticsConsent).toBe('declined');
    expect(settings().analyticsConsentTimestamp).toBeGreaterThan(1000);
  });

  it('toggling ON sets consent to accepted and records timestamp', () => {
    setSettings({ analyticsConsent: 'declined', analyticsConsentTimestamp: 1000 });
    const { getByRole } = render(() => <SettingsPage />);
    const toggle = getByRole('switch', { name: /share usage data/i });
    fireEvent.click(toggle);
    expect(settings().analyticsConsent).toBe('accepted');
    expect(settings().analyticsConsentTimestamp).toBeGreaterThan(1000);
  });

  it('toggling ON calls initSentry to activate error tracking', async () => {
    const { initSentry } = await import('../../../shared/observability/sentry');
    vi.mocked(initSentry).mockClear();

    setSettings({ analyticsConsent: 'declined', analyticsConsentTimestamp: 1000 });
    const { getByRole } = render(() => <SettingsPage />);
    const toggle = getByRole('switch', { name: /share usage data/i });
    fireEvent.click(toggle);
    expect(initSentry).toHaveBeenCalledTimes(1);
  });
});
