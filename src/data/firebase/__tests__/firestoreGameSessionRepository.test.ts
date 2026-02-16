import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const {
  mockDoc,
  mockSetDoc,
  mockGetDoc,
  mockGetDocs,
  mockUpdateDoc,
  mockDeleteDoc,
  mockCollection,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockIncrement,
  mockServerTimestamp,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockSetDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
  mockQuery: vi.fn(() => 'mock-query'),
  mockWhere: vi.fn(() => 'mock-where'),
  mockOrderBy: vi.fn(() => 'mock-orderby'),
  mockIncrement: vi.fn((n: number) => ({ _increment: n })),
  mockServerTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  increment: mockIncrement,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreGameSessionRepository } from '../firestoreGameSessionRepository';
import type { GameSession, SessionRsvp } from '../../types';

describe('firestoreGameSessionRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  const baseSession: GameSession = {
    id: 'session1',
    groupId: 'group1',
    createdBy: 'user1',
    title: 'Friday Night Pickleball',
    location: 'Central Courts',
    courtsAvailable: 4,
    spotsTotal: 16,
    spotsConfirmed: 3,
    scheduledDate: 1700000000000,
    timeSlots: null,
    confirmedSlot: null,
    rsvpStyle: 'simple',
    rsvpDeadline: null,
    visibility: 'group',
    shareCode: 'ABC123',
    autoOpenOnDropout: true,
    minPlayers: 4,
    status: 'proposed',
    createdAt: 1699000000000,
    updatedAt: 1699000000000,
  };

  describe('create', () => {
    it('saves session to gameSessions collection with server timestamp', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await firestoreGameSessionRepository.create(baseSession);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...baseSession,
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('get', () => {
    it('returns session when document exists', async () => {
      const { id: _id, ...data } = baseSession;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'session1',
        data: () => data,
      });

      const result = await firestoreGameSessionRepository.get('session1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1');
      expect(result).toEqual({ id: 'session1', ...data });
    });

    it('returns null when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await firestoreGameSessionRepository.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('updates session fields with server timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreGameSessionRepository.update('session1', { status: 'confirmed' });

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        status: 'confirmed',
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('delete', () => {
    it('deletes the document at the correct path', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await firestoreGameSessionRepository.delete('session1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1');
      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref');
    });
  });

  describe('getByGroup', () => {
    it('queries by groupId ordered by scheduledDate ascending', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 's1', data: () => ({ groupId: 'group1', title: 'Session A', scheduledDate: 1700000000000 }) },
          { id: 's2', data: () => ({ groupId: 'group1', title: 'Session B', scheduledDate: 1700100000000 }) },
        ],
      });

      const result = await firestoreGameSessionRepository.getByGroup('group1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'gameSessions');
      expect(mockWhere).toHaveBeenCalledWith('groupId', '==', 'group1');
      expect(mockOrderBy).toHaveBeenCalledWith('scheduledDate', 'asc');
      expect(mockQuery).toHaveBeenCalledWith('mock-collection-ref', 'mock-where', 'mock-orderby');
      expect(result).toEqual([
        { id: 's1', groupId: 'group1', title: 'Session A', scheduledDate: 1700000000000 },
        { id: 's2', groupId: 'group1', title: 'Session B', scheduledDate: 1700100000000 },
      ]);
    });

    it('returns empty array when no sessions found for group', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreGameSessionRepository.getByGroup('empty-group');

      expect(result).toEqual([]);
    });
  });

  describe('getOpenSessions', () => {
    it('queries for open visibility with proposed or confirmed status', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 's1', data: () => ({ visibility: 'open', status: 'proposed', title: 'Open Game' }) },
        ],
      });

      const result = await firestoreGameSessionRepository.getOpenSessions();

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'gameSessions');
      expect(mockWhere).toHaveBeenCalledWith('visibility', '==', 'open');
      expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['proposed', 'confirmed']);
      expect(mockOrderBy).toHaveBeenCalledWith('scheduledDate', 'asc');
      expect(result).toEqual([
        { id: 's1', visibility: 'open', status: 'proposed', title: 'Open Game' },
      ]);
    });

    it('returns empty array when no open sessions exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreGameSessionRepository.getOpenSessions();

      expect(result).toEqual([]);
    });
  });

  describe('getByShareCode', () => {
    it('returns session when share code matches', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 's1', data: () => ({ shareCode: 'ABC123', title: 'Shared Session' }) },
        ],
      });

      const result = await firestoreGameSessionRepository.getByShareCode('ABC123');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'gameSessions');
      expect(mockWhere).toHaveBeenCalledWith('shareCode', '==', 'ABC123');
      expect(result).toEqual({ id: 's1', shareCode: 'ABC123', title: 'Shared Session' });
    });

    it('returns null when no session matches share code', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreGameSessionRepository.getByShareCode('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('submitRsvp', () => {
    it('saves RSVP to subcollection with userId as doc ID', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const rsvp: SessionRsvp = {
        userId: 'user1',
        displayName: 'Alice',
        photoURL: null,
        response: 'in',
        dayOfStatus: 'none',
        selectedSlotIds: [],
        respondedAt: 1700000000000,
        statusUpdatedAt: null,
      };

      await firestoreGameSessionRepository.submitRsvp('session1', rsvp);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1', 'rsvps', 'user1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', rsvp);
    });
  });

  describe('getRsvps', () => {
    it('returns all RSVPs for a session', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ userId: 'user1', response: 'in', displayName: 'Alice' }) },
          { data: () => ({ userId: 'user2', response: 'out', displayName: 'Bob' }) },
        ],
      });

      const result = await firestoreGameSessionRepository.getRsvps('session1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1', 'rsvps');
      expect(result).toEqual([
        { userId: 'user1', response: 'in', displayName: 'Alice' },
        { userId: 'user2', response: 'out', displayName: 'Bob' },
      ]);
    });

    it('returns empty array when no RSVPs exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreGameSessionRepository.getRsvps('session1');

      expect(result).toEqual([]);
    });
  });

  describe('updateDayOfStatus', () => {
    it('updates day-of status on the RSVP subcollection doc', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const fakeNow = 1700500000000;
      vi.spyOn(Date, 'now').mockReturnValue(fakeNow);

      await firestoreGameSessionRepository.updateDayOfStatus('session1', 'user1', 'on-my-way');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1', 'rsvps', 'user1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        dayOfStatus: 'on-my-way',
        statusUpdatedAt: fakeNow,
      });

      vi.restoreAllMocks();
    });
  });

  describe('updateRsvpResponse', () => {
    it('updates RSVP response and increments spots when increment is non-zero', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const fakeNow = 1700500000000;
      vi.spyOn(Date, 'now').mockReturnValue(fakeNow);

      // First call returns rsvp doc ref, second call returns session doc ref
      mockDoc
        .mockReturnValueOnce('mock-rsvp-ref')
        .mockReturnValueOnce('mock-session-ref');

      await firestoreGameSessionRepository.updateRsvpResponse('session1', 'user1', 'in', 1);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1', 'rsvps', 'user1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-rsvp-ref', {
        response: 'in',
        respondedAt: fakeNow,
      });

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'gameSessions', 'session1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-session-ref', {
        spotsConfirmed: { _increment: 1 },
        updatedAt: 'mock-timestamp',
      });

      vi.restoreAllMocks();
    });

    it('does not update session spots when increment is zero', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const fakeNow = 1700500000000;
      vi.spyOn(Date, 'now').mockReturnValue(fakeNow);

      await firestoreGameSessionRepository.updateRsvpResponse('session1', 'user1', 'maybe', 0);

      // Only one updateDoc call (for the RSVP), not for the session
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        response: 'maybe',
        respondedAt: fakeNow,
      });

      vi.restoreAllMocks();
    });
  });
});
