import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const {
  mockDoc,
  mockGetDocs,
  mockCollection,
  mockCollectionGroup,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockFirestoreLimit,
  mockStartAfter,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
  mockCollectionGroup: vi.fn(() => 'mock-collection-group-ref'),
  mockQuery: vi.fn(() => 'mock-query'),
  mockWhere: vi.fn(() => 'mock-where'),
  mockOrderBy: vi.fn(() => 'mock-orderby'),
  mockFirestoreLimit: vi.fn(() => 'mock-limit'),
  mockStartAfter: vi.fn(() => 'mock-start-after'),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: mockGetDocs,
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  limit: mockFirestoreLimit,
  startAfter: mockStartAfter,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreTournamentRepository } from '../firestoreTournamentRepository';

describe('firestoreTournamentRepository discovery methods', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getPublicTournaments', () => {
    it('fetches with correct filters and returns tournaments with lastDoc', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 't1', data: () => ({ name: 'Open Championship', visibility: 'public', date: 2000 }) },
          { id: 't2', data: () => ({ name: 'Spring Slam', visibility: 'public', date: 1000 }) },
        ],
      });

      const result = await firestoreTournamentRepository.getPublicTournaments(10);

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments');
      expect(mockWhere).toHaveBeenCalledWith('visibility', '==', 'public');
      expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
      expect(mockFirestoreLimit).toHaveBeenCalledWith(10);
      expect(mockQuery).toHaveBeenCalledWith(
        'mock-collection-ref',
        'mock-where',
        'mock-orderby',
        'mock-limit',
      );
      expect(result.tournaments).toEqual([
        {
          id: 't1', name: 'Open Championship', visibility: 'public', date: 2000,
          accessMode: 'open', listed: true, buddyGroupId: null, buddyGroupName: null,
          registrationCounts: { confirmed: 0, pending: 0 },
        },
        {
          id: 't2', name: 'Spring Slam', visibility: 'public', date: 1000,
          accessMode: 'open', listed: true, buddyGroupId: null, buddyGroupName: null,
          registrationCounts: { confirmed: 0, pending: 0 },
        },
      ]);
      expect(result.lastDoc).toBeDefined();
    });

    it('uses default pageSize of 50 when not provided', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await firestoreTournamentRepository.getPublicTournaments();

      expect(mockFirestoreLimit).toHaveBeenCalledWith(50);
    });

    it('accepts cursor for pagination', async () => {
      const cursorDoc = { id: 'cursor-doc' };
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 't3', data: () => ({ name: 'Page 2 Tournament', visibility: 'public', date: 500 }) },
        ],
      });

      const result = await firestoreTournamentRepository.getPublicTournaments(10, cursorDoc);

      expect(mockStartAfter).toHaveBeenCalledWith(cursorDoc);
      expect(mockQuery).toHaveBeenCalledWith(
        'mock-collection-ref',
        'mock-where',
        'mock-orderby',
        'mock-limit',
        'mock-start-after',
      );
      expect(result.tournaments).toHaveLength(1);
    });

    it('handles empty results', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTournamentRepository.getPublicTournaments(10);

      expect(result.tournaments).toEqual([]);
      expect(result.lastDoc).toBeNull();
    });
  });

  describe('getByParticipant', () => {
    it('uses collection group query on registrations subcollection', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { ref: { parent: { parent: { id: 't1' } } }, data: () => ({ status: 'confirmed' }) },
          { ref: { parent: { parent: { id: 't2' } } }, data: () => ({ status: 'pending' }) },
        ],
      });

      const result = await firestoreTournamentRepository.getByParticipant('user1');

      expect(mockCollectionGroup).toHaveBeenCalledWith('mock-firestore', 'registrations');
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user1');
      expect(mockQuery).toHaveBeenCalledWith('mock-collection-group-ref', 'mock-where');
      expect(result.tournamentIds).toEqual(['t1', 't2']);
      expect(result.registrationStatuses.get('t1')).toBe('confirmed');
      expect(result.registrationStatuses.get('t2')).toBe('pending');
    });

    it('deduplicates tournament IDs', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { ref: { parent: { parent: { id: 't1' } } }, data: () => ({ status: 'confirmed' }) },
          { ref: { parent: { parent: { id: 't1' } } }, data: () => ({ status: 'confirmed' }) },
          { ref: { parent: { parent: { id: 't2' } } }, data: () => ({ status: 'pending' }) },
        ],
      });

      const result = await firestoreTournamentRepository.getByParticipant('user1');

      expect(result.tournamentIds).toEqual(['t1', 't2']);
    });

    it('handles empty results', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTournamentRepository.getByParticipant('loner');

      expect(result.tournamentIds).toEqual([]);
      expect(result.registrationStatuses.size).toBe(0);
    });
  });

  describe('getByScorekeeper', () => {
    it('uses array-contains query on scorekeeperIds', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 't1', data: () => ({ name: 'Tournament A', scorekeeperIds: ['sk1'] }) },
          { id: 't2', data: () => ({ name: 'Tournament B', scorekeeperIds: ['sk1', 'sk2'] }) },
        ],
      });

      const result = await firestoreTournamentRepository.getByScorekeeper('sk1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments');
      expect(mockWhere).toHaveBeenCalledWith('scorekeeperIds', 'array-contains', 'sk1');
      expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
      expect(mockQuery).toHaveBeenCalledWith(
        'mock-collection-ref',
        'mock-where',
        'mock-orderby',
      );
      expect(result).toEqual([
        {
          id: 't1', name: 'Tournament A', scorekeeperIds: ['sk1'],
          accessMode: 'open', listed: false, buddyGroupId: null, buddyGroupName: null,
          registrationCounts: { confirmed: 0, pending: 0 },
        },
        {
          id: 't2', name: 'Tournament B', scorekeeperIds: ['sk1', 'sk2'],
          accessMode: 'open', listed: false, buddyGroupId: null, buddyGroupName: null,
          registrationCounts: { confirmed: 0, pending: 0 },
        },
      ]);
    });

    it('handles empty results', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTournamentRepository.getByScorekeeper('nobody');

      expect(result).toEqual([]);
    });
  });
});
