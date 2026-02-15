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

import { firestorePoolRepository } from '../firestorePoolRepository';

describe('firestorePoolRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('save', () => {
    it('saves pool to subcollection with correct path', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const pool = {
        id: 'pool1',
        tournamentId: 't1',
        name: 'Pool A',
        teamIds: ['team1', 'team2'],
        schedule: [],
        standings: [],
      };

      await firestorePoolRepository.save(pool as any);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'pools', 'pool1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...pool,
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('getByTournament', () => {
    it('returns all pools for a tournament', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'pool1', data: () => ({ name: 'Pool A', tournamentId: 't1', teamIds: ['team1'] }) },
          { id: 'pool2', data: () => ({ name: 'Pool B', tournamentId: 't1', teamIds: ['team2'] }) },
        ],
      });

      const result = await firestorePoolRepository.getByTournament('t1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'pools');
      expect(result).toEqual([
        { id: 'pool1', name: 'Pool A', tournamentId: 't1', teamIds: ['team1'] },
        { id: 'pool2', name: 'Pool B', tournamentId: 't1', teamIds: ['team2'] },
      ]);
    });

    it('returns empty array when no pools exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestorePoolRepository.getByTournament('t1');

      expect(result).toEqual([]);
    });
  });

  describe('updateStandings', () => {
    it('updates standings array for a pool', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const standings = [
        { teamId: 'team1', wins: 2, losses: 0, pointsFor: 22, pointsAgainst: 10, pointDiff: 12 },
        { teamId: 'team2', wins: 0, losses: 2, pointsFor: 10, pointsAgainst: 22, pointDiff: -12 },
      ];

      await firestorePoolRepository.updateStandings('t1', 'pool1', standings);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'pools', 'pool1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        standings,
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('error handling', () => {
    it('propagates Firestore errors on save', async () => {
      mockSetDoc.mockRejectedValue(new Error('Permission denied'));
      const pool = { id: 'pool1', tournamentId: 't1', name: 'Pool A', teamIds: [], schedule: [], standings: [] };

      await expect(firestorePoolRepository.save(pool as any)).rejects.toThrow('Permission denied');
    });
  });
});
