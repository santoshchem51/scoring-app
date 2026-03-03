import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../db';
import type { CloudMatch, Match } from '../../types';

// Mock all Firebase modules
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(() => ({ exists: () => false })),
  getDocs: vi.fn(() => ({ docs: [] })),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => null),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

const mockAuth = { currentUser: null as { uid: string } | null };
vi.mock('../../firebase/config', () => ({
  auth: mockAuth,
  firestore: {},
}));

const mockMatchRepository = {
  save: vi.fn(),
  getAll: vi.fn(() => []),
  getById: vi.fn().mockResolvedValue(undefined),
};
vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: mockMatchRepository,
}));

const mockFirestoreMatchRepository = {
  save: vi.fn().mockResolvedValue(undefined),
  getByOwner: vi.fn(() => []),
  getBySharedWith: vi.fn(() => []),
};
vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: mockFirestoreMatchRepository,
}));

vi.mock('../../firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: { save: vi.fn(), getByOrganizer: vi.fn(() => []) },
}));

vi.mock('../../firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: { saveProfile: vi.fn() },
}));

vi.mock('../../firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: { processMatchCompletion: vi.fn() },
}));

describe('cloudSync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.syncQueue.clear();
    await db.matches.clear();
  });

  it('should export cloudSync object', async () => {
    const mod = await import('../cloudSync');
    expect(mod.cloudSync).toBeDefined();
  });

  it('should have syncMatchToCloud method', async () => {
    const mod = await import('../cloudSync');
    expect(typeof mod.cloudSync.syncMatchToCloud).toBe('function');
  });

  it('should have pullCloudMatchesToLocal method', async () => {
    const mod = await import('../cloudSync');
    expect(typeof mod.cloudSync.pullCloudMatchesToLocal).toBe('function');
  });

  it('should preserve scorerRole and scorerTeam during pull', async () => {
    mockAuth.currentUser = { uid: 'user-1' };

    const cloudMatch: CloudMatch = {
      id: 'match-1',
      config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: ['p1', 'p2'],
      team2PlayerIds: ['p3', 'p4'],
      team1Name: 'Team A',
      team2Name: 'Team B',
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: 1000,
      completedAt: null,
      scorerRole: 'spectator',
      scorerTeam: 2,
      ownerId: 'user-1',
      sharedWith: [],
      visibility: 'private',
      syncedAt: 2000,
    };

    mockFirestoreMatchRepository.getByOwner.mockResolvedValue([cloudMatch]);
    mockMatchRepository.getById.mockResolvedValue(undefined);

    const mod = await import('../cloudSync');
    const synced = await mod.cloudSync.pullCloudMatchesToLocal();

    expect(synced).toBe(1);
    expect(mockMatchRepository.save).toHaveBeenCalledOnce();
    const savedMatch = mockMatchRepository.save.mock.calls[0][0];
    expect(savedMatch.scorerRole).toBe('spectator');
    expect(savedMatch.scorerTeam).toBe(2);
  });

  describe('syncMatchToCloud with sharedWith', () => {
    const makeTestMatch = (): Match => ({
      id: 'match-sw-1',
      config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: ['buddy-1'],
      team2PlayerIds: ['buddy-2'],
      team1Name: 'Team A',
      team2Name: 'Team B',
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: 1000,
      completedAt: null,
    });

    beforeEach(() => {
      mockAuth.currentUser = { uid: 'test-user-uid' };
    });

    it('enqueues match with sharedWith when provided', async () => {
      const match = makeTestMatch();
      const mod = await import('../cloudSync');
      mod.cloudSync.syncMatchToCloud(match, ['buddy-1', 'buddy-2']);

      await vi.waitFor(async () => {
        const job = await db.syncQueue.get('match:match-sw-1');
        expect(job).toBeDefined();
        expect(job!.context).toEqual({
          type: 'match',
          ownerId: 'test-user-uid',
          sharedWith: ['buddy-1', 'buddy-2'],
        });
      });
    });

    it('defaults to empty sharedWith when not provided (backward compat)', async () => {
      const match = makeTestMatch();
      const mod = await import('../cloudSync');
      mod.cloudSync.syncMatchToCloud(match);

      await vi.waitFor(async () => {
        const job = await db.syncQueue.get('match:match-sw-1');
        expect(job).toBeDefined();
        expect((job!.context as { sharedWith: string[] }).sharedWith).toEqual([]);
      });
    });
  });

  describe('pullCloudMatchesToLocal with shared matches', () => {
    const makeCloudMatch = (overrides: Partial<CloudMatch> = {}): CloudMatch => ({
      id: 'match-pull-1',
      config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: [],
      team2PlayerIds: [],
      team1Name: 'Team A',
      team2Name: 'Team B',
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: 1000,
      completedAt: null,
      ownerId: 'user-1',
      sharedWith: [],
      visibility: 'private',
      syncedAt: 2000,
      ...overrides,
    });

    beforeEach(() => {
      mockAuth.currentUser = { uid: 'user-1' };
      mockMatchRepository.getById.mockResolvedValue(undefined);
    });

    it('pulls both owned and shared matches', async () => {
      const ownedMatch = makeCloudMatch({ id: 'owned-1', ownerId: 'user-1' });
      const sharedMatch = makeCloudMatch({ id: 'shared-1', ownerId: 'other-uid', sharedWith: ['user-1'] });

      mockFirestoreMatchRepository.getByOwner.mockResolvedValue([ownedMatch]);
      mockFirestoreMatchRepository.getBySharedWith.mockResolvedValue([sharedMatch]);

      const mod = await import('../cloudSync');
      const count = await mod.cloudSync.pullCloudMatchesToLocal();

      expect(count).toBe(2);
      expect(mockMatchRepository.save).toHaveBeenCalledTimes(2);
    });

    it('deduplicates matches that appear in both owned and shared', async () => {
      const match = makeCloudMatch({ id: 'dup-1', ownerId: 'user-1', sharedWith: ['user-1'] });

      mockFirestoreMatchRepository.getByOwner.mockResolvedValue([match]);
      mockFirestoreMatchRepository.getBySharedWith.mockResolvedValue([match]);

      const mod = await import('../cloudSync');
      const count = await mod.cloudSync.pullCloudMatchesToLocal();

      expect(count).toBe(1);
      expect(mockMatchRepository.save).toHaveBeenCalledTimes(1);
    });

    it('still works when getBySharedWith returns empty', async () => {
      const ownedMatch = makeCloudMatch({ id: 'owned-2' });
      mockFirestoreMatchRepository.getByOwner.mockResolvedValue([ownedMatch]);
      mockFirestoreMatchRepository.getBySharedWith.mockResolvedValue([]);

      const mod = await import('../cloudSync');
      const count = await mod.cloudSync.pullCloudMatchesToLocal();

      expect(count).toBe(1);
    });
  });
});
