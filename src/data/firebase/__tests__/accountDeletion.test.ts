import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn().mockResolvedValue({ empty: true, docs: [] });
const mockWriteBatch = vi.fn(() => ({ delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../config', () => ({ firestore: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') })),
  deleteDoc: mockDeleteDoc,
  collection: vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') })),
  getDocs: mockGetDocs,
  query: vi.fn((...args: any[]) => args[0]),
  where: vi.fn(),
  writeBatch: mockWriteBatch,
  limit: vi.fn(),
}));

describe('deleteAllUserData', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('deletes all user subcollections and top-level docs', async () => {
    const { deleteAllUserData } = await import('../accountDeletion');
    await deleteAllUserData('test-uid');

    // Should delete user subdocs (public/tier, stats/summary)
    // Should delete top-level docs (users/test-uid, leaderboard/test-uid)
    expect(mockDeleteDoc).toHaveBeenCalled();
    const paths = mockDeleteDoc.mock.calls.map((c: any) => c[0]?.path).filter(Boolean);
    expect(paths).toContain('users/test-uid');
    expect(paths).toContain('leaderboard/test-uid');
  });

  it('does not throw when subcollection queries return empty', async () => {
    const { deleteAllUserData } = await import('../accountDeletion');
    await expect(deleteAllUserData('test-uid')).resolves.not.toThrow();
  });

  it('deletes user-owned matches when found', async () => {
    const mockMatchRef = { id: 'match-1', ref: { path: 'matches/match-1' } };
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] }) // notifications
      .mockResolvedValueOnce({ empty: true, docs: [] }) // buddyNotifications
      .mockResolvedValueOnce({ empty: true, docs: [] }) // achievements
      .mockResolvedValueOnce({ empty: true, docs: [] }) // matchRefs
      .mockResolvedValueOnce({ empty: true, docs: [] }) // templates
      .mockResolvedValueOnce({ empty: false, docs: [mockMatchRef] }) // matches query
      .mockResolvedValueOnce({ empty: true, docs: [] }) // scoreEvents
      .mockResolvedValueOnce({ empty: true, docs: [] }) // buddyGroups
      .mockResolvedValueOnce({ empty: true, docs: [] }); // gameSessions

    const { deleteAllUserData } = await import('../accountDeletion');
    await deleteAllUserData('test-uid');

    // Should delete the match doc
    expect(mockDeleteDoc).toHaveBeenCalledWith(mockMatchRef.ref);
  });
});
