import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import NotificationRow from '../NotificationRow';
import type { AppNotification } from '../../../../data/types';

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
    createdAt: Date.now() - 60_000, // 1 minute ago
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

describe('NotificationRow', () => {
  it('renders message', () => {
    render(() => (
      <NotificationRow
        notification={makeNotification({ message: 'Alice proposed a session' })}
        onRead={vi.fn()}
      />
    ));

    expect(screen.getByText('Alice proposed a session')).toBeInTheDocument();
  });

  it('renders relative time', () => {
    render(() => (
      <NotificationRow
        notification={makeNotification({ createdAt: Date.now() - 60_000 })}
        onRead={vi.fn()}
      />
    ));

    expect(screen.getByText('1m ago')).toBeInTheDocument();
  });

  it('shows unread dot when read is false', () => {
    const { container } = render(() => (
      <NotificationRow
        notification={makeNotification({ read: false })}
        onRead={vi.fn()}
      />
    ));

    const dot = container.querySelector('.bg-accent');
    expect(dot).toBeInTheDocument();
  });

  it('hides unread dot when read is true', () => {
    const { container } = render(() => (
      <NotificationRow
        notification={makeNotification({ read: true })}
        onRead={vi.fn()}
      />
    ));

    const dot = container.querySelector('.bg-accent');
    expect(dot).not.toBeInTheDocument();
  });

  it('applies font-medium for unread, not for read', () => {
    const { container: unreadContainer } = render(() => (
      <NotificationRow
        notification={makeNotification({ read: false })}
        onRead={vi.fn()}
      />
    ));
    const unreadMessage = unreadContainer.querySelector('.font-medium');
    expect(unreadMessage).toBeInTheDocument();

    const { container: readContainer } = render(() => (
      <NotificationRow
        notification={makeNotification({ read: true })}
        onRead={vi.fn()}
      />
    ));
    const readMessage = readContainer.querySelector('.font-medium');
    expect(readMessage).not.toBeInTheDocument();
  });

  it('calls onRead with notification id when clicked', async () => {
    const onRead = vi.fn();
    render(() => (
      <NotificationRow
        notification={makeNotification({ id: 'notif-42' })}
        onRead={onRead}
      />
    ));

    const row = screen.getByRole('listitem');
    await fireEvent.click(row);

    expect(onRead).toHaveBeenCalledWith('notif-42');
  });

  it('does not render anchor when actionUrl is undefined', () => {
    const { container } = render(() => (
      <NotificationRow
        notification={makeNotification({ actionUrl: undefined })}
        onRead={vi.fn()}
      />
    ));

    const anchor = container.querySelector('a');
    expect(anchor).not.toBeInTheDocument();
  });

  it('includes read/unread state in aria-label', () => {
    const { unmount } = render(() => (
      <NotificationRow
        notification={makeNotification({ read: false })}
        onRead={vi.fn()}
      />
    ));

    const unreadRow = screen.getByRole('listitem');
    expect(unreadRow.getAttribute('aria-label')).toContain('unread');
    unmount();

    render(() => (
      <NotificationRow
        notification={makeNotification({ read: true })}
        onRead={vi.fn()}
      />
    ));

    const readRow = screen.getByRole('listitem');
    expect(readRow.getAttribute('aria-label')).toContain('read');
  });
});
