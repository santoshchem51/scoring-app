import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@solidjs/testing-library';

// Mock useAuth — return a signed-in user by default
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1', displayName: 'Test', email: 'test@test.com', photoURL: null }),
    loading: () => false,
    syncing: () => false,
    syncError: () => false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Mock useSyncStatus — use let variables so tests can override before import
let mockSyncStatusValue = 'idle';
let mockFailedCountValue = 0;
vi.mock('../../../data/firebase/useSyncStatus', () => ({
  syncStatus: () => mockSyncStatusValue,
  pendingCount: () => 0,
  failedCount: () => mockFailedCountValue,
}));

vi.mock('../../../data/firebase/syncProcessor', () => ({
  wakeProcessor: vi.fn(),
}));

vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

// Mock lucide-solid icons
vi.mock('lucide-solid', () => ({
  User: () => <span>UserIcon</span>,
  Settings: () => <span>SettingsIcon</span>,
  Bell: () => <span>BellIcon</span>,
}));

// Mock notification store (TopNav now imports it)
vi.mock('../../../features/notifications/store/notificationStore', () => ({
  unreadCount: () => 0,
  filteredNotifications: () => [],
  notificationsReady: () => true,
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

// Mock NotificationPanel component
vi.mock('../../../features/notifications/components/NotificationPanel', () => ({
  default: (props: any) => <div data-testid="notification-panel">Panel</div>,
}));

describe('TopNav sync indicator', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSyncStatusValue = 'idle';
    mockFailedCountValue = 0;
  });

  it('shows no indicator when idle', async () => {
    mockSyncStatusValue = 'idle';
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    expect(container.querySelector('[data-testid="sync-indicator"]')).toBeNull();
  });

  it('shows pulsing dot when processing', async () => {
    mockSyncStatusValue = 'processing';
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const dot = container.querySelector('[data-testid="sync-indicator"]');
    expect(dot).not.toBeNull();
  });

  it('shows dot when pending', async () => {
    mockSyncStatusValue = 'pending';
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const dot = container.querySelector('[data-testid="sync-indicator"]');
    expect(dot).not.toBeNull();
  });

  it('shows amber dot when failed', async () => {
    mockSyncStatusValue = 'failed';
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const dot = container.querySelector('[data-testid="sync-indicator"]');
    expect(dot).not.toBeNull();
  });

  it('sync indicator has accessible label for processing state', async () => {
    mockSyncStatusValue = 'processing';
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const indicator = container.querySelector('[data-testid="sync-indicator"]');
    expect(indicator).not.toBeNull();
    expect(indicator!.getAttribute('role')).toBe('status');
    expect(indicator!.getAttribute('aria-label')).toBe('Syncing');
  });

  it('sync indicator has accessible label for failed state', async () => {
    mockSyncStatusValue = 'failed';
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const indicator = container.querySelector('[data-testid="sync-indicator"]');
    expect(indicator).not.toBeNull();
    expect(indicator!.getAttribute('role')).toBe('status');
    expect(indicator!.getAttribute('aria-label')).toBe('Sync failed');
  });

  it('sync indicator has accessible label for pending state', async () => {
    mockSyncStatusValue = 'pending';
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const indicator = container.querySelector('[data-testid="sync-indicator"]');
    expect(indicator).not.toBeNull();
    expect(indicator!.getAttribute('role')).toBe('status');
    expect(indicator!.getAttribute('aria-label')).toBe('Sync pending');
  });
});
