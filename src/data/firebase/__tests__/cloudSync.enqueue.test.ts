import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../db';
import type { CloudMatch, Match, MatchConfig } from '../../types';

// ── Hoisted mocks ───────────────────────────────────────────────────
const { mockAuth, mockFirestoreMatchRepo, mockMatchRepo, mockFirestoreTournamentRepo } =
  vi.hoisted(() => ({
    mockAuth: { currentUser: null as { uid: string } | null },
    mockFirestoreMatchRepo: {
      save: vi.fn().mockResolvedValue(undefined),
      getByOwner: vi.fn().mockResolvedValue([]),
      getBySharedWith: vi.fn().mockResolvedValue([]),
    },
    mockMatchRepo: {
      save: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(undefined),
    },
    mockFirestoreTournamentRepo: {
      save: vi.fn().mockResolvedValue(undefined),
      getByOrganizer: vi.fn().mockResolvedValue([]),
    },
  }));

vi.mock('../../firebase/config', () => ({
  auth: mockAuth,
  firestore: {},
}));

vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: mockFirestoreMatchRepo,
}));

vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: mockMatchRepo,
}));

vi.mock('../../firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: mockFirestoreTournamentRepo,
}));

vi.mock('../../firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: { saveProfile: vi.fn() },
}));

vi.mock('../../firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: { processMatchCompletion: vi.fn() },
}));

// ── Helpers ─────────────────────────────────────────────────────────
const testConfig: MatchConfig = {
  gameType: 'singles',
  scoringMode: 'rally',
  matchFormat: 'single',
  pointsToWin: 11,
};

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    config: testConfig,
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team A',
    team2Name: 'Team B',
    games: [],
    winningSide: null,
    status: 'completed',
    startedAt: 1000,
    completedAt: 2000,
    ...overrides,
  };
}

function makeCloudMatch(overrides: Partial<CloudMatch> = {}): CloudMatch {
  return {
    id: 'cloud-match-1',
    config: testConfig,
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team A',
    team2Name: 'Team B',
    games: [],
    winningSide: null,
    status: 'completed',
    startedAt: 1000,
    completedAt: 2000,
    ownerId: 'test-user',
    sharedWith: [],
    visibility: 'private',
    syncedAt: 3000,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────
import { cloudSync } from '../cloudSync';

describe('cloudSync enqueue refactoring', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.syncQueue.clear();
    await db.matches.clear();
    mockAuth.currentUser = { uid: 'test-user' } as { uid: string };
  });

  // ── syncMatchToCloud ──────────────────────────────────────────
  describe('syncMatchToCloud', () => {
    it('enqueues a match job into the sync queue', async () => {
      const match = makeMatch({ id: 'match-abc' });
      cloudSync.syncMatchToCloud(match, ['buddy-1']);

      // enqueueJob is async, give it a tick
      await vi.waitFor(async () => {
        const job = await db.syncQueue.get('match:match-abc');
        expect(job).toBeDefined();
        expect(job!.type).toBe('match');
        expect(job!.entityId).toBe('match-abc');
        expect(job!.status).toBe('pending');
        expect(job!.context).toEqual({
          type: 'match',
          ownerId: 'test-user',
          sharedWith: ['buddy-1'],
        });
      });
    });

    it('does nothing when user is not authenticated', async () => {
      mockAuth.currentUser = null;
      const match = makeMatch({ id: 'match-no-auth' });
      cloudSync.syncMatchToCloud(match);

      // Small delay to ensure nothing was enqueued
      await new Promise((r) => setTimeout(r, 50));
      const count = await db.syncQueue.count();
      expect(count).toBe(0);
    });

    it('defaults sharedWith to empty array', async () => {
      const match = makeMatch({ id: 'match-default-shared' });
      cloudSync.syncMatchToCloud(match);

      await vi.waitFor(async () => {
        const job = await db.syncQueue.get('match:match-default-shared');
        expect(job).toBeDefined();
        expect((job!.context as { sharedWith: string[] }).sharedWith).toEqual([]);
      });
    });
  });

  // ── syncTournamentToCloud ─────────────────────────────────────
  describe('syncTournamentToCloud', () => {
    it('enqueues a tournament job into the sync queue', async () => {
      const tournament = { id: 'tourney-1' } as import('../../types').Tournament;
      cloudSync.syncTournamentToCloud(tournament);

      await vi.waitFor(async () => {
        const job = await db.syncQueue.get('tournament:tourney-1');
        expect(job).toBeDefined();
        expect(job!.type).toBe('tournament');
        expect(job!.entityId).toBe('tourney-1');
        expect(job!.context).toEqual({ type: 'tournament' });
      });
    });
  });

  // ── syncPlayerStatsAfterMatch ─────────────────────────────────
  describe('syncPlayerStatsAfterMatch', () => {
    it('enqueues a playerStats job with dependency on match', async () => {
      const match = makeMatch({ id: 'match-stats-1' });
      cloudSync.syncPlayerStatsAfterMatch(match);

      await vi.waitFor(async () => {
        const job = await db.syncQueue.get('playerStats:match-stats-1');
        expect(job).toBeDefined();
        expect(job!.type).toBe('playerStats');
        expect(job!.entityId).toBe('match-stats-1');
        expect(job!.context).toEqual({
          type: 'playerStats',
          scorerUid: 'test-user',
        });
        expect(job!.dependsOn).toEqual(['match:match-stats-1']);
      });
    });

    it('does nothing when user is not authenticated', async () => {
      mockAuth.currentUser = null;
      const match = makeMatch({ id: 'match-no-auth-stats' });
      cloudSync.syncPlayerStatsAfterMatch(match);

      await new Promise((r) => setTimeout(r, 50));
      const count = await db.syncQueue.count();
      expect(count).toBe(0);
    });
  });

  // ── enqueueLocalMatchPush ─────────────────────────────────────
  describe('enqueueLocalMatchPush', () => {
    it('enqueues only owned matches (ownerUid matches user)', async () => {
      const ownedMatch = makeMatch({ id: 'owned-1', ownerUid: 'test-user' });
      const otherMatch = makeMatch({ id: 'other-1', ownerUid: 'other-user' });
      mockMatchRepo.getAll.mockResolvedValue([ownedMatch, otherMatch]);

      const count = await cloudSync.enqueueLocalMatchPush();

      expect(count).toBe(1);
      const job = await db.syncQueue.get('match:owned-1');
      expect(job).toBeDefined();
      const otherJob = await db.syncQueue.get('match:other-1');
      expect(otherJob).toBeUndefined();
    });

    it('enqueues matches with no ownerUid (pre-cloud matches)', async () => {
      const legacyMatch = makeMatch({ id: 'legacy-1', ownerUid: undefined });
      mockMatchRepo.getAll.mockResolvedValue([legacyMatch]);

      const count = await cloudSync.enqueueLocalMatchPush();

      expect(count).toBe(1);
      const job = await db.syncQueue.get('match:legacy-1');
      expect(job).toBeDefined();
    });

    it('returns 0 when user is not authenticated', async () => {
      mockAuth.currentUser = null;
      const count = await cloudSync.enqueueLocalMatchPush();
      expect(count).toBe(0);
    });

    it('returns count of enqueued matches', async () => {
      const m1 = makeMatch({ id: 'm1', ownerUid: 'test-user' });
      const m2 = makeMatch({ id: 'm2', ownerUid: undefined });
      const m3 = makeMatch({ id: 'm3', ownerUid: 'test-user' });
      mockMatchRepo.getAll.mockResolvedValue([m1, m2, m3]);

      const count = await cloudSync.enqueueLocalMatchPush();
      expect(count).toBe(3);
    });
  });

  // ── pullCloudMatchesToLocal ───────────────────────────────────
  describe('pullCloudMatchesToLocal', () => {
    it('copies ownerUid from cloudMatch.ownerId', async () => {
      const cloudMatch = makeCloudMatch({ id: 'cloud-1', ownerId: 'owner-abc' });
      mockFirestoreMatchRepo.getByOwner.mockResolvedValue([cloudMatch]);
      mockFirestoreMatchRepo.getBySharedWith.mockResolvedValue([]);

      await cloudSync.pullCloudMatchesToLocal();

      expect(mockMatchRepo.save).toHaveBeenCalledOnce();
      const savedMatch = mockMatchRepo.save.mock.calls[0][0] as Match;
      expect(savedMatch.ownerUid).toBe('owner-abc');
    });

    it('skips in-progress local matches (never overwrite active scoring)', async () => {
      const cloudMatch = makeCloudMatch({ id: 'active-match', status: 'completed' });
      mockFirestoreMatchRepo.getByOwner.mockResolvedValue([cloudMatch]);
      mockFirestoreMatchRepo.getBySharedWith.mockResolvedValue([]);

      // Simulate local in-progress match
      mockMatchRepo.getById.mockResolvedValue(
        makeMatch({ id: 'active-match', status: 'in-progress' }),
      );

      const count = await cloudSync.pullCloudMatchesToLocal();

      expect(count).toBe(0);
      expect(mockMatchRepo.save).not.toHaveBeenCalled();
    });

    it('writes new matches from cloud (no local match)', async () => {
      const cloudMatch = makeCloudMatch({ id: 'new-cloud-1' });
      mockFirestoreMatchRepo.getByOwner.mockResolvedValue([cloudMatch]);
      mockFirestoreMatchRepo.getBySharedWith.mockResolvedValue([]);
      mockMatchRepo.getById.mockResolvedValue(undefined);

      const count = await cloudSync.pullCloudMatchesToLocal();

      expect(count).toBe(1);
      expect(mockMatchRepo.save).toHaveBeenCalledOnce();
    });

    it('writes completed matches (immutable, safe to overwrite)', async () => {
      const cloudMatch = makeCloudMatch({ id: 'completed-1', status: 'completed' });
      mockFirestoreMatchRepo.getByOwner.mockResolvedValue([cloudMatch]);
      mockFirestoreMatchRepo.getBySharedWith.mockResolvedValue([]);
      mockMatchRepo.getById.mockResolvedValue(
        makeMatch({ id: 'completed-1', status: 'completed' }),
      );

      const count = await cloudSync.pullCloudMatchesToLocal();

      expect(count).toBe(1);
      expect(mockMatchRepo.save).toHaveBeenCalledOnce();
    });

    it('skips matches with pending sync jobs', async () => {
      const cloudMatch = makeCloudMatch({ id: 'pending-sync-1' });
      mockFirestoreMatchRepo.getByOwner.mockResolvedValue([cloudMatch]);
      mockFirestoreMatchRepo.getBySharedWith.mockResolvedValue([]);
      mockMatchRepo.getById.mockResolvedValue(
        makeMatch({ id: 'pending-sync-1', status: 'completed' }),
      );

      // Put a pending sync job for this match
      await db.syncQueue.put({
        id: 'match:pending-sync-1',
        type: 'match',
        entityId: 'pending-sync-1',
        context: { type: 'match', ownerId: 'test-user', sharedWith: [] },
        status: 'pending',
        retryCount: 0,
        nextRetryAt: Date.now(),
        createdAt: Date.now(),
      });

      const count = await cloudSync.pullCloudMatchesToLocal();

      expect(count).toBe(0);
      expect(mockMatchRepo.save).not.toHaveBeenCalled();
    });

    it('re-throws errors instead of silently returning 0', async () => {
      mockFirestoreMatchRepo.getByOwner.mockRejectedValue(new Error('Network error'));

      await expect(cloudSync.pullCloudMatchesToLocal()).rejects.toThrow('Network error');
    });

    it('returns 0 when user is not authenticated', async () => {
      mockAuth.currentUser = null;
      const count = await cloudSync.pullCloudMatchesToLocal();
      expect(count).toBe(0);
    });
  });
});
