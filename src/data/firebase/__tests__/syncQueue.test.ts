import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../db';
import type { SyncJob, SyncJobContext } from '../syncQueue.types';
import {
  enqueueJob,
  claimNextJobs,
  completeJob,
  failJob,
  setJobAwaitingAuth,
  resetAwaitingAuthJobs,
  retryJob,
  reclaimStaleJobs,
  pruneCompletedJobs,
  pruneFailedJobs,
  getNextRetryTime,
  getPendingCount,
  getFailedCount,
} from '../syncQueue';

// ── Helpers ──────────────────────────────────────────────────────────

const MATCH_CONTEXT: SyncJobContext = { type: 'match', ownerId: 'u1', sharedWith: [] };
const TOURNAMENT_CONTEXT: SyncJobContext = { type: 'tournament' };
const PLAYER_STATS_CONTEXT: SyncJobContext = { type: 'playerStats', scorerUid: 'u1' };

function createTestJob(overrides: Partial<SyncJob> = {}): SyncJob {
  const entityId = overrides.entityId ?? crypto.randomUUID();
  const type = overrides.type ?? 'match';
  return {
    id: `${type}:${entityId}`,
    type,
    entityId,
    context: MATCH_CONTEXT,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Setup / Teardown ────────────────────────────────────────────────

describe('syncQueue', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    await db.syncQueue.clear();
  });

  // ── enqueueJob ──────────────────────────────────────────────────

  describe('enqueueJob', () => {
    it('creates job with deterministic ID', async () => {
      await enqueueJob('match', 'entity-1', MATCH_CONTEXT);

      const job = await db.syncQueue.get('match:entity-1');
      expect(job).toBeDefined();
      expect(job!.id).toBe('match:entity-1');
      expect(job!.type).toBe('match');
      expect(job!.entityId).toBe('entity-1');
      expect(job!.context).toEqual(MATCH_CONTEXT);
      expect(job!.status).toBe('pending');
      expect(job!.retryCount).toBe(0);
      expect(job!.nextRetryAt).toBeLessThanOrEqual(Date.now());
      expect(job!.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('deduplicates by upserting', async () => {
      await enqueueJob('match', 'entity-1', MATCH_CONTEXT);
      await enqueueJob('match', 'entity-1', MATCH_CONTEXT);

      const count = await db.syncQueue.count();
      expect(count).toBe(1);
    });

    it('preserves retryCount when re-enqueuing processing job', async () => {
      // Manually insert a job that's currently processing with retryCount=3
      const job = createTestJob({
        entityId: 'entity-1',
        type: 'match',
        status: 'processing',
        retryCount: 3,
      });
      await db.syncQueue.put(job);

      // Re-enqueue the same job
      await enqueueJob('match', 'entity-1', MATCH_CONTEXT);

      const updated = await db.syncQueue.get('match:entity-1');
      expect(updated!.retryCount).toBe(3);
      expect(updated!.status).toBe('pending');
    });

    it('resets retryCount when re-enqueuing completed job', async () => {
      const job = createTestJob({
        entityId: 'entity-1',
        type: 'match',
        status: 'completed',
        retryCount: 5,
      });
      await db.syncQueue.put(job);

      await enqueueJob('match', 'entity-1', MATCH_CONTEXT);

      const updated = await db.syncQueue.get('match:entity-1');
      expect(updated!.retryCount).toBe(0);
      expect(updated!.status).toBe('pending');
    });

    it('adds dependsOn for playerStats', async () => {
      await enqueueJob('playerStats', 'ps-1', PLAYER_STATS_CONTEXT, ['match:m1']);

      const job = await db.syncQueue.get('playerStats:ps-1');
      expect(job!.dependsOn).toEqual(['match:m1']);
    });
  });

  // ── claimNextJobs ─────────────────────────────────────────────────

  describe('claimNextJobs', () => {
    it('claims ready pending jobs', async () => {
      const now = Date.now();
      await db.syncQueue.put(
        createTestJob({ entityId: 'j1', status: 'pending', nextRetryAt: now - 1000 }),
      );

      const claimed = await claimNextJobs(5);

      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe('match:j1');
      expect(claimed[0].status).toBe('processing');
      expect(claimed[0].processedAt).toBeDefined();

      // Verify persisted
      const persisted = await db.syncQueue.get('match:j1');
      expect(persisted!.status).toBe('processing');
    });

    it('skips jobs with nextRetryAt in future', async () => {
      const now = Date.now();
      await db.syncQueue.put(
        createTestJob({ entityId: 'j1', status: 'pending', nextRetryAt: now + 60_000 }),
      );

      const claimed = await claimNextJobs(5);

      expect(claimed).toHaveLength(0);
    });

    it('skips jobs with unsatisfied dependencies', async () => {
      const now = Date.now();
      // Dependency job is still pending (not completed)
      await db.syncQueue.put(
        createTestJob({ entityId: 'm1', status: 'pending', nextRetryAt: now - 1000 }),
      );
      // Dependent job depends on the above
      await db.syncQueue.put(
        createTestJob({
          entityId: 'ps-1',
          type: 'playerStats',
          context: PLAYER_STATS_CONTEXT,
          status: 'pending',
          nextRetryAt: now - 1000,
          dependsOn: ['match:m1'],
        }),
      );

      const claimed = await claimNextJobs(5);

      // Only the match job should be claimed, not the playerStats
      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe('match:m1');
    });

    it('claims dependent job after dependency completed', async () => {
      const now = Date.now();
      // Dependency is completed
      await db.syncQueue.put(
        createTestJob({
          entityId: 'm1',
          status: 'completed',
          nextRetryAt: now - 1000,
          completedAt: now,
        }),
      );
      // Dependent job
      await db.syncQueue.put(
        createTestJob({
          entityId: 'ps-1',
          type: 'playerStats',
          context: PLAYER_STATS_CONTEXT,
          status: 'pending',
          nextRetryAt: now - 1000,
          dependsOn: ['match:m1'],
        }),
      );

      const claimed = await claimNextJobs(5);

      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe('playerStats:ps-1');
    });

    it('fails dependent job when dependency fails', async () => {
      const now = Date.now();
      // Dependency has failed
      await db.syncQueue.put(
        createTestJob({
          entityId: 'm1',
          status: 'failed',
          nextRetryAt: now - 1000,
          lastError: 'fatal error',
        }),
      );
      // Dependent job
      await db.syncQueue.put(
        createTestJob({
          entityId: 'ps-1',
          type: 'playerStats',
          context: PLAYER_STATS_CONTEXT,
          status: 'pending',
          nextRetryAt: now - 1000,
          dependsOn: ['match:m1'],
        }),
      );

      const claimed = await claimNextJobs(5);

      // The dependent job should not be claimed (it was cascade-failed)
      expect(claimed).toHaveLength(0);

      // Verify the dependent job was marked as failed
      const dependent = await db.syncQueue.get('playerStats:ps-1');
      expect(dependent!.status).toBe('failed');
      expect(dependent!.lastError).toContain('match:m1');
    });

    it('limits to maxConcurrent', async () => {
      const now = Date.now();
      await db.syncQueue.bulkPut([
        createTestJob({ entityId: 'j1', status: 'pending', nextRetryAt: now - 3000 }),
        createTestJob({ entityId: 'j2', status: 'pending', nextRetryAt: now - 2000 }),
        createTestJob({ entityId: 'j3', status: 'pending', nextRetryAt: now - 1000 }),
      ]);

      const claimed = await claimNextJobs(2);

      expect(claimed).toHaveLength(2);
    });
  });

  // ── completeJob ───────────────────────────────────────────────────

  describe('completeJob', () => {
    it('marks as completed with timestamp', async () => {
      const job = createTestJob({ entityId: 'j1', status: 'processing' });
      await db.syncQueue.put(job);

      const before = Date.now();
      await completeJob('match:j1');
      const after = Date.now();

      const updated = await db.syncQueue.get('match:j1');
      expect(updated!.status).toBe('completed');
      expect(updated!.completedAt).toBeGreaterThanOrEqual(before);
      expect(updated!.completedAt).toBeLessThanOrEqual(after);
    });
  });

  // ── failJob ───────────────────────────────────────────────────────

  describe('failJob', () => {
    it('marks as failed with error', async () => {
      const job = createTestJob({ entityId: 'j1', status: 'processing' });
      await db.syncQueue.put(job);

      await failJob('match:j1', 'Something went wrong');

      const updated = await db.syncQueue.get('match:j1');
      expect(updated!.status).toBe('failed');
      expect(updated!.lastError).toBe('Something went wrong');
    });
  });

  // ── setJobAwaitingAuth ────────────────────────────────────────────

  describe('setJobAwaitingAuth', () => {
    it('sets status to awaitingAuth', async () => {
      const job = createTestJob({ entityId: 'j1', status: 'processing' });
      await db.syncQueue.put(job);

      await setJobAwaitingAuth('match:j1');

      const updated = await db.syncQueue.get('match:j1');
      expect(updated!.status).toBe('awaitingAuth');
    });
  });

  // ── resetAwaitingAuthJobs ─────────────────────────────────────────

  describe('resetAwaitingAuthJobs', () => {
    it('resets all awaitingAuth jobs to pending', async () => {
      await db.syncQueue.bulkPut([
        createTestJob({ entityId: 'j1', status: 'awaitingAuth' }),
        createTestJob({ entityId: 'j2', status: 'awaitingAuth' }),
        createTestJob({ entityId: 'j3', status: 'pending' }),
      ]);

      const count = await resetAwaitingAuthJobs();

      expect(count).toBe(2);

      const j1 = await db.syncQueue.get('match:j1');
      expect(j1!.status).toBe('pending');
      expect(j1!.nextRetryAt).toBeLessThanOrEqual(Date.now());

      const j2 = await db.syncQueue.get('match:j2');
      expect(j2!.status).toBe('pending');

      // j3 should be unchanged
      const j3 = await db.syncQueue.get('match:j3');
      expect(j3!.status).toBe('pending');
    });

    it('reads and writes within a single transaction (atomic)', async () => {
      // Enqueue two awaitingAuth jobs
      await enqueueJob('match', 'm1', { type: 'match', ownerId: 'u1', sharedWith: [] });
      await setJobAwaitingAuth('match:m1');
      await enqueueJob('match', 'm2', { type: 'match', ownerId: 'u1', sharedWith: [] });
      await setJobAwaitingAuth('match:m2');

      const txSpy = vi.spyOn(db, 'transaction');

      const count = await resetAwaitingAuthJobs();

      expect(count).toBe(2);
      expect(txSpy).toHaveBeenCalledWith('rw', db.syncQueue, expect.any(Function));

      const j1 = await db.syncQueue.get('match:m1');
      const j2 = await db.syncQueue.get('match:m2');
      expect(j1?.status).toBe('pending');
      expect(j2?.status).toBe('pending');

      txSpy.mockRestore();
    });
  });

  // ── retryJob ──────────────────────────────────────────────────────

  describe('retryJob', () => {
    it('increments retryCount and resets to pending', async () => {
      const job = createTestJob({ entityId: 'j1', status: 'processing', retryCount: 2 });
      await db.syncQueue.put(job);

      const futureTime = Date.now() + 30_000;
      await retryJob('match:j1', futureTime);

      const updated = await db.syncQueue.get('match:j1');
      expect(updated!.status).toBe('pending');
      expect(updated!.retryCount).toBe(3);
      expect(updated!.nextRetryAt).toBe(futureTime);
    });

    it('reads and writes within a single transaction (atomic)', async () => {
      const job = createTestJob({ entityId: 'j1', status: 'processing', retryCount: 1 });
      await db.syncQueue.put(job);

      const txSpy = vi.spyOn(db, 'transaction');

      await retryJob('match:j1', Date.now() + 60_000);

      expect(txSpy).toHaveBeenCalledWith('rw', db.syncQueue, expect.any(Function));

      const updated = await db.syncQueue.get('match:j1');
      expect(updated!.retryCount).toBe(2);

      txSpy.mockRestore();
    });

    it('no-ops if job does not exist', async () => {
      // Should not throw
      await retryJob('match:nonexistent', Date.now() + 60_000);
    });
  });

  // ── reclaimStaleJobs ──────────────────────────────────────────────

  describe('reclaimStaleJobs', () => {
    it('reclaims old processing jobs (processedAt > 10 min ago)', async () => {
      const now = Date.now();
      const elevenMinAgo = now - 11 * 60 * 1000;
      await db.syncQueue.put(
        createTestJob({
          entityId: 'j1',
          status: 'processing',
          processedAt: elevenMinAgo,
        }),
      );

      const count = await reclaimStaleJobs();

      expect(count).toBe(1);

      const updated = await db.syncQueue.get('match:j1');
      expect(updated!.status).toBe('pending');
    });

    it('reads and writes within a single transaction (atomic)', async () => {
      const now = Date.now();
      const elevenMinAgo = now - 11 * 60 * 1000;
      await db.syncQueue.put(
        createTestJob({
          entityId: 'stale1',
          status: 'processing',
          processedAt: elevenMinAgo,
        }),
      );

      const txSpy = vi.spyOn(db, 'transaction');

      const count = await reclaimStaleJobs();

      expect(count).toBe(1);
      expect(txSpy).toHaveBeenCalledWith('rw', db.syncQueue, expect.any(Function));

      const updated = await db.syncQueue.get('match:stale1');
      expect(updated!.status).toBe('pending');

      txSpy.mockRestore();
    });

    it('does not reclaim recent processing jobs', async () => {
      const now = Date.now();
      await db.syncQueue.put(
        createTestJob({
          entityId: 'j1',
          status: 'processing',
          processedAt: now - 5 * 60 * 1000, // 5 min ago, not stale
        }),
      );

      const count = await reclaimStaleJobs();

      expect(count).toBe(0);

      const updated = await db.syncQueue.get('match:j1');
      expect(updated!.status).toBe('processing');
    });
  });

  // ── pruneCompletedJobs ────────────────────────────────────────────

  describe('pruneCompletedJobs', () => {
    it('removes completed jobs older than 24 hours', async () => {
      const now = Date.now();
      const twoDaysAgo = now - 48 * 60 * 60 * 1000;
      await db.syncQueue.put(
        createTestJob({
          entityId: 'j1',
          status: 'completed',
          completedAt: twoDaysAgo,
        }),
      );

      const count = await pruneCompletedJobs();

      expect(count).toBe(1);
      const job = await db.syncQueue.get('match:j1');
      expect(job).toBeUndefined();
    });

    it('keeps recent completed jobs', async () => {
      const now = Date.now();
      await db.syncQueue.put(
        createTestJob({
          entityId: 'j1',
          status: 'completed',
          completedAt: now - 1 * 60 * 60 * 1000, // 1 hour ago
        }),
      );

      const count = await pruneCompletedJobs();

      expect(count).toBe(0);
      const job = await db.syncQueue.get('match:j1');
      expect(job).toBeDefined();
    });
  });

  // ── pruneFailedJobs ───────────────────────────────────────────────

  describe('pruneFailedJobs', () => {
    it('removes failed jobs older than 30 days', async () => {
      const now = Date.now();
      const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
      await db.syncQueue.put(
        createTestJob({
          entityId: 'j1',
          status: 'failed',
          createdAt: thirtyOneDaysAgo,
          lastError: 'fatal',
        }),
      );

      const count = await pruneFailedJobs();

      expect(count).toBe(1);
      const job = await db.syncQueue.get('match:j1');
      expect(job).toBeUndefined();
    });
  });

  // ── getNextRetryTime ──────────────────────────────────────────────

  describe('getNextRetryTime', () => {
    it('returns earliest nextRetryAt among pending jobs', async () => {
      const now = Date.now();
      await db.syncQueue.bulkPut([
        createTestJob({ entityId: 'j1', status: 'pending', nextRetryAt: now + 5000 }),
        createTestJob({ entityId: 'j2', status: 'pending', nextRetryAt: now + 1000 }),
        createTestJob({ entityId: 'j3', status: 'pending', nextRetryAt: now + 9000 }),
      ]);

      const result = await getNextRetryTime();

      expect(result).toBe(now + 1000);
    });

    it('returns null when no pending jobs', async () => {
      const result = await getNextRetryTime();
      expect(result).toBeNull();
    });
  });

  // ── getPendingCount ───────────────────────────────────────────────

  describe('getPendingCount', () => {
    it('counts pending, processing, and awaitingAuth jobs', async () => {
      await db.syncQueue.bulkPut([
        createTestJob({ entityId: 'j1', status: 'pending' }),
        createTestJob({ entityId: 'j2', status: 'processing' }),
        createTestJob({ entityId: 'j3', status: 'awaitingAuth' }),
        createTestJob({ entityId: 'j4', status: 'completed' }),
        createTestJob({ entityId: 'j5', status: 'failed' }),
      ]);

      const count = await getPendingCount();

      expect(count).toBe(3);
    });
  });

  // ── getFailedCount ────────────────────────────────────────────────

  describe('getFailedCount', () => {
    it('counts only failed jobs', async () => {
      await db.syncQueue.bulkPut([
        createTestJob({ entityId: 'j1', status: 'pending' }),
        createTestJob({ entityId: 'j2', status: 'failed', lastError: 'err1' }),
        createTestJob({ entityId: 'j3', status: 'failed', lastError: 'err2' }),
      ]);

      const count = await getFailedCount();

      expect(count).toBe(2);
    });
  });
});
