import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn();
const mockDoc = vi.fn().mockReturnValue({ id: 'mock-ref' });
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: vi.fn(),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
}));

vi.mock('../config', () => ({
  firestore: {},
}));

import { firestoreMatchRepository } from '../firestoreMatchRepository';
import type { Match } from '../../types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    games: [],
    winningSide: null,
    status: 'in-progress',
    startedAt: Date.now(),
    completedAt: null,
    ...overrides,
  };
}

describe('firestoreMatchRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('defaults sharedWith to empty array when not provided', async () => {
      const match = makeMatch();
      await firestoreMatchRepository.save(match, 'owner-uid');

      const savedData = mockSetDoc.mock.calls[0][1];
      expect(savedData.sharedWith).toEqual([]);
    });

    it('uses provided sharedWith array', async () => {
      const match = makeMatch();
      await firestoreMatchRepository.save(match, 'owner-uid', ['buddy-1', 'buddy-2']);

      const savedData = mockSetDoc.mock.calls[0][1];
      expect(savedData.sharedWith).toEqual(['buddy-1', 'buddy-2']);
    });
  });

  describe('getBySharedWith', () => {
    it('returns matches where user is in sharedWith', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'm1', data: () => ({ id: 'm1', ownerId: 'other', sharedWith: ['user-1'] }) },
        ],
      });

      const results = await firestoreMatchRepository.getBySharedWith('user-1');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('m1');
    });

    it('returns empty array when no shared matches', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const results = await firestoreMatchRepository.getBySharedWith('user-1');
      expect(results).toEqual([]);
    });
  });
});
