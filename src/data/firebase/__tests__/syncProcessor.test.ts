import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
});
