import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock functions
const {
  mockDoc,
  mockSetDoc,
  mockGetDocs,
  mockUpdateDoc,
  mockCollection,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockWriteBatch,
  mockBatchUpdate,
  mockBatchCommit,
} = vi.hoisted(() => {
  const mockBatchUpdate = vi.fn();
  const mockBatchCommit = vi.fn();
  return {
    mockDoc: vi.fn(() => 'mock-doc-ref'),
    mockSetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockCollection: vi.fn(() => 'mock-collection-ref'),
    mockQuery: vi.fn(() => 'mock-query'),
    mockWhere: vi.fn(() => 'mock-where'),
    mockOrderBy: vi.fn(() => 'mock-orderBy'),
    mockLimit: vi.fn(() => 'mock-limit'),
    mockWriteBatch: vi.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit })),
    mockBatchUpdate,
    mockBatchCommit,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  writeBatch: mockWriteBatch,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreBuddyNotificationRepository } from '../firestoreBuddyNotificationRepository';
import type { BuddyNotification } from '../../types';

describe('firestoreBuddyNotificationRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleNotification: BuddyNotification = {
    id: 'n1',
    userId: 'user1',
    type: 'session_proposed',
    sessionId: 's1',
    groupId: 'g1',
    actorName: 'Alice',
    message: 'Alice proposed a new session',
    read: false,
    createdAt: 1000,
  };

  describe('create', () => {
    it('calls setDoc with correct subcollection path under user', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await firestoreBuddyNotificationRepository.create(sampleNotification);

      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore',
        'users',
        'user1',
        'buddyNotifications',
        'n1',
      );
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', sampleNotification);
    });
  });

  describe('getUnread', () => {
    it('queries with read==false filter, ordered by createdAt desc, limit 50', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'n1', data: () => ({ userId: 'user1', type: 'session_proposed', read: false, createdAt: 2000 }) },
          { id: 'n2', data: () => ({ userId: 'user1', type: 'spot_opened', read: false, createdAt: 1000 }) },
        ],
      });

      const result = await firestoreBuddyNotificationRepository.getUnread('user1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'users', 'user1', 'buddyNotifications');
      expect(mockWhere).toHaveBeenCalledWith('read', '==', false);
      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(mockQuery).toHaveBeenCalledWith(
        'mock-collection-ref',
        'mock-where',
        'mock-orderBy',
        'mock-limit',
      );
      expect(result).toEqual([
        { id: 'n1', userId: 'user1', type: 'session_proposed', read: false, createdAt: 2000 },
        { id: 'n2', userId: 'user1', type: 'spot_opened', read: false, createdAt: 1000 },
      ]);
    });

    it('returns empty array when no unread notifications exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreBuddyNotificationRepository.getUnread('user1');

      expect(result).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('queries ordered by createdAt desc with limit 100', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'n1', data: () => ({ type: 'session_proposed', read: true, createdAt: 2000 }) },
          { id: 'n2', data: () => ({ type: 'spot_opened', read: false, createdAt: 1000 }) },
        ],
      });

      const result = await firestoreBuddyNotificationRepository.getAll('user1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'users', 'user1', 'buddyNotifications');
      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(100);
      expect(mockQuery).toHaveBeenCalledWith(
        'mock-collection-ref',
        'mock-orderBy',
        'mock-limit',
      );
      expect(result).toEqual([
        { id: 'n1', type: 'session_proposed', read: true, createdAt: 2000 },
        { id: 'n2', type: 'spot_opened', read: false, createdAt: 1000 },
      ]);
    });

    it('returns empty array when no notifications exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreBuddyNotificationRepository.getAll('user1');

      expect(result).toEqual([]);
    });
  });

  describe('markRead', () => {
    it('calls updateDoc with read: true on correct subcollection path', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreBuddyNotificationRepository.markRead('user1', 'n1');

      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore',
        'users',
        'user1',
        'buddyNotifications',
        'n1',
      );
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { read: true });
    });
  });

  describe('markAllRead', () => {
    it('batch-updates all unread notifications to read: true', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'n1', data: () => ({ userId: 'user1', read: false }) },
          { id: 'n2', data: () => ({ userId: 'user1', read: false }) },
        ],
      });
      mockBatchCommit.mockResolvedValue(undefined);

      await firestoreBuddyNotificationRepository.markAllRead('user1');

      expect(mockWriteBatch).toHaveBeenCalledWith('mock-firestore');
      // Two batch.update calls, one per unread notification
      expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
      expect(mockBatchUpdate).toHaveBeenCalledWith('mock-doc-ref', { read: true });
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('skips batch commit when there are no unread notifications', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await firestoreBuddyNotificationRepository.markAllRead('user1');

      expect(mockWriteBatch).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });
});
