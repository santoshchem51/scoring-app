import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetDocs = vi.hoisted(() => vi.fn());
const mockDoc = vi.hoisted(() => vi.fn(() => ({ id: 'dispute-auto-id' })));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-disputes-col'));
const mockWriteBatch = vi.hoisted(() => {
  const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  return vi.fn(() => batch);
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn(() => 'mock-where'),
  orderBy: vi.fn(() => 'mock-orderby'),
  limit: vi.fn(() => 'mock-limit'),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  writeBatch: mockWriteBatch,
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import { flagDispute, resolveDispute, getDisputesByTournament, getOpenDisputesByMatch } from '../firestoreDisputeRepository';

describe('firestoreDisputeRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('flagDispute', () => {
    it('creates dispute doc and audit entry in a batch', async () => {
      const result = await flagDispute({
        tournamentId: 't1',
        matchId: 'm1',
        flaggedBy: 'u1',
        flaggedByName: 'Alice',
        reason: 'Wrong score',
        actorRole: 'moderator',
      });

      const batch = mockWriteBatch();
      expect(batch.set).toHaveBeenCalled();
      expect(batch.commit).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('returns a non-empty string dispute ID', async () => {
      const result = await flagDispute({
        tournamentId: 't1',
        matchId: 'm1',
        flaggedBy: 'u1',
        flaggedByName: 'Alice',
        reason: 'Wrong score',
        actorRole: 'moderator',
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('resolveDispute', () => {
    it('updates dispute status and creates audit entry', async () => {
      await resolveDispute({
        tournamentId: 't1',
        disputeId: 'd1',
        matchId: 'm1',
        resolvedBy: 'u2',
        resolvedByName: 'Bob',
        resolution: 'Score corrected',
        type: 'edited',
        actorRole: 'admin',
      });

      const batch = mockWriteBatch();
      expect(batch.update).toHaveBeenCalled();
      expect(batch.set).toHaveBeenCalled();
      expect(batch.commit).toHaveBeenCalled();
    });
  });

  describe('getDisputesByTournament', () => {
    it('returns disputes ordered by createdAt desc', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'd1', data: () => ({ matchId: 'm1', status: 'open', reason: 'Bad call' }) },
          { id: 'd2', data: () => ({ matchId: 'm2', status: 'resolved-edited', reason: 'Score error' }) },
        ],
      });

      const result = await getDisputesByTournament('t1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('d1');
      expect(result[1].id).toBe('d2');
    });

    it('returns empty array when no disputes', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      const result = await getDisputesByTournament('t1');
      expect(result).toEqual([]);
    });
  });

  describe('getOpenDisputesByMatch', () => {
    it('returns open disputes for a specific match', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'd1', data: () => ({ matchId: 'm1', status: 'open', reason: 'Bad call' }) },
          { id: 'd2', data: () => ({ matchId: 'm1', status: 'open', reason: 'Wrong server' }) },
        ],
      });

      const result = await getOpenDisputesByMatch('t1', 'm1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'd1', matchId: 'm1', status: 'open', reason: 'Bad call' });
      expect(result[1]).toEqual({ id: 'd2', matchId: 'm1', status: 'open', reason: 'Wrong server' });
      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'disputes');
      expect(mockGetDocs).toHaveBeenCalled();
    });

    it('returns empty array when no open disputes exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await getOpenDisputesByMatch('t1', 'm1');

      expect(result).toEqual([]);
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });
});
