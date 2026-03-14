import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.hoisted(() => vi.fn());
const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDoc = vi.hoisted(() => vi.fn((...args: unknown[]) => args.join('/')));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-col'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn(() => 'mock-where'),
  deleteField: vi.fn(() => 'DELETE_FIELD'),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import { migrateTournament, buildStaffFromScorekeeperIds } from '../migrateScorekeeperIds';

describe('buildStaffFromScorekeeperIds', () => {
  it('converts scorekeeperIds array to staff map', () => {
    const result = buildStaffFromScorekeeperIds(['u1', 'u2', 'u3']);
    expect(result.staff).toEqual({ u1: 'scorekeeper', u2: 'scorekeeper', u3: 'scorekeeper' });
    expect(result.staffUids).toEqual(['u1', 'u2', 'u3']);
  });

  it('handles empty array', () => {
    const result = buildStaffFromScorekeeperIds([]);
    expect(result.staff).toEqual({});
    expect(result.staffUids).toEqual([]);
  });

  it('handles duplicate uids', () => {
    const result = buildStaffFromScorekeeperIds(['u1', 'u1', 'u2']);
    expect(result.staff).toEqual({ u1: 'scorekeeper', u2: 'scorekeeper' });
    expect(result.staffUids).toEqual(['u1', 'u2']);
  });
});

describe('migrateTournament', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates tournament with staff map and removes scorekeeperIds', async () => {
    await migrateTournament('t1', ['u1', 'u2']);

    expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        staff: { u1: 'scorekeeper', u2: 'scorekeeper' },
        staffUids: ['u1', 'u2'],
        scorekeeperIds: 'DELETE_FIELD',
      }),
    );
  });

  it('handles empty scorekeeperIds', async () => {
    await migrateTournament('t1', []);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        staff: {},
        staffUids: [],
        scorekeeperIds: 'DELETE_FIELD',
      }),
    );
  });
});
