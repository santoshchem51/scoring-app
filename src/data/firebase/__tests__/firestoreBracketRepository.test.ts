import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const { mockDoc, mockSetDoc, mockGetDocs, mockUpdateDoc, mockCollection, mockServerTimestamp } = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockSetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
  mockServerTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  serverTimestamp: mockServerTimestamp,
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

  describe('error handling', () => {
    it('propagates Firestore errors on updateResult', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Not found'));

      await expect(firestoreBracketRepository.updateResult('t1', 'slot1', 'team1', 'match1')).rejects.toThrow('Not found');
    });
  });
});
