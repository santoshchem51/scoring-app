import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../../data/db';

describe('tournament cache Dexie operations', () => {
  beforeEach(async () => {
    await db.cachedTournaments.clear();
    await db.cachedTeams.clear();
    await db.cachedPools.clear();
    await db.cachedBrackets.clear();
    await db.cachedRegistrations.clear();
  });

  it('can write and read a cached tournament', async () => {
    await db.cachedTournaments.put({
      id: 't1',
      name: 'Test',
      status: 'pool-play',
      organizerId: 'u1',
      cachedAt: Date.now(),
    } as any);
    const result = await db.cachedTournaments.get('t1');
    expect(result?.name).toBe('Test');
    expect(result?.cachedAt).toBeGreaterThan(0);
  });

  it('can query cached pools by tournamentId', async () => {
    await db.cachedPools.bulkPut([
      { id: 'p1', tournamentId: 't1', cachedAt: Date.now() } as any,
      { id: 'p2', tournamentId: 't1', cachedAt: Date.now() } as any,
      { id: 'p3', tournamentId: 't2', cachedAt: Date.now() } as any,
    ]);
    const pools = await db.cachedPools.where('tournamentId').equals('t1').toArray();
    expect(pools).toHaveLength(2);
  });

  it('can delete all cache for a tournament in a transaction', async () => {
    const now = Date.now();
    await db.cachedTournaments.put({ id: 't1', status: 'completed', organizerId: 'u1', cachedAt: now } as any);
    await db.cachedTeams.put({ id: 'tm1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedPools.put({ id: 'p1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedBrackets.put({ id: 'b1', tournamentId: 't1', cachedAt: now } as any);
    await db.cachedRegistrations.put({ id: 'r1', tournamentId: 't1', cachedAt: now } as any);

    await db.transaction('rw',
      db.cachedTournaments, db.cachedTeams, db.cachedPools,
      db.cachedBrackets, db.cachedRegistrations,
      async () => {
        await Promise.all([
          db.cachedTournaments.delete('t1'),
          db.cachedTeams.where('tournamentId').equals('t1').delete(),
          db.cachedPools.where('tournamentId').equals('t1').delete(),
          db.cachedBrackets.where('tournamentId').equals('t1').delete(),
          db.cachedRegistrations.where('tournamentId').equals('t1').delete(),
        ]);
      },
    );

    expect(await db.cachedTournaments.count()).toBe(0);
    expect(await db.cachedTeams.count()).toBe(0);
    expect(await db.cachedPools.count()).toBe(0);
    expect(await db.cachedBrackets.count()).toBe(0);
    expect(await db.cachedRegistrations.count()).toBe(0);
  });

  it('overwrite semantics: put replaces existing', async () => {
    await db.cachedTournaments.put({ id: 't1', name: 'Old', status: 'registration', organizerId: 'u1', cachedAt: 100 } as any);
    await db.cachedTournaments.put({ id: 't1', name: 'New', status: 'pool-play', organizerId: 'u1', cachedAt: 200 } as any);
    const result = await db.cachedTournaments.get('t1');
    expect(result?.name).toBe('New');
    expect(result?.cachedAt).toBe(200);
  });
});
