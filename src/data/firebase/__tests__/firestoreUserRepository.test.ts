import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.hoisted(() => vi.fn());
const mockDoc = vi.hoisted(() => vi.fn(() => 'mock-doc-ref'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: vi.fn(),
  getDoc: mockGetDoc,
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-ts'),
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreUserRepository } from '../firestoreUserRepository';

describe('firestoreUserRepository.getByIds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns profiles for all found users', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'u1',
        data: () => ({ displayName: 'Alice', displayNameLower: 'alice', email: 'alice@test.com', photoURL: null, createdAt: 1000 }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'u2',
        data: () => ({ displayName: 'Bob', displayNameLower: 'bob', email: 'bob@test.com', photoURL: null, createdAt: 2000 }),
      });

    const result = await firestoreUserRepository.getByIds(['u1', 'u2']);

    expect(result).toHaveLength(2);
    expect(result[0]!.displayName).toBe('Alice');
    expect(result[1]!.displayName).toBe('Bob');
  });

  it('filters out users that do not exist', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'u1',
        data: () => ({ displayName: 'Alice', displayNameLower: 'alice', email: 'alice@test.com', photoURL: null, createdAt: 1000 }),
      })
      .mockResolvedValueOnce({
        exists: () => false,
      });

    const result = await firestoreUserRepository.getByIds(['u1', 'missing']);

    expect(result).toHaveLength(1);
    expect(result[0]!.displayName).toBe('Alice');
  });

  it('returns empty array for empty input', async () => {
    const result = await firestoreUserRepository.getByIds([]);
    expect(result).toEqual([]);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('deduplicates input uids', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'u1',
      data: () => ({ displayName: 'Alice', displayNameLower: 'alice', email: 'alice@test.com', photoURL: null, createdAt: 1000 }),
    });

    const result = await firestoreUserRepository.getByIds(['u1', 'u1', 'u1']);

    expect(result).toHaveLength(1);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });
});
