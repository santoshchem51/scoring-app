import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const { mockDoc, mockSetDoc, mockGetDocs, mockUpdateDoc, mockCollection, mockQuery, mockWhere, mockServerTimestamp } = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockSetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
  mockQuery: vi.fn(() => 'mock-query'),
  mockWhere: vi.fn(() => 'mock-where'),
  mockServerTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreRegistrationRepository } from '../firestoreRegistrationRepository';

describe('firestoreRegistrationRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('save', () => {
    it('saves registration to subcollection with correct path', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const reg = {
        id: 'reg1',
        tournamentId: 't1',
        userId: 'user1',
        teamId: null,
        paymentStatus: 'unpaid' as const,
        paymentNote: '',
        lateEntry: false,
        skillRating: null,
        partnerId: null,
        partnerName: null,
        profileComplete: false,
        registeredAt: 1000,
      };

      await firestoreRegistrationRepository.save(reg as any);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'registrations', 'reg1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...reg,
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('getByTournament', () => {
    it('returns all registrations for a tournament', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'reg1', data: () => ({ userId: 'user1', tournamentId: 't1', paymentStatus: 'paid' }) },
          { id: 'reg2', data: () => ({ userId: 'user2', tournamentId: 't1', paymentStatus: 'unpaid' }) },
        ],
      });

      const result = await firestoreRegistrationRepository.getByTournament('t1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'registrations');
      expect(result).toEqual([
        { id: 'reg1', userId: 'user1', tournamentId: 't1', paymentStatus: 'paid' },
        { id: 'reg2', userId: 'user2', tournamentId: 't1', paymentStatus: 'unpaid' },
      ]);
    });

    it('returns empty array when no registrations exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreRegistrationRepository.getByTournament('t1');

      expect(result).toEqual([]);
    });
  });

  describe('getByUser', () => {
    it('returns registration when user is found', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          { id: 'reg1', data: () => ({ userId: 'user1', tournamentId: 't1', paymentStatus: 'paid' }) },
        ],
      });

      const result = await firestoreRegistrationRepository.getByUser('t1', 'user1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'registrations');
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user1');
      expect(mockQuery).toHaveBeenCalledWith('mock-collection-ref', 'mock-where');
      expect(result).toEqual({ id: 'reg1', userId: 'user1', tournamentId: 't1', paymentStatus: 'paid' });
    });

    it('returns undefined when user is not found', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      const result = await firestoreRegistrationRepository.getByUser('t1', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('updatePayment', () => {
    it('updates payment status with timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreRegistrationRepository.updatePayment('t1', 'reg1', 'paid');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'registrations', 'reg1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        paymentStatus: 'paid',
        updatedAt: 'mock-timestamp',
      });
    });

    it('includes payment note when provided', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreRegistrationRepository.updatePayment('t1', 'reg1', 'waived', 'Scholarship');

      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        paymentStatus: 'waived',
        updatedAt: 'mock-timestamp',
        paymentNote: 'Scholarship',
      });
    });
  });
});
