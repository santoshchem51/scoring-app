import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../db';
import type { SyncJob } from '../syncQueue.types';

// ── Mock all Firestore repos and config ──────────────────────────────

vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: { save: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: { save: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: { processMatchCompletion: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'test-user', getIdToken: vi.fn().mockResolvedValue('token') } },
  firestore: {},
}));
vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {
    getById: vi.fn().mockResolvedValue({
      id: '1',
      config: {
        gameType: 'singles',
        scoringMode: 'sideout',
        matchFormat: 'single',
        pointsToWin: 11,
      },
      team1PlayerIds: [],
      team2PlayerIds: [],
      team1Name: 'A',
      team2Name: 'B',
      games: [],
      winningSide: 1,
      status: 'completed',
      startedAt: 1000,
      completedAt: 2000,
    }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────

function createTestJob(overrides: Partial<SyncJob> = {}): SyncJob {
  const entityId = overrides.entityId ?? crypto.randomUUID();
  const type = overrides.type ?? 'match';
  return {
    id: `${type}:${entityId}`,
    type,
    entityId,
    context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    status: 'pending',
    retryCount: 0,
    nextRetryAt: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('syncProcessor', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    try {
      const { stopProcessor } = await import('../syncProcessor');
      stopProcessor();
    } catch {}
    vi.useRealTimers();
    await db.syncQueue.clear();
  });

  describe('runStartupCleanup', () => {
    it('reclaims stale processing jobs', async () => {
      // Insert a job stuck in 'processing' for over 10 minutes
      const staleJob = createTestJob({
        status: 'processing',
        processedAt: Date.now() - 11 * 60 * 1000, // 11 minutes ago
      });
      await db.syncQueue.put(staleJob);

      const { runStartupCleanup } = await import('../syncProcessor');
      await runStartupCleanup();

      const updated = await db.syncQueue.get(staleJob.id);
      expect(updated!.status).toBe('pending');
    });

    it('prunes old completed jobs', async () => {
      // Insert a completed job older than 24 hours
      const oldJob = createTestJob({
        status: 'completed',
        completedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      });
      await db.syncQueue.put(oldJob);

      const { runStartupCleanup } = await import('../syncProcessor');
      await runStartupCleanup();

      const deleted = await db.syncQueue.get(oldJob.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('exports', () => {
    it('startProcessor and stopProcessor are exported functions', async () => {
      const mod = await import('../syncProcessor');
      expect(typeof mod.startProcessor).toBe('function');
      expect(typeof mod.stopProcessor).toBe('function');
    });

    it('wakeProcessor is exported', async () => {
      const mod = await import('../syncProcessor');
      expect(typeof mod.wakeProcessor).toBe('function');
    });

    it('STALE_CHECK_INTERVAL_MS is exported and within reasonable range (60s-300s)', async () => {
      const mod = await import('../syncProcessor');
      expect(typeof mod.STALE_CHECK_INTERVAL_MS).toBe('number');
      expect(mod.STALE_CHECK_INTERVAL_MS).toBeGreaterThanOrEqual(60_000);
      expect(mod.STALE_CHECK_INTERVAL_MS).toBeLessThanOrEqual(300_000);
    });
  });

  describe('stopProcessor', () => {
    it('resets sync status signals to defaults', async () => {
      const { setSyncProcessing, syncStatus, pendingCount, failedCount } =
        await import('../useSyncStatus');
      const { stopProcessor } = await import('../syncProcessor');

      // Dirty the signals so we can verify they get reset
      setSyncProcessing();
      expect(syncStatus()).toBe('processing');

      stopProcessor();

      expect(syncStatus()).toBe('idle');
      expect(pendingCount()).toBe(0);
      expect(failedCount()).toBe(0);
    });
  });

  describe('JOB_TIMEOUT_MAP', () => {
    it('uses longer timeout for playerStats than match/tournament', async () => {
      const mod = await import('../syncProcessor');
      expect(mod.JOB_TIMEOUT_MAP.playerStats).toBeGreaterThan(mod.JOB_TIMEOUT_MAP.match);
      expect(mod.JOB_TIMEOUT_MAP.match).toBe(mod.JOB_TIMEOUT_MAP.tournament);
    });

    it('playerStats timeout is at least 30 seconds', async () => {
      const mod = await import('../syncProcessor');
      expect(mod.JOB_TIMEOUT_MAP.playerStats).toBeGreaterThanOrEqual(30_000);
    });
  });

  describe('job execution dispatch', () => {
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);

    /** Wait until a job reaches a terminal status or timeout. */
    async function waitForJobStatus(
      jobId: string,
      targets: string[],
      timeoutMs = 3000,
    ): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const job = await db.syncQueue.get(jobId);
        if (job && targets.includes(job.status)) return;
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    it('match job calls firestoreMatchRepository.save with correct args', async () => {
      const entityId = crypto.randomUUID();
      const sharedWith = ['user-a', 'user-b'];
      const job = createTestJob({
        entityId,
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith },
      });
      await db.syncQueue.put(job);

      const { firestoreMatchRepository } = await import('../../firebase/firestoreMatchRepository');
      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      await waitForJobStatus(job.id, ['completed', 'failed']);

      expect(firestoreMatchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1' }),
        'test-user',
        sharedWith,
        undefined,
      );

      const updated = await db.syncQueue.get(job.id);
      expect(updated!.status).toBe('completed');

      stopProcessor();
    }, 10_000);

    it('tournament job calls firestoreTournamentRepository.save', async () => {
      const tournamentId = crypto.randomUUID();
      const tournament = {
        id: tournamentId,
        name: 'Test Tourney',
        date: Date.now(),
        location: 'Court 1',
        format: 'pools' as const,
        config: {
          gameType: 'singles' as const,
          scoringMode: 'sideout' as const,
          matchFormat: 'single' as const,
          pointsToWin: 11 as const,
          poolCount: 2,
          teamsPerPoolAdvancing: 1,
        },
        organizerId: 'org1',
        staff: {},
        staffUids: [],
        status: 'draft' as const,
        maxPlayers: null,
        teamFormation: null,
        minPlayers: null,
        entryFee: null,
        rules: {
          registrationDeadline: null,
          checkInRequired: false,
          checkInOpens: null,
          checkInCloses: null,
          scoringRules: '',
          timeoutRules: '',
          conductRules: '',
          penalties: [],
          additionalNotes: '',
        },
        pausedFrom: null,
      };
      await db.tournaments.put(tournament);

      const job = createTestJob({
        entityId: tournamentId,
        type: 'tournament',
        context: { type: 'tournament' },
      });
      await db.syncQueue.put(job);

      const { firestoreTournamentRepository } = await import('../../firebase/firestoreTournamentRepository');
      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      await waitForJobStatus(job.id, ['completed', 'failed']);

      expect(firestoreTournamentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: tournamentId, name: 'Test Tourney' }),
      );

      const updated = await db.syncQueue.get(job.id);
      expect(updated!.status).toBe('completed');

      stopProcessor();
      await db.tournaments.delete(tournamentId);
    }, 10_000);

    it('playerStats job calls firestorePlayerStatsRepository.processMatchCompletion', async () => {
      const entityId = crypto.randomUUID();
      const job = createTestJob({
        entityId,
        type: 'playerStats',
        context: { type: 'playerStats', scorerUid: 'scorer-1' },
      });
      await db.syncQueue.put(job);

      const { firestorePlayerStatsRepository } = await import('../../firebase/firestorePlayerStatsRepository');
      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      await waitForJobStatus(job.id, ['completed', 'failed']);

      expect(firestorePlayerStatsRepository.processMatchCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1' }),
        'scorer-1',
      );

      stopProcessor();
    }, 10_000);

    it('job with no local entity fails with fatal error', async () => {
      const { matchRepository } = await import('../../repositories/matchRepository');
      (matchRepository.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const entityId = crypto.randomUUID();
      const job = createTestJob({
        entityId,
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.put(job);

      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      await waitForJobStatus(job.id, ['completed', 'failed']);

      const updated = await db.syncQueue.get(job.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.lastError).toContain('not found');

      stopProcessor();
    }, 10_000);
  });

  describe('error handling routing', () => {
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);

    /** Wait until a job reaches one of the target statuses or timeout. */
    async function waitForJobStatus(
      jobId: string,
      targets: string[],
      timeoutMs = 3000,
    ): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const job = await db.syncQueue.get(jobId);
        if (job && targets.includes(job.status)) return;
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    /** Wait until a job satisfies a custom predicate or timeout. */
    async function waitForJobCondition(
      jobId: string,
      predicate: (job: SyncJob) => boolean,
      timeoutMs = 5000,
    ): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const job = await db.syncQueue.get(jobId);
        if (job && predicate(job)) return;
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    it('retryable error (unavailable) → job retried with incremented retryCount', async () => {
      const { firestoreMatchRepository } = await import('../../firebase/firestoreMatchRepository');
      const err = new Error('Service unavailable');
      (err as any).code = 'unavailable';
      vi.mocked(firestoreMatchRepository.save).mockRejectedValueOnce(err);

      const entityId = crypto.randomUUID();
      const job = createTestJob({
        entityId,
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.put(job);

      const now = Date.now();
      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      // Wait for the job to be retried: it goes pending → processing → pending(retryCount=1)
      await waitForJobCondition(job.id, (j) => j.status === 'pending' && j.retryCount === 1);

      const updated = await db.syncQueue.get(job.id);
      expect(updated!.status).toBe('pending');
      expect(updated!.retryCount).toBe(1);
      expect(updated!.nextRetryAt).toBeGreaterThan(now);

      stopProcessor();
    }, 10_000);

    it('auth error (unauthenticated) → job set to awaitingAuth', async () => {
      const { firestoreMatchRepository } = await import('../../firebase/firestoreMatchRepository');
      const err = new Error('Not authenticated');
      (err as any).code = 'unauthenticated';
      vi.mocked(firestoreMatchRepository.save).mockRejectedValueOnce(err);

      const entityId = crypto.randomUUID();
      const job = createTestJob({
        entityId,
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.put(job);

      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      await waitForJobStatus(job.id, ['awaitingAuth']);

      const updated = await db.syncQueue.get(job.id);
      expect(updated!.status).toBe('awaitingAuth');

      stopProcessor();
    }, 10_000);

    it('fatal error (invalid-argument) → job marked failed', async () => {
      const { firestoreMatchRepository } = await import('../../firebase/firestoreMatchRepository');
      const err = new Error('Invalid data');
      (err as any).code = 'invalid-argument';
      vi.mocked(firestoreMatchRepository.save).mockRejectedValueOnce(err);

      const entityId = crypto.randomUUID();
      const job = createTestJob({
        entityId,
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.put(job);

      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      await waitForJobStatus(job.id, ['failed']);

      const updated = await db.syncQueue.get(job.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.lastError).toContain('Invalid data');

      stopProcessor();
    }, 10_000);

    it('max retries exceeded → job marked failed with "Max retries" message', async () => {
      const { firestoreMatchRepository } = await import('../../firebase/firestoreMatchRepository');
      const err = new Error('Service unavailable');
      (err as any).code = 'unavailable';
      vi.mocked(firestoreMatchRepository.save).mockRejectedValueOnce(err);

      const entityId = crypto.randomUUID();
      const job = createTestJob({
        entityId,
        type: 'match',
        retryCount: 7, // match maxRetries is 7, so retryCount >= 7 triggers max exceeded
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.put(job);

      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      await waitForJobStatus(job.id, ['failed']);

      const updated = await db.syncQueue.get(job.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.lastError).toContain('Max retries');

      stopProcessor();
    }, 10_000);
  });

  describe('per-entity serialization', () => {
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);

    /** Wait until a job reaches one of the target statuses or timeout. */
    async function waitForJobStatus(
      jobId: string,
      targets: string[],
      timeoutMs = 3000,
    ): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const job = await db.syncQueue.get(jobId);
        if (job && targets.includes(job.status)) return;
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    it('two jobs for the same entity — only one processes at a time', async () => {
      const { firestoreMatchRepository } = await import('../../firebase/firestoreMatchRepository');

      // Control when the first save resolves — keep it blocking
      let resolveSave!: () => void;
      vi.mocked(firestoreMatchRepository.save).mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveSave = resolve; }),
      );

      // Insert only the first job so it gets picked up alone
      const jobA = createTestJob({
        id: 'match:same-1',
        entityId: 'same-1',
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.put(jobA);

      const { startProcessor, stopProcessor, wakeProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);

      // Wait for jobA to start processing (its save is now blocked)
      await waitForJobStatus(jobA.id, ['processing']);

      // Now insert a second job for the SAME entity while jobA is still in-flight
      const jobB = createTestJob({
        id: 'match:same-1-dup',
        entityId: 'same-1',
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.put(jobB);
      wakeProcessor(); // wake so it picks up jobB immediately

      // Wait for jobB to be claimed and put back (it goes processing → pending)
      await new Promise((r) => setTimeout(r, 300));

      // Only one save call should have been made — jobB was filtered out
      expect(firestoreMatchRepository.save).toHaveBeenCalledTimes(1);

      // jobB should be back to pending (put back because entity in-flight)
      const updatedB = await db.syncQueue.get(jobB.id);
      expect(updatedB!.status).toBe('pending');

      // Resolve the first save so jobA completes
      resolveSave();
      await waitForJobStatus(jobA.id, ['completed'], 5000);

      stopProcessor();

      const updatedA = await db.syncQueue.get(jobA.id);
      expect(updatedA!.status).toBe('completed');
    }, 15_000);

    it('different entities process concurrently', async () => {
      const { firestoreMatchRepository } = await import('../../firebase/firestoreMatchRepository');

      const jobA = createTestJob({
        entityId: 'entity-a',
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      const jobB = createTestJob({
        entityId: 'entity-b',
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.bulkPut([jobA, jobB]);

      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);
      await waitForJobStatus(jobA.id, ['completed'], 5000);
      await waitForJobStatus(jobB.id, ['completed'], 5000);

      // MAX_CONCURRENT=2 allows both to run concurrently
      expect(firestoreMatchRepository.save).toHaveBeenCalledTimes(2);

      const updatedA = await db.syncQueue.get(jobA.id);
      const updatedB = await db.syncQueue.get(jobB.id);
      expect(updatedA!.status).toBe('completed');
      expect(updatedB!.status).toBe('completed');

      stopProcessor();
    }, 10_000);
  });

  describe('processor lifecycle', () => {
    it('startProcessor is idempotent — calling twice does not double-start', async () => {
      const lockSpy = vi.fn((_name: string, _opts: any, cb: any) => cb(null));

      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(lockSpy as any);
      startProcessor(lockSpy as any);

      // The lock should only be acquired once because the second call returns early
      expect(lockSpy).toHaveBeenCalledTimes(1);

      stopProcessor();
    });

    it('stopProcessor cleans up online/offline listeners', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);

      // Verify listeners were added
      const addedOnline = addSpy.mock.calls.some((call) => call[0] === 'online');
      const addedOffline = addSpy.mock.calls.some((call) => call[0] === 'offline');
      expect(addedOnline).toBe(true);
      expect(addedOffline).toBe(true);

      stopProcessor();

      // Verify listeners were removed
      const removedOnline = removeSpy.mock.calls.some((call) => call[0] === 'online');
      const removedOffline = removeSpy.mock.calls.some((call) => call[0] === 'offline');
      expect(removedOnline).toBe(true);
      expect(removedOffline).toBe(true);

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('no-auth guard', () => {
    it('processOnce skips when no auth.currentUser', async () => {
      const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);

      const authModule = await import('../../firebase/config');

      // Save original value and override to null
      const originalUser = authModule.auth.currentUser;
      Object.defineProperty(authModule.auth, 'currentUser', {
        get: () => null,
        configurable: true,
      });

      const job = createTestJob({
        entityId: 'no-auth-entity',
        type: 'match',
        context: { type: 'match', ownerId: 'u1', sharedWith: [] },
      });
      await db.syncQueue.put(job);

      const { startProcessor, stopProcessor } = await import('../syncProcessor');

      startProcessor(fakeLock);

      // Wait enough time for at least one poll cycle
      await new Promise((r) => setTimeout(r, 500));

      // Job should still be pending — processOnce skips when no auth
      const updated = await db.syncQueue.get(job.id);
      expect(updated!.status).toBe('pending');

      stopProcessor();

      // Restore original auth.currentUser
      Object.defineProperty(authModule.auth, 'currentUser', {
        get: () => originalUser,
        configurable: true,
      });
    }, 10_000);
  });
});
