import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { settings, setSettings } from '../../../stores/settingsStore';

// ── Mock dependencies ──

vi.mock('../../../data/firebase/config', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  firestore: {},
  functions: {},
}));

vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1', displayName: 'Test', email: 'test@test.com', photoURL: null }),
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

describe('SettingsPage — Notification Preferences', () => {
  beforeEach(() => {
    // Reset notification settings to defaults (all true)
    setSettings({
      notifyBuddy: true,
      notifyTournament: true,
      notifyAchievement: true,
      notifyStats: true,
    });
  });

  it('toggles render with correct initial state (all checked)', () => {
    render(() => <SettingsPage />);

    const switches = screen.getAllByRole('switch');
    // Find the notification toggles by their label text
    const buddyToggle = screen.getByText('Buddy activity').closest('[role="switch"]')!;
    const tournamentToggle = screen.getByText('Tournament updates').closest('[role="switch"]')!;
    const achievementToggle = screen.getByText('Achievements').closest('[role="switch"]')!;
    const statsToggle = screen.getByText('Stats changes').closest('[role="switch"]')!;

    expect(buddyToggle.getAttribute('aria-checked')).toBe('true');
    expect(tournamentToggle.getAttribute('aria-checked')).toBe('true');
    expect(achievementToggle.getAttribute('aria-checked')).toBe('true');
    expect(statsToggle.getAttribute('aria-checked')).toBe('true');
  });

  it('toggling a notification preference updates the settings store', async () => {
    render(() => <SettingsPage />);

    const buddyToggle = screen.getByText('Buddy activity').closest('[role="switch"]')!;
    expect(buddyToggle.getAttribute('aria-checked')).toBe('true');

    await fireEvent.click(buddyToggle);

    expect(buddyToggle.getAttribute('aria-checked')).toBe('false');
    expect(settings().notifyBuddy).toBe(false);
  });

  it('all 4 notification categories are present', () => {
    render(() => <SettingsPage />);

    expect(screen.getByText('Buddy activity')).toBeInTheDocument();
    expect(screen.getByText('Tournament updates')).toBeInTheDocument();
    expect(screen.getByText('Achievements')).toBeInTheDocument();
    expect(screen.getByText('Stats changes')).toBeInTheDocument();
  });
});
