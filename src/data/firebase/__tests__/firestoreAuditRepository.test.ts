import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.hoisted(() => vi.fn(() => ({ id: 'auto-id-123' })));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-audit-col'));
const mockGetDocs = vi.hoisted(() => vi.fn());

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  getDocs: mockGetDocs,
  query: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn(() => 'mock-orderby'),
  limit: vi.fn(() => 'mock-limit'),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import { buildAuditEntry, getAuditLog } from '../firestoreAuditRepository';

describe('buildAuditEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an audit entry object with server timestamp and doc ref', () => {
    const entry = buildAuditEntry('tourney-1', {
      action: 'score_edit',
      actorId: 'user-1',
      actorName: 'Alice',
      actorRole: 'moderator',
      targetType: 'match',
      targetId: 'match-1',
      details: { action: 'score_edit', matchId: 'match-1', oldScores: [[11, 5]], newScores: [[11, 7]], oldWinner: 1, newWinner: 1 },
    });

    expect(entry.action).toBe('score_edit');
    expect(entry.actorId).toBe('user-1');
    expect(entry.actorName).toBe('Alice');
    expect(entry.actorRole).toBe('moderator');
    expect(entry.timestamp).toBe('SERVER_TS');
    expect(entry.id).toBe('auto-id-123');
    expect(entry.ref).toBeDefined();
    expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 'tourney-1', 'auditLog');
  });

  it('includes targetType and targetId in the returned object', () => {
    const entry = buildAuditEntry('t1', {
      action: 'role_change',
      actorId: 'u1',
      actorName: 'Bob',
      actorRole: 'owner',
      targetType: 'staff',
      targetId: 'u2',
      details: { action: 'role_change', targetUid: 'u2', targetName: 'Carol', oldRole: null, newRole: 'moderator' },
    });

    expect(entry.targetType).toBe('staff');
    expect(entry.targetId).toBe('u2');
    expect(entry.details.action).toBe('role_change');
  });
});

describe('getAuditLog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns audit entries ordered by timestamp desc', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'log-1', data: () => ({ action: 'score_edit', actorId: 'u1', timestamp: { toMillis: () => 2000 } }) },
        { id: 'log-2', data: () => ({ action: 'role_change', actorId: 'u2', timestamp: { toMillis: () => 1000 } }) },
      ],
    });

    const entries = await getAuditLog('tourney-1');

    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('log-1');
    expect(entries[0].action).toBe('score_edit');
    expect(entries[1].id).toBe('log-2');
    expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 'tourney-1', 'auditLog');
  });

  it('returns empty array when no entries', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const entries = await getAuditLog('tourney-1');
    expect(entries).toEqual([]);
  });
});
