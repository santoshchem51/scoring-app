import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { db } from '../db';

describe('Dexie v5 schema', () => {
  it('has cachedTournaments table', () => {
    expect(db.cachedTournaments).toBeDefined();
    expect(db.cachedTournaments.schema.primKey.name).toBe('id');
  });

  it('has cachedTeams table', () => {
    expect(db.cachedTeams).toBeDefined();
    expect(db.cachedTeams.schema.primKey.name).toBe('id');
  });

  it('has cachedPools table', () => {
    expect(db.cachedPools).toBeDefined();
    expect(db.cachedPools.schema.primKey.name).toBe('id');
  });

  it('has cachedBrackets table', () => {
    expect(db.cachedBrackets).toBeDefined();
    expect(db.cachedBrackets.schema.primKey.name).toBe('id');
  });

  it('has cachedRegistrations table', () => {
    expect(db.cachedRegistrations).toBeDefined();
    expect(db.cachedRegistrations.schema.primKey.name).toBe('id');
  });

  it('cachedTournaments has status, organizerId, and cachedAt indexes', () => {
    const indexNames = db.cachedTournaments.schema.indexes.map(i => i.name);
    expect(indexNames).toContain('status');
    expect(indexNames).toContain('organizerId');
    expect(indexNames).toContain('cachedAt');
  });

  it('cachedPools has tournamentId index', () => {
    const indexNames = db.cachedPools.schema.indexes.map(i => i.name);
    expect(indexNames).toContain('tournamentId');
  });

  it('can do a round-trip insert and retrieve', async () => {
    await db.cachedTournaments.put({
      id: 'roundtrip-test', status: 'pool-play', organizerId: 'u1', cachedAt: Date.now(),
    } as any);
    const result = await db.cachedTournaments.get('roundtrip-test');
    expect(result?.id).toBe('roundtrip-test');
    await db.cachedTournaments.delete('roundtrip-test');
  });
});
