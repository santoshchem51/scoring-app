import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../data/db';
import type { TournamentRegistration } from '../../../data/types';

describe('tournamentCacheUtils', () => {
  beforeEach(async () => {
    await db.cachedTournaments.clear();
    await db.cachedTeams.clear();
    await db.cachedPools.clear();
    await db.cachedBrackets.clear();
    await db.cachedRegistrations.clear();
  });

  describe('clearTournamentCache', () => {
    it('clears all 5 cache tables', async () => {
      const now = Date.now();
      await db.cachedTournaments.put({ id: 't1', status: 'pool-play', organizerId: 'u1', cachedAt: now } as any);
      await db.cachedTeams.put({ id: 'tm1', tournamentId: 't1', cachedAt: now } as any);
      await db.cachedPools.put({ id: 'p1', tournamentId: 't1', cachedAt: now } as any);
      await db.cachedBrackets.put({ id: 'b1', tournamentId: 't1', cachedAt: now } as any);
      await db.cachedRegistrations.put({ id: 'r1', tournamentId: 't1', cachedAt: now } as any);

      const { clearTournamentCache } = await import('../tournamentCacheUtils');
      await clearTournamentCache();

      expect(await db.cachedTournaments.count()).toBe(0);
      expect(await db.cachedTeams.count()).toBe(0);
      expect(await db.cachedPools.count()).toBe(0);
      expect(await db.cachedBrackets.count()).toBe(0);
      expect(await db.cachedRegistrations.count()).toBe(0);
    });
  });

  describe('pruneStaleTournamentCache', () => {
    it('removes tournaments with cachedAt older than 90 days', async () => {
      const old = Date.now() - 91 * 24 * 60 * 60 * 1000;
      const recent = Date.now() - 1 * 24 * 60 * 60 * 1000;

      await db.cachedTournaments.bulkPut([
        { id: 'old1', status: 'completed', organizerId: 'u1', cachedAt: old } as any,
        { id: 'recent1', status: 'pool-play', organizerId: 'u1', cachedAt: recent } as any,
      ]);
      await db.cachedTeams.bulkPut([
        { id: 'tm-old', tournamentId: 'old1', cachedAt: old } as any,
        { id: 'tm-recent', tournamentId: 'recent1', cachedAt: recent } as any,
      ]);
      await db.cachedPools.put({ id: 'p-old', tournamentId: 'old1', cachedAt: old } as any);
      await db.cachedBrackets.put({ id: 'b-old', tournamentId: 'old1', cachedAt: old } as any);
      await db.cachedRegistrations.put({ id: 'r-old', tournamentId: 'old1', cachedAt: old } as any);

      const { pruneStaleTournamentCache } = await import('../tournamentCacheUtils');
      await pruneStaleTournamentCache();

      expect(await db.cachedTournaments.count()).toBe(1);
      expect(await db.cachedTeams.count()).toBe(1);
      expect(await db.cachedPools.count()).toBe(0);
      expect(await db.cachedBrackets.count()).toBe(0);
      expect(await db.cachedRegistrations.count()).toBe(0);
    });

    it('does nothing when all cache is recent', async () => {
      const recent = Date.now() - 1000;
      await db.cachedTournaments.put({ id: 't1', status: 'pool-play', organizerId: 'u1', cachedAt: recent } as any);

      const { pruneStaleTournamentCache } = await import('../tournamentCacheUtils');
      await pruneStaleTournamentCache();

      expect(await db.cachedTournaments.count()).toBe(1);
    });
  });

  describe('scrubRegistrationForCache', () => {
    const fullReg: TournamentRegistration = {
      id: 'r1',
      tournamentId: 't1',
      userId: 'u1',
      playerName: 'Alice',
      teamId: 'tm1',
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentNote: 'cash at registration',
      declineReason: null,
      lateEntry: false,
      skillRating: 4.0,
      partnerId: null,
      partnerName: null,
      profileComplete: true,
      registeredAt: 100,
      statusUpdatedAt: 200,
    } as TournamentRegistration;

    it('preserves all fields for organizer role', async () => {
      const { scrubRegistrationForCache } = await import('../tournamentCacheUtils');
      const result = scrubRegistrationForCache(fullReg, 'organizer');
      expect(result.paymentStatus).toBe('paid');
      expect(result.paymentNote).toBe('cash at registration');
      expect(result.skillRating).toBe(4.0);
    });

    it('preserves all fields for scorekeeper role', async () => {
      const { scrubRegistrationForCache } = await import('../tournamentCacheUtils');
      const result = scrubRegistrationForCache(fullReg, 'scorekeeper');
      expect(result.paymentStatus).toBe('paid');
    });

    it('scrubs PII fields for participant role', async () => {
      const { scrubRegistrationForCache } = await import('../tournamentCacheUtils');
      const result = scrubRegistrationForCache(fullReg, 'participant');
      expect(result.id).toBe('r1');
      expect(result.tournamentId).toBe('t1');
      expect(result.userId).toBe('u1');
      expect(result.playerName).toBe('Alice');
      expect(result.teamId).toBe('tm1');
      expect(result.status).toBe('confirmed');
      expect(result.paymentNote).toBeUndefined();
      expect(result.declineReason).toBeUndefined();
    });

    it('scrubs PII fields for viewer role', async () => {
      const { scrubRegistrationForCache } = await import('../tournamentCacheUtils');
      const result = scrubRegistrationForCache(fullReg, 'viewer');
      expect(result.playerName).toBe('Alice');
      expect(result.paymentNote).toBeUndefined();
      expect(result.declineReason).toBeUndefined();
    });
  });
});
