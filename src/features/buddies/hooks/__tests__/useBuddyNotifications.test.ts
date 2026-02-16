import { renderHook } from '@solidjs/testing-library';
import { useBuddyNotifications } from '../useBuddyNotifications';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock('../../../../data/firebase/config', () => ({ firestore: {} }));

import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const mockOnSnapshot = vi.mocked(onSnapshot);
const mockCollection = vi.mocked(collection);
const mockQuery = vi.mocked(query);
const mockOrderBy = vi.mocked(orderBy);
const mockLimit = vi.mocked(limit);

describe('useBuddyNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockCollection.mockReturnValue('collectionRef' as any);
    mockQuery.mockReturnValue('queryRef' as any);
    mockOrderBy.mockReturnValue('orderByClause' as any);
    mockLimit.mockReturnValue('limitClause' as any);
  });

  it('returns empty notifications when userId is undefined', () => {
    const { result } = renderHook(useBuddyNotifications, [() => undefined]);
    expect(result.notifications()).toEqual([]);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('returns 0 unreadCount when userId is undefined', () => {
    const { result } = renderHook(useBuddyNotifications, [() => undefined]);
    expect(result.unreadCount()).toBe(0);
  });

  it('calls onSnapshot when userId is provided', () => {
    renderHook(useBuddyNotifications, [() => 'user-456']);

    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'user-456', 'buddyNotifications');
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(mockQuery).toHaveBeenCalledWith('collectionRef', 'orderByClause', 'limitClause');
    expect(mockOnSnapshot).toHaveBeenCalledWith('queryRef', expect.any(Function));
  });

  it('populates notifications from snapshot data', () => {
    const { result } = renderHook(useBuddyNotifications, [() => 'user-456']);

    const snapshotCallback = mockOnSnapshot.mock.calls[0][1] as Function;
    snapshotCallback({
      docs: [
        {
          id: 'notif-1',
          data: () => ({
            type: 'session_proposed',
            message: 'New game Friday',
            read: false,
            actorName: 'Alice',
            createdAt: 1000,
          }),
        },
        {
          id: 'notif-2',
          data: () => ({
            type: 'player_joined',
            message: 'Bob joined',
            read: true,
            actorName: 'Bob',
            createdAt: 900,
          }),
        },
      ],
    });

    expect(result.notifications()).toHaveLength(2);
    expect(result.notifications()[0]).toEqual({
      id: 'notif-1',
      type: 'session_proposed',
      message: 'New game Friday',
      read: false,
      actorName: 'Alice',
      createdAt: 1000,
    });
  });

  it('computes unreadCount from notifications', () => {
    const { result } = renderHook(useBuddyNotifications, [() => 'user-456']);

    const snapshotCallback = mockOnSnapshot.mock.calls[0][1] as Function;
    snapshotCallback({
      docs: [
        { id: 'n1', data: () => ({ read: false, type: 'session_proposed', actorName: 'A', message: 'm', createdAt: 1 }) },
        { id: 'n2', data: () => ({ read: false, type: 'player_joined', actorName: 'B', message: 'm', createdAt: 2 }) },
        { id: 'n3', data: () => ({ read: true, type: 'session_confirmed', actorName: 'C', message: 'm', createdAt: 3 }) },
      ],
    });

    expect(result.unreadCount()).toBe(2);
  });

  it('cleans up subscription on unmount', () => {
    const unsubscribeMock = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribeMock);

    const { cleanup } = renderHook(useBuddyNotifications, [() => 'user-456']);

    expect(unsubscribeMock).not.toHaveBeenCalled();
    cleanup();
    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });
});
