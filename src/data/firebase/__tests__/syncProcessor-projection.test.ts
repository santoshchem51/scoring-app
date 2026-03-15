import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../db';
import type { SyncJob } from '../syncQueue.types';
import type { Match } from '../../types';

// ── Spectator repository mock ───────────────────────────────────────

const mockBuildSpectatorProjection = vi.fn().mockReturnValue({
  publicTeam1Name: 'Team A',
  publicTeam2Name: 'Team B',
  team1Score: 5,
  team2Score: 3,
  gameNumber: 1,
  team1Wins: 0,
  team2Wins: 0,
  status: 'in-progress',
  visibility: 'public',
  tournamentId: 'tourney-1',
  spectatorCount: 0,
  updatedAt: Date.now(),
});
const mockWriteSpectatorProjection = vi.fn().mockResolvedValue(undefined);

vi.mock('../../firebase/firestoreSpectatorRepository', () => ({
  buildSpectatorProjection: (...args: unknown[]) => mockBuildSpectatorProjection(...args),
  writeSpectatorProjection: (...args: unknown[]) => mockWriteSpectatorProjection(...args),
}));

// ── Mock all other Firestore repos and config ───────────────────────

vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: { save: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: { save: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'test-user', getIdToken: vi.fn().mockResolvedValue('token') } },
  firestore: {},
}));

// ── Match repository mock (configurable per test) ───────────────────

const mockGetById = vi.fn();
vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────

const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    config: {
      gameType: 'singles',
      scoringMode: 'sideout',
      matchFormat: 'single',
      pointsToWin: 11,
    },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team A',
    team2Name: 'Team B',
    games: [],
    winningSide: null,
    status: 'in-progress',
    startedAt: 1000,
    completedAt: null,
    tournamentId: 'tourney-1',
    ...overrides,
  };
}

function createTestJob(overrides: Partial<SyncJob> = {}): SyncJob {
  const entityId = overrides.entityId ?? 'match-1';
  const type = overrides.type ?? 'match';
  return {
    id: `${type}:${entityId}`,
    type,
    entityId,
    context: { type: 'match', ownerId: 'u1', sharedWith: [], visibility: 'public' },
    status: 'pending',
    retryCount: 0,
    nextRetryAt: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

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

// ── Tests ───────────────────────────────────────────────────────────

describe('syncProcessor — spectator projection piggybacking', () => {
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
    await db.syncQueue.clear();
  });

  it('writes spectator projection for public in-progress tournament match', async () => {
    const match = makeMatch({ status: 'in-progress', tournamentId: 'tourney-1' });
    mockGetById.mockResolvedValue(match);

    const job = createTestJob({
      context: { type: 'match', ownerId: 'u1', sharedWith: [], visibility: 'public' },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    startProcessor(fakeLock);
    await waitForJobStatus(job.id, ['completed']);
    stopProcessor();

    expect(mockBuildSpectatorProjection).toHaveBeenCalledWith(
      match,
      { publicTeam1Name: 'Team A', publicTeam2Name: 'Team B' },
    );
    expect(mockWriteSpectatorProjection).toHaveBeenCalledWith('match-1', expect.objectContaining({
      publicTeam1Name: 'Team A',
      status: 'in-progress',
    }));
  }, 10_000);

  it('does NOT write projection for completed tournament match', async () => {
    const match = makeMatch({ status: 'completed', tournamentId: 'tourney-1' });
    mockGetById.mockResolvedValue(match);

    const job = createTestJob({
      context: { type: 'match', ownerId: 'u1', sharedWith: [], visibility: 'public' },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    startProcessor(fakeLock);
    await waitForJobStatus(job.id, ['completed']);
    stopProcessor();

    // buildSpectatorProjection should NOT have been called (match is completed, not in-progress)
    expect(mockBuildSpectatorProjection).not.toHaveBeenCalled();
  }, 10_000);

  it('does NOT write projection for non-tournament match', async () => {
    const match = makeMatch({ status: 'in-progress', tournamentId: undefined });
    mockGetById.mockResolvedValue(match);

    const job = createTestJob({
      context: { type: 'match', ownerId: 'u1', sharedWith: [], visibility: 'public' },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    startProcessor(fakeLock);
    await waitForJobStatus(job.id, ['completed']);
    stopProcessor();

    expect(mockBuildSpectatorProjection).not.toHaveBeenCalled();
  }, 10_000);

  it('does NOT write projection when visibility is not public', async () => {
    const match = makeMatch({ status: 'in-progress', tournamentId: 'tourney-1' });
    mockGetById.mockResolvedValue(match);

    const job = createTestJob({
      context: { type: 'match', ownerId: 'u1', sharedWith: [], visibility: 'private' },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    startProcessor(fakeLock);
    await waitForJobStatus(job.id, ['completed']);
    stopProcessor();

    // It should NOT have called buildSpectatorProjection (private visibility)
    // It WILL call writeSpectatorProjection for revocation though (tournament + non-public)
    expect(mockBuildSpectatorProjection).not.toHaveBeenCalled();
  }, 10_000);

  it('swallows projection errors without failing the sync job', async () => {
    const match = makeMatch({ status: 'in-progress', tournamentId: 'tourney-1' });
    mockGetById.mockResolvedValue(match);
    mockWriteSpectatorProjection.mockRejectedValueOnce(new Error('Firestore offline'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const job = createTestJob({
      context: { type: 'match', ownerId: 'u1', sharedWith: [], visibility: 'public' },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    startProcessor(fakeLock);
    await waitForJobStatus(job.id, ['completed']);
    stopProcessor();

    // Job completed despite projection failure
    const updated = await db.syncQueue.get(job.id);
    expect(updated!.status).toBe('completed');

    warnSpy.mockRestore();
  }, 10_000);
});
