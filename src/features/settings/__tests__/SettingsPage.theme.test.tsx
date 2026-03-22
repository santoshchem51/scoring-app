import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { settings, setSettings } from '../../../stores/settingsStore';

// ── Mock dependencies ──

vi.mock('../../../data/firebase/config', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  firestore: {},
  functions: {},
}));

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

import SettingsPage from '../SettingsPage';

describe('SettingsPage theme picker', () => {
  beforeEach(() => {
    localStorage.clear();
    setSettings({ theme: 'court-vision-gold' });
  });

  it('renders 3 theme cards', () => {
    const { container } = render(() => <SettingsPage />);
    const themeButtons = container.querySelectorAll('[aria-pressed]');
    const themeLabels = ['Court Vision Gold', 'Classic', 'Ember'];
    let found = 0;
    themeButtons.forEach((btn) => {
      if (themeLabels.some((label) => btn.textContent?.includes(label))) {
        found++;
      }
    });
    expect(found).toBe(3);
  });

  it('clicking a theme card calls setSettings with correct theme', () => {
    const { container } = render(() => <SettingsPage />);

    const buttons = Array.from(container.querySelectorAll('[aria-pressed]'));
    const classicBtn = buttons.find((btn) => btn.textContent?.includes('Classic'));
    expect(classicBtn).toBeTruthy();
    fireEvent.click(classicBtn!);
    expect(settings().theme).toBe('classic');
  });

  it('selected card shows Selected label', () => {
    const { container } = render(() => <SettingsPage />);

    const buttons = Array.from(container.querySelectorAll('[aria-pressed="true"]'));
    const cvgBtn = buttons.find((btn) => btn.textContent?.includes('Court Vision Gold'));
    expect(cvgBtn?.textContent).toContain('Selected');
  });
});
