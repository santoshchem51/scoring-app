import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const mockDoc = vi.fn(() => 'mock-doc-ref');
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockCollection = vi.fn(() => 'mock-collection-ref');
const mockQuery = vi.fn(() => 'mock-query');
const mockWhere = vi.fn(() => 'mock-where');
const mockOrderBy = vi.fn(() => 'mock-orderby');
const mockServerTimestamp = vi.fn(() => 'mock-timestamp');

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreTournamentRepository } from '../firestoreTournamentRepository';

describe('firestoreTournamentRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('save', () => {
    const tournament = {
      id: 't1',
      name: 'Test Tournament',
      organizerId: 'org1',
      status: 'setup' as const,
    };

    it('creates with createdAt when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      await firestoreTournamentRepository.save(tournament as any);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...tournament,
        createdAt: 'mock-timestamp',
        updatedAt: 'mock-timestamp',
      });
    });

    it('updates without createdAt when document already exists', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true });
      mockSetDoc.mockResolvedValue(undefined);

      await firestoreTournamentRepository.save(tournament as any);

      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...tournament,
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('getById', () => {
    it('returns tournament when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 't1',
        data: () => ({ name: 'Test Tournament', organizerId: 'org1' }),
      });

      const result = await firestoreTournamentRepository.getById('t1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1');
      expect(result).toEqual({ id: 't1', name: 'Test Tournament', organizerId: 'org1' });
    });

    it('returns undefined when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await firestoreTournamentRepository.getById('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getByOrganizer', () => {
    it('queries by organizerId and returns mapped results', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 't1', data: () => ({ name: 'Tournament A', organizerId: 'org1' }) },
          { id: 't2', data: () => ({ name: 'Tournament B', organizerId: 'org1' }) },
        ],
      });

      const result = await firestoreTournamentRepository.getByOrganizer('org1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments');
      expect(mockWhere).toHaveBeenCalledWith('organizerId', '==', 'org1');
      expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
      expect(mockQuery).toHaveBeenCalledWith('mock-collection-ref', 'mock-where', 'mock-orderby');
      expect(result).toEqual([
        { id: 't1', name: 'Tournament A', organizerId: 'org1' },
        { id: 't2', name: 'Tournament B', organizerId: 'org1' },
      ]);
    });

    it('returns empty array when no documents match', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTournamentRepository.getByOrganizer('nobody');

      expect(result).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('updates status with timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreTournamentRepository.updateStatus('t1', 'pool-play');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        status: 'pool-play',
        updatedAt: 'mock-timestamp',
      });
    });

    it('includes cancellation reason when provided', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreTournamentRepository.updateStatus('t1', 'cancelled', { reason: 'Weather' });

      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        status: 'cancelled',
        updatedAt: 'mock-timestamp',
        cancellationReason: 'Weather',
      });
    });

    it('includes pausedFrom when provided', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreTournamentRepository.updateStatus('t1', 'paused', { pausedFrom: 'pool-play' });

      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        status: 'paused',
        updatedAt: 'mock-timestamp',
        pausedFrom: 'pool-play',
      });
    });
  });

  describe('delete', () => {
    it('deletes the document at the correct path', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await firestoreTournamentRepository.delete('t1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1');
      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref');
    });
  });
});
