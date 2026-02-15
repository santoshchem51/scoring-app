import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const mockDoc = vi.fn(() => 'mock-doc-ref');
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockCollection = vi.fn(() => 'mock-collection-ref');
const mockServerTimestamp = vi.fn(() => 'mock-timestamp');

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreTeamRepository } from '../firestoreTeamRepository';

describe('firestoreTeamRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('save', () => {
    it('saves team to subcollection with correct path', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const team = { id: 'team1', tournamentId: 't1', name: 'Alpha', playerIds: ['p1', 'p2'], seed: 1, poolId: null };

      await firestoreTeamRepository.save(team as any);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'teams', 'team1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...team,
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('getByTournament', () => {
    it('returns all teams for a tournament', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'team1', data: () => ({ name: 'Alpha', tournamentId: 't1', playerIds: ['p1'] }) },
          { id: 'team2', data: () => ({ name: 'Beta', tournamentId: 't1', playerIds: ['p2'] }) },
        ],
      });

      const result = await firestoreTeamRepository.getByTournament('t1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'teams');
      expect(result).toEqual([
        { id: 'team1', name: 'Alpha', tournamentId: 't1', playerIds: ['p1'] },
        { id: 'team2', name: 'Beta', tournamentId: 't1', playerIds: ['p2'] },
      ]);
    });

    it('returns empty array when no teams exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTeamRepository.getByTournament('t1');

      expect(result).toEqual([]);
    });
  });

  describe('updatePool', () => {
    it('updates the poolId field for a team', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreTeamRepository.updatePool('t1', 'team1', 'pool-a');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'teams', 'team1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        poolId: 'pool-a',
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('delete', () => {
    it('deletes team at correct subcollection path', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await firestoreTeamRepository.delete('t1', 'team1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'teams', 'team1');
      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref');
    });
  });
});
