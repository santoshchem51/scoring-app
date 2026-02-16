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
  mockCollectionGroup,
  mockQuery,
  mockWhere,
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
  mockCollectionGroup: vi.fn(() => 'mock-collection-group-ref'),
  mockQuery: vi.fn(() => 'mock-query'),
  mockWhere: vi.fn(() => 'mock-where'),
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
  collectionGroup: mockCollectionGroup,
  query: mockQuery,
  where: mockWhere,
  increment: mockIncrement,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreBuddyGroupRepository } from '../firestoreBuddyGroupRepository';
import type { BuddyGroup, BuddyGroupMember } from '../../types';

describe('firestoreBuddyGroupRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('create', () => {
    it('creates a buddy group document at the correct path', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const group: BuddyGroup = {
        id: 'g1',
        name: 'Friday Picklers',
        description: 'Weekly Friday group',
        createdBy: 'user1',
        defaultLocation: 'Central Park',
        defaultDay: 'Friday',
        defaultTime: '18:00',
        memberCount: 1,
        visibility: 'private',
        shareCode: 'ABC123',
        createdAt: 1000,
        updatedAt: 1000,
      };

      await firestoreBuddyGroupRepository.create(group);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', {
        ...group,
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('get', () => {
    it('returns buddy group when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'g1',
        data: () => ({ name: 'Friday Picklers', createdBy: 'user1' }),
      });

      const result = await firestoreBuddyGroupRepository.get('g1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1');
      expect(result).toEqual({ id: 'g1', name: 'Friday Picklers', createdBy: 'user1' });
    });

    it('returns null when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await firestoreBuddyGroupRepository.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('updates buddy group fields with timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreBuddyGroupRepository.update('g1', { name: 'New Name' });

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        name: 'New Name',
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('delete', () => {
    it('deletes the document at the correct path', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await firestoreBuddyGroupRepository.delete('g1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1');
      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref');
    });
  });

  describe('getByShareCode', () => {
    it('returns buddy group matching share code', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'g1', data: () => ({ name: 'Friday Picklers', shareCode: 'ABC123' }) },
        ],
      });

      const result = await firestoreBuddyGroupRepository.getByShareCode('ABC123');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'buddyGroups');
      expect(mockWhere).toHaveBeenCalledWith('shareCode', '==', 'ABC123');
      expect(mockQuery).toHaveBeenCalledWith('mock-collection-ref', 'mock-where');
      expect(result).toEqual({ id: 'g1', name: 'Friday Picklers', shareCode: 'ABC123' });
    });

    it('returns null when no group matches share code', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreBuddyGroupRepository.getByShareCode('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('addMember', () => {
    it('adds member to subcollection and increments memberCount', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockUpdateDoc.mockResolvedValue(undefined);
      const member: BuddyGroupMember = {
        userId: 'user1',
        displayName: 'Alice',
        photoURL: null,
        role: 'member',
        joinedAt: 2000,
      };

      await firestoreBuddyGroupRepository.addMember('g1', member);

      // First call: doc ref for member subcollection
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1', 'members', 'user1');
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', member);
      // Second call: doc ref for group to increment memberCount
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        memberCount: { _increment: 1 },
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('removeMember', () => {
    it('deletes member from subcollection and decrements memberCount', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);
      mockUpdateDoc.mockResolvedValue(undefined);

      await firestoreBuddyGroupRepository.removeMember('g1', 'user1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1', 'members', 'user1');
      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref');
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1');
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        memberCount: { _increment: -1 },
        updatedAt: 'mock-timestamp',
      });
    });
  });

  describe('getMembers', () => {
    it('returns all members from subcollection', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ userId: 'user1', displayName: 'Alice', role: 'admin', joinedAt: 1000 }) },
          { data: () => ({ userId: 'user2', displayName: 'Bob', role: 'member', joinedAt: 2000 }) },
        ],
      });

      const result = await firestoreBuddyGroupRepository.getMembers('g1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1', 'members');
      expect(result).toEqual([
        { userId: 'user1', displayName: 'Alice', role: 'admin', joinedAt: 1000 },
        { userId: 'user2', displayName: 'Bob', role: 'member', joinedAt: 2000 },
      ]);
    });

    it('returns empty array when no members exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreBuddyGroupRepository.getMembers('g1');

      expect(result).toEqual([]);
    });
  });

  describe('getMember', () => {
    it('returns member when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ userId: 'user1', displayName: 'Alice', role: 'admin', joinedAt: 1000 }),
      });

      const result = await firestoreBuddyGroupRepository.getMember('g1', 'user1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'buddyGroups', 'g1', 'members', 'user1');
      expect(result).toEqual({ userId: 'user1', displayName: 'Alice', role: 'admin', joinedAt: 1000 });
    });

    it('returns null when member does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await firestoreBuddyGroupRepository.getMember('g1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getGroupsForUser', () => {
    it('returns group IDs from collectionGroup query', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { ref: { parent: { parent: { id: 'g1' } } } },
          { ref: { parent: { parent: { id: 'g2' } } } },
        ],
      });

      const result = await firestoreBuddyGroupRepository.getGroupsForUser('user1');

      expect(mockCollectionGroup).toHaveBeenCalledWith('mock-firestore', 'members');
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user1');
      expect(mockQuery).toHaveBeenCalledWith('mock-collection-group-ref', 'mock-where');
      expect(result).toEqual(['g1', 'g2']);
    });

    it('returns empty array when user is not in any groups', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreBuddyGroupRepository.getGroupsForUser('loner');

      expect(result).toEqual([]);
    });
  });
});
