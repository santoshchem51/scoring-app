import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import SettingsPage from '../SettingsPage';

vi.mock('../../../data/firebase/useSyncStatus', () => ({
  syncStatus: () => 'idle',
  pendingCount: () => 0,
  failedCount: () => 0,
}));

vi.mock('../../../data/firebase/syncProcessor', () => ({
  wakeProcessor: vi.fn(),
}));

vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1' }),
    loading: () => false,
    syncing: () => false,
    syncError: () => false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../stores/settingsStore', () => ({
  settings: () => ({
    displayMode: 'dark',
    keepScreenAwake: true,
    soundEffects: 'off',
    hapticFeedback: false,
    voiceAnnouncements: 'off',
    voiceUri: '',
    voiceRate: 1.0,
    voicePitch: 1.0,
    defaultScoringMode: 'sideout',
    defaultPointsToWin: 11,
    defaultMatchFormat: 'single',
  }),
  setSettings: vi.fn(),
}));

vi.mock('../../../shared/components/PageLayout', () => ({
  default: (props: { children: JSX.Element }) => <div>{props.children}</div>,
}));

vi.mock('../../../shared/components/OptionCard', () => ({
  default: (props: { label: string }) => <div>{props.label}</div>,
}));

vi.mock('../../../shared/components/Logo', () => ({
  default: () => <div>Logo</div>,
}));

vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; children: JSX.Element }) => <a href={props.href}>{props.children}</a>,
}));

describe('SettingsPage Cloud Sync section', () => {
  it('renders Cloud Sync heading when user is signed in', () => {
    render(() => <SettingsPage />);
    expect(screen.getByText('Cloud Sync')).toBeDefined();
  });

  it('renders Sync Now button', () => {
    render(() => <SettingsPage />);
    expect(screen.getByRole('button', { name: /sync now/i })).toBeDefined();
  });
});
