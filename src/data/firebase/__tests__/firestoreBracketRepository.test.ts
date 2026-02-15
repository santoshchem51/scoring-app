import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const mockDoc = vi.fn(() => 'mock-doc-ref');
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockCollection = vi.fn(() => 'mock-collection-ref');
const mockServerTimestamp = vi.fn(() => 'mock-timestamp');

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreBracketRepository } from '../firestoreBracketRepository';

describe('firestoreBracketRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('save', () => {
    it('saves bracket slot to subcollection with correct path', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const slot = {
        id: 'slot1',
        tournamentId: 't1',
        round: 1,
        position: 0,
        team1Id: 'team1',
        team2Id: 'team2',
        matchId: null,
        winnerId: null,
        nextSlotId: 'slot3',
      };

      await firestoreBracketRepository.save(slot as any);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'bracket', 'slot1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...slot,
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('getByTournament', () => {
    it('returns all bracket slots for a tournament', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'slot1', data: () => ({ round: 1, position: 0, tournamentId: 't1', team1Id: 'team1', team2Id: 'team2' }) },
          { id: 'slot2', data: () => ({ round: 1, position: 1, tournamentId: 't1', team1Id: 'team3', team2Id: 'team4' }) },
        ],
      });

      const result = await firestoreBracketRepository.getByTournament('t1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'bracket');
      expect(result).toEqual([
        { id: 'slot1', round: 1, position: 0, tournamentId: 't1', team1Id: 'team1', team2Id: 'team2' },
        { id: 'slot2', round: 1, position: 1, tournamentId: 't1', team1Id: 'team3', team2Id: 'team4' },
      ]);
    });

    it('returns empty array when no bracket slots exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreBracketRepository.getByTournament('t1');

      expect(result).toEqual([]);
    });
  });

  describe('updateResult', () => {
    it('updates winnerId and matchId for a bracket slot', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreBracketRepository.updateResult('t1', 'slot1', 'team1', 'match1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'bracket', 'slot1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        winnerId: 'team1',
        matchId: 'match1',
        updatedAt: 'mock-timestamp',
      });
    });
  });
});
