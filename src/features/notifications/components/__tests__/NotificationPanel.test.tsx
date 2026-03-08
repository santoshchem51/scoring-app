import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import type { AppNotification } from '../../../../data/types';

// ── Mock the notification store ──

const mockFilteredNotifications = vi.fn<() => AppNotification[]>(() => []);
const mockNotificationsReady = vi.fn<() => boolean>(() => true);
const mockUnreadCount = vi.fn<() => number>(() => 0);
const mockMarkNotificationRead = vi.fn().mockResolvedValue(undefined);
const mockMarkAllNotificationsRead = vi.fn().mockResolvedValue(undefined);

vi.mock('../../store/notificationStore', () => ({
  filteredNotifications: () => mockFilteredNotifications(),
  notificationsReady: () => mockNotificationsReady(),
  unreadCount: () => mockUnreadCount(),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) => mockMarkAllNotificationsRead(...args),
}));

// ── Mock NotificationRow to keep tests focused ──

vi.mock('../NotificationRow', () => ({
  default: (props: { notification: AppNotification; onRead: (id: string) => void }) => (
    <li data-testid={`row-${props.notification.id}`}>{props.notification.message}</li>
  ),
}));

import NotificationPanel from '../NotificationPanel';

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'session_proposed',
    category: 'buddy',
    message: 'Alice proposed Tue Doubles',
    actionUrl: '/session/s1',
    payload: { actorId: 'actor-1', actorName: 'Alice' },
    read: false,
    createdAt: Date.now() - 60_000,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilteredNotifications.mockReturnValue([]);
    mockNotificationsReady.mockReturnValue(true);
    mockUnreadCount.mockReturnValue(0);
    mockMarkNotificationRead.mockResolvedValue(undefined);
    mockMarkAllNotificationsRead.mockResolvedValue(undefined);
  });

  it('renders with role="dialog"', () => {
    render(() => (
      <NotificationPanel open={true} onClose={vi.fn()} uid="user-1" />
    ));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal="true"', () => {
    render(() => (
      <NotificationPanel open={true} onClose={vi.fn()} uid="user-1" />
    ));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('focuses the panel on open', async () => {
    render(() => (
      <NotificationPanel open={true} onClose={vi.fn()} uid="user-1" />
    ));

    const dialog = screen.getByRole('dialog');

    await waitFor(() => {
      expect(document.activeElement).toBe(dialog);
    });
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(() => (
      <NotificationPanel open={true} onClose={onClose} uid="user-1" />
    ));

    const dialog = screen.getByRole('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mark-all-read button calls markAllNotificationsRead', async () => {
    mockUnreadCount.mockReturnValue(3);
    mockFilteredNotifications.mockReturnValue([
      makeNotification({ id: 'n1', read: false }),
    ]);

    render(() => (
      <NotificationPanel open={true} onClose={vi.fn()} uid="user-1" />
    ));

    const btn = screen.getByText('Mark all read');
    await fireEvent.click(btn);

    expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith('user-1');
  });

  it('mark-all-read button is disabled while in-flight', async () => {
    mockUnreadCount.mockReturnValue(3);

    // Create a deferred promise so we control when it resolves
    let resolveMarkAll!: () => void;
    const deferred = new Promise<void>((resolve) => {
      resolveMarkAll = resolve;
    });
    mockMarkAllNotificationsRead.mockReturnValue(deferred);

    render(() => (
      <NotificationPanel open={true} onClose={vi.fn()} uid="user-1" />
    ));

    const btn = screen.getByText('Mark all read');
    await fireEvent.click(btn);

    // Button should be disabled while the promise is pending
    expect(btn).toBeDisabled();

    // Resolve the promise
    resolveMarkAll();
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it('shows "No notifications yet" when filteredNotifications is empty', () => {
    mockFilteredNotifications.mockReturnValue([]);

    render(() => (
      <NotificationPanel open={true} onClose={vi.fn()} uid="user-1" />
    ));

    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  it('shows loading skeleton when notificationsReady is false', () => {
    mockNotificationsReady.mockReturnValue(false);

    const { container } = render(() => (
      <NotificationPanel open={true} onClose={vi.fn()} uid="user-1" />
    ));

    // Skeleton should be present (animated pulse placeholder)
    const skeleton = container.querySelector('[data-testid="notification-skeleton"]');
    expect(skeleton).toBeInTheDocument();

    // Should NOT show "No notifications yet"
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
  });

  it('hides mark-all-read when unreadCount is 0', () => {
    mockUnreadCount.mockReturnValue(0);

    render(() => (
      <NotificationPanel open={true} onClose={vi.fn()} uid="user-1" />
    ));

    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
  });
});
