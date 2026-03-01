import { describe, it, expect, vi, beforeEach } from 'vitest';

const batchInstance = vi.hoisted(() => ({
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));

const { mockDoc, mockSetDoc, mockGetDoc, mockGetDocs, mockUpdateDoc, mockCollection, mockQuery, mockWhere, mockWriteBatch } = vi.hoisted(() => ({
  mockDoc: vi.fn((...args: unknown[]) => ({ _doc: args })),
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockCollection: vi.fn((...args: unknown[]) => ({ _collection: args })),
  mockQuery: vi.fn((...args: unknown[]) => ({ _query: args })),
  mockWhere: vi.fn((...args: unknown[]) => ({ _where: args })),
  mockWriteBatch: vi.fn(() => batchInstance),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  writeBatch: mockWriteBatch,
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  increment: vi.fn((n: number) => ({ _increment: n })),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import { firestoreRegistrationRepository } from '../firestoreRegistrationRepository';

describe('firestoreRegistrationRepository - access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchInstance.set.mockClear();
    batchInstance.update.mockClear();
    batchInstance.commit.mockClear().mockResolvedValue(undefined);
  });

  describe('saveWithStatus', () => {
    it('uses userId as doc ID', async () => {
      const reg = {
        id: 'old-uuid',
        tournamentId: 't1',
        userId: 'user-1',
        status: 'pending' as const,
        playerName: 'Alice',
        registeredAt: 1000,
        declineReason: null,
        statusUpdatedAt: null,
      };

      await firestoreRegistrationRepository.saveWithStatus(reg as any, 't1');

      // Doc path uses userId, not the reg.id
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'registrations', 'user-1');
    });

    it('increments pending count for pending status', async () => {
      const reg = {
        tournamentId: 't1',
        userId: 'user-1',
        status: 'pending' as const,
      };

      await firestoreRegistrationRepository.saveWithStatus(reg as any, 't1');

      // batch.set for the reg doc
      expect(batchInstance.set).toHaveBeenCalledTimes(1);
      // batch.update for the tournament counter
      expect(batchInstance.update).toHaveBeenCalledTimes(1);
      expect(batchInstance.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'registrationCounts.pending': { _increment: 1 } }),
      );
      expect(batchInstance.commit).toHaveBeenCalled();
    });

    it('increments confirmed count for confirmed status', async () => {
      const reg = {
        tournamentId: 't1',
        userId: 'user-1',
        status: 'confirmed' as const,
      };

      await firestoreRegistrationRepository.saveWithStatus(reg as any, 't1');

      expect(batchInstance.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'registrationCounts.confirmed': { _increment: 1 } }),
      );
    });
  });

  describe('updateRegistrationStatus', () => {
    it('updates status and adjusts counts in a batch', async () => {
      await firestoreRegistrationRepository.updateRegistrationStatus(
        't1', 'user-1', 'pending', 'confirmed',
      );

      // 2 updates: reg doc + tournament counter
      expect(batchInstance.update).toHaveBeenCalledTimes(2);
      expect(batchInstance.commit).toHaveBeenCalled();
    });

    it('includes declineReason when provided', async () => {
      await firestoreRegistrationRepository.updateRegistrationStatus(
        't1', 'user-1', 'pending', 'declined', 'Tournament is full',
      );

      expect(batchInstance.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'declined',
          declineReason: 'Tournament is full',
        }),
      );
    });
  });

  describe('batchUpdateStatus', () => {
    it('updates all userIds and adjusts counts', async () => {
      await firestoreRegistrationRepository.batchUpdateStatus(
        't1', ['u1', 'u2', 'u3'], 'pending', 'confirmed',
      );

      // 3 reg updates + 1 tournament counter = 4
      expect(batchInstance.update).toHaveBeenCalledTimes(4);
      expect(batchInstance.commit).toHaveBeenCalled();
    });
  });
});
