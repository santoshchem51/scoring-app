import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeLeaderboardEntry } from '../../../test/factories';

const {
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockCollection,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockGetCountFromServer,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  mockOrderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  mockLimit: vi.fn((n: number) => ({ type: 'limit', n })),
  mockGetCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  getCountFromServer: mockGetCountFromServer,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreLeaderboardRepository } from '../firestoreLeaderboardRepository';

describe('firestoreLeaderboardRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGlobalLeaderboard', () => {
    it('queries with compositeScore desc for allTime', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'user-1', data: () => makeLeaderboardEntry({ uid: 'user-1', compositeScore: 80 }) },
          { id: 'user-2', data: () => makeLeaderboardEntry({ uid: 'user-2', compositeScore: 70 }) },
        ],
      });

      const results = await firestoreLeaderboardRepository.getGlobalLeaderboard('allTime', 25);
      expect(mockOrderBy).toHaveBeenCalledWith('compositeScore', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(25);
      expect(results).toHaveLength(2);
      expect(results[0].compositeScore).toBe(80);
    });

    it('queries with last30d.compositeScore desc for last30d', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await firestoreLeaderboardRepository.getGlobalLeaderboard('last30d', 25);
      expect(mockOrderBy).toHaveBeenCalledWith('last30d.compositeScore', 'desc');
    });
  });

  describe('getFriendsLeaderboard', () => {
    it('filters by uid in friendUids', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await firestoreLeaderboardRepository.getFriendsLeaderboard(
        ['friend-1', 'friend-2'],
        'allTime',
      );
      expect(mockWhere).toHaveBeenCalledWith('uid', 'in', ['friend-1', 'friend-2']);
    });

    it('returns empty array for empty friendUids', async () => {
      const results = await firestoreLeaderboardRepository.getFriendsLeaderboard([], 'allTime');
      expect(results).toEqual([]);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });

  describe('getUserRank', () => {
    it('counts documents with higher compositeScore', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 5 }),
      });

      const rank = await firestoreLeaderboardRepository.getUserRank('user-1', 60, 'allTime');
      expect(rank).toBe(6);
      expect(mockWhere).toHaveBeenCalledWith('compositeScore', '>', 60);
    });

    it('returns rank 1 when no one has higher score', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 0 }),
      });

      const rank = await firestoreLeaderboardRepository.getUserRank('user-1', 90, 'allTime');
      expect(rank).toBe(1);
    });

    it('uses last30d.compositeScore for last30d timeframe', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 3 }),
      });

      await firestoreLeaderboardRepository.getUserRank('user-1', 60, 'last30d');
      expect(mockWhere).toHaveBeenCalledWith('last30d.compositeScore', '>', 60);
    });
  });

  describe('getUserEntry', () => {
    it('returns entry when it exists', async () => {
      const entry = makeLeaderboardEntry({ uid: 'user-1' });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => entry,
        id: 'user-1',
      });

      const result = await firestoreLeaderboardRepository.getUserEntry('user-1');
      expect(result).toBeDefined();
      expect(result!.uid).toBe('user-1');
    });

    it('returns null when entry does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await firestoreLeaderboardRepository.getUserEntry('user-1');
      expect(result).toBeNull();
    });
  });
});
