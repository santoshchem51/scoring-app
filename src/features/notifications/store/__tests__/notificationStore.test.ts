import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppNotification } from '../../../../data/types';

// Mock Firestore — use vi.hoisted for stable references across vi.resetModules()
const { mockOnSnapshot, mockUpdateDoc, mockGetDocs, mockDeleteDoc, mockWriteBatch,
  mockDoc, mockCollection, mockQuery, mockWhere, mockOrderBy, mockLimit } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockWriteBatch: vi.fn(() => ({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  mockDoc: vi.fn((...args: unknown[]) => args.join('/')),
  mockCollection: vi.fn((...args: unknown[]) => args.join('/')),
  mockQuery: vi.fn((...args: unknown[]) => args[0]),
  mockWhere: vi.fn(),
  mockOrderBy: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
}));

vi.mock('../../../../data/firebase/config', () => ({
  firestore: {},
}));

vi.mock('../../../../stores/settingsStore', () => ({
  settings: () => ({
    notifyBuddy: true,
    notifyTournament: true,
    notifyAchievement: true,
    notifyStats: true,
  }),
}));

function makeTestNotif(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    userId: 'u1',
    category: 'buddy',
    type: 'session_proposed',
    message: 'Test notification',
    actionUrl: '/session/s1',
    payload: { sessionId: 's1' },
    read: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

// Match real Firestore: data() does NOT include id
function makeSnapshotDocs(notifs: AppNotification[]) {
  return {
    docs: notifs.map((n) => {
      const { id, ...rest } = n;
      return { id, data: () => rest };
    }),
  };
}

describe('notificationStore', () => {
  let store: typeof import('../notificationStore');

  beforeEach(async () => {
    vi.resetModules();
    mockOnSnapshot.mockReset();
    mockUpdateDoc.mockReset();
    mockGetDocs.mockReset();
    mockDeleteDoc.mockReset();
    mockWriteBatch.mockClear();

    // Default: onSnapshot returns unsubscribe fn
    mockOnSnapshot.mockReturnValue(vi.fn());

    store = await import('../notificationStore');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Lifecycle ──

  it('starts with empty notifications and zero unread', () => {
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.notificationsReady()).toBe(false);
  });

  it('startNotificationListener sets up onSnapshot on correct collection', () => {
    store.startNotificationListener('u1');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'u1', 'notifications');
  });

  it('startNotificationListener populates signals on snapshot', () => {
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      cb(makeSnapshotDocs([
        makeTestNotif({ id: 'n1', read: false }),
        makeTestNotif({ id: 'n2', read: true }),
      ]));
      return vi.fn();
    });

    store.startNotificationListener('u1');

    expect(store.notifications().length).toBe(2);
    expect(store.unreadCount()).toBe(1);
    expect(store.notificationsReady()).toBe(true);
  });

  it('stopNotificationListener clears signals and calls unsubscribe', () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    store.startNotificationListener('u1');

    store.stopNotificationListener();

    expect(unsub).toHaveBeenCalledTimes(1);
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.notificationsReady()).toBe(false);
  });

  it('stopNotificationListener called twice does not throw', () => {
    store.startNotificationListener('u1');
    store.stopNotificationListener();
    expect(() => store.stopNotificationListener()).not.toThrow();
  });

  it('startNotificationListener cleans up previous listener before starting new one', () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    store.startNotificationListener('u1');
    store.startNotificationListener('u2');

    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  // ── Real-time delta ──

  it('second snapshot replaces (not appends) notifications', () => {
    let snapshotCallback: (snap: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return vi.fn();
    });

    store.startNotificationListener('u1');
    snapshotCallback!(makeSnapshotDocs([makeTestNotif({ id: 'n1' })]));
    expect(store.notifications().length).toBe(1);

    snapshotCallback!(makeSnapshotDocs([
      makeTestNotif({ id: 'n1' }),
      makeTestNotif({ id: 'n2' }),
    ]));
    expect(store.notifications().length).toBe(2);
  });

  it('snapshot with additional unread increments unreadCount', () => {
    let snapshotCallback: (snap: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return vi.fn();
    });

    store.startNotificationListener('u1');
    snapshotCallback!(makeSnapshotDocs([makeTestNotif({ id: 'n1', read: false })]));
    expect(store.unreadCount()).toBe(1);

    snapshotCallback!(makeSnapshotDocs([
      makeTestNotif({ id: 'n1', read: false }),
      makeTestNotif({ id: 'n2', read: false }),
    ]));
    expect(store.unreadCount()).toBe(2);
  });

  // ── buddyUnreadCount ──

  it('buddyUnreadCount only counts unread buddy notifications', () => {
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      cb(makeSnapshotDocs([
        makeTestNotif({ id: 'n1', read: false, category: 'buddy' }),
        makeTestNotif({ id: 'n2', read: false, category: 'tournament', type: 'tournament_invitation' }),
        makeTestNotif({ id: 'n3', read: true, category: 'buddy' }),
      ]));
      return vi.fn();
    });

    store.startNotificationListener('u1');

    expect(store.buddyUnreadCount()).toBe(1);
    expect(store.unreadCount()).toBe(2);
  });

  // ── Preference filtering ──

  it('filteredNotifications excludes disabled categories', async () => {
    vi.resetModules();

    vi.doMock('../../../../stores/settingsStore', () => ({
      settings: () => ({
        notifyBuddy: true,
        notifyTournament: false,
        notifyAchievement: true,
        notifyStats: true,
      }),
    }));

    const storeFiltered = await import('../notificationStore');
    let snapshotCallback: (snap: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return vi.fn();
    });

    storeFiltered.startNotificationListener('u1');
    snapshotCallback!(makeSnapshotDocs([
      makeTestNotif({ id: 'n1', category: 'buddy' }),
      makeTestNotif({ id: 'n2', category: 'tournament', type: 'tournament_invitation' }),
      makeTestNotif({ id: 'n3', category: 'achievement', type: 'achievement_unlocked' }),
    ]));

    expect(storeFiltered.filteredNotifications().length).toBe(2);
    expect(storeFiltered.filteredNotifications().map((n: AppNotification) => n.id)).toEqual(['n1', 'n3']);
  });

  it('filteredNotifications does not mutate raw notifications', () => {
    let snapshotCallback: (snap: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return vi.fn();
    });

    store.startNotificationListener('u1');
    snapshotCallback!(makeSnapshotDocs([
      makeTestNotif({ id: 'n1' }),
      makeTestNotif({ id: 'n2' }),
    ]));

    expect(store.filteredNotifications().length).toBe(2);
    expect(store.notifications().length).toBe(2);
  });

  // ── markRead ──

  it('markNotificationRead calls updateDoc with read: true', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await store.markNotificationRead('u1', 'n1');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { read: true },
    );
  });

  it('markNotificationRead swallows errors', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('offline'));
    await expect(store.markNotificationRead('u1', 'n1')).resolves.toBeUndefined();
  });

  // ── markAllRead ──

  it('markAllNotificationsRead uses limit(500) not limit(50)', async () => {
    const batchMock = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    mockWriteBatch.mockReturnValue(batchMock);
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'n1', ref: 'ref1' },
        { id: 'n2', ref: 'ref2' },
      ],
    });

    await store.markAllNotificationsRead('u1');

    expect(mockLimit).toHaveBeenCalledWith(500);
    expect(batchMock.update).toHaveBeenCalledTimes(2);
    expect(batchMock.update).toHaveBeenCalledWith('ref1', { read: true });
    expect(batchMock.update).toHaveBeenCalledWith('ref2', { read: true });
  });

  it('markAllNotificationsRead skips if no unread', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await store.markAllNotificationsRead('u1');
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  // ── Expired cleanup ──

  it('cleanupExpiredNotifications deletes expired docs', async () => {
    const batchMock = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    mockWriteBatch.mockReturnValue(batchMock);
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'n1', ref: 'ref1' },
        { id: 'n2', ref: 'ref2' },
      ],
    });

    await store.cleanupExpiredNotifications('u1');

    expect(mockWhere).toHaveBeenCalledWith('expiresAt', '<=', expect.any(Number));
    expect(batchMock.delete).toHaveBeenCalledTimes(2);
    expect(batchMock.commit).toHaveBeenCalledTimes(1);
  });

  it('cleanupExpiredNotifications skips if nothing expired', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await store.cleanupExpiredNotifications('u1');
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  // ── onSnapshot error ──

  it('onSnapshot error callback resets notifications and does not throw', () => {
    let errorCallback: (err: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, success: unknown, error: (err: unknown) => void) => {
      errorCallback = error;
      return vi.fn();
    });

    store.startNotificationListener('u1');
    expect(() => errorCallback!(new Error('permission-denied'))).not.toThrow();
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
  });
});
