import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteBatch = vi.hoisted(() => {
  const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  return vi.fn(() => batch);
});
const mockDoc = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ id: `auto-${args.length}`, path: args.join('/') })));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-reg-col'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  writeBatch: mockWriteBatch,
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  increment: vi.fn((n: number) => ({ _type: 'increment', value: n })),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));
vi.mock('../firestoreAuditRepository', () => ({
  buildAuditEntry: vi.fn(() => ({
    id: 'audit-1',
    ref: { id: 'audit-1' },
    action: 'player_quick_add',
    timestamp: 'SERVER_TS',
  })),
}));

import { quickAddPlayers } from '../firestoreQuickAddRepository';

describe('quickAddPlayers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates placeholder registrations in a batch', async () => {
    await quickAddPlayers({
      tournamentId: 't1',
      names: ['Alice', 'Bob'],
      actorId: 'u1',
      actorName: 'Organizer',
      actorRole: 'owner',
    });

    const batch = mockWriteBatch();
    // 2 registration docs + 1 audit doc = 3 batch.set calls
    // 1 counter update = 1 batch.update call
    expect(batch.set).toHaveBeenCalledTimes(3);
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.commit).toHaveBeenCalled();
  });

  it('creates registrations with placeholder status and null userId', async () => {
    await quickAddPlayers({
      tournamentId: 't1',
      names: ['Alice'],
      actorId: 'u1',
      actorName: 'Organizer',
      actorRole: 'admin',
    });

    const batch = mockWriteBatch();
    const regCall = batch.set.mock.calls[0];
    const regData = regCall[1];
    expect(regData.status).toBe('placeholder');
    expect(regData.userId).toBeNull();
    expect(regData.playerName).toBe('Alice');
    expect(regData.source).toBe('quick-add');
    expect(regData.claimedBy).toBeNull();
  });

  it('writes audit entry for player_quick_add', async () => {
    const { buildAuditEntry } = await import('../firestoreAuditRepository');

    await quickAddPlayers({
      tournamentId: 't1',
      names: ['Alice', 'Bob', 'Carol'],
      actorId: 'u1',
      actorName: 'Organizer',
      actorRole: 'owner',
    });

    expect(buildAuditEntry).toHaveBeenCalledWith('t1', expect.objectContaining({
      action: 'player_quick_add',
      details: expect.objectContaining({ count: 3, names: ['Alice', 'Bob', 'Carol'] }),
    }));
  });
});
