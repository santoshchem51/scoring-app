import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

// Mock useAuth — return a signed-in user by default
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1', displayName: 'Test', email: 'test@test.com', photoURL: null }),
    loading: () => false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Need to mock notification store with controllable unreadCount
let mockUnreadCountValue = 0;
vi.mock('../../../features/notifications/store/notificationStore', () => ({
  unreadCount: () => mockUnreadCountValue,
  filteredNotifications: () => [],
  notificationsReady: () => true,
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock('../../../data/firebase/useSyncStatus', () => ({
  syncStatus: () => 'idle',
  pendingCount: () => 0,
  failedCount: () => 0,
}));

vi.mock('../../../data/firebase/syncProcessor', () => ({
  wakeProcessor: vi.fn(),
}));

vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock('lucide-solid', () => ({
  User: () => <span>UserIcon</span>,
  Settings: () => <span>SettingsIcon</span>,
  Bell: () => <span data-testid="bell-icon">BellIcon</span>,
}));

vi.mock('../../../features/notifications/components/NotificationPanel', () => ({
  default: (props: any) => <div data-testid="notification-panel">Panel</div>,
}));

describe('TopNav bell icon', () => {
  beforeEach(() => {
    vi.resetModules();
    mockUnreadCountValue = 0;
  });

  it('bell badge hidden when unread is 0', async () => {
    mockUnreadCountValue = 0;
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    expect(container.querySelector('[data-testid="bell-badge"]')).toBeNull();
  });

  it('bell shows count 1-9', async () => {
    mockUnreadCountValue = 5;
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const badge = container.querySelector('[data-testid="bell-badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('5');
  });

  it('bell shows "9+" at 10+', async () => {
    mockUnreadCountValue = 15;
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const badge = container.querySelector('[data-testid="bell-badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('9+');
  });

  it('bell opens panel on click', async () => {
    mockUnreadCountValue = 0;
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const bellButton = container.querySelector('[aria-label="Notifications"]') as HTMLElement;
    expect(bellButton).not.toBeNull();

    await fireEvent.click(bellButton);

    const panel = container.querySelector('[data-testid="notification-panel"]');
    expect(panel).not.toBeNull();
  });

  it('bell has correct ARIA attributes', async () => {
    mockUnreadCountValue = 0;
    const { default: TopNav } = await import('../TopNav');
    const { container } = render(() => <TopNav />);
    const bellButton = container.querySelector('[aria-label="Notifications"]') as HTMLElement;
    expect(bellButton).not.toBeNull();
    expect(bellButton.getAttribute('aria-label')).toBe('Notifications');
    expect(bellButton.getAttribute('aria-haspopup')).toBe('dialog');
    expect(bellButton.getAttribute('aria-expanded')).toBe('false');
  });
});
