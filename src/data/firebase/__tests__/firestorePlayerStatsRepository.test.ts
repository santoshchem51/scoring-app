import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Match, StatsSummary, MatchRef } from '../../types';

const {
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockSetDoc,
  mockCollection,
  mockQuery,
  mockOrderBy,
  mockLimit,
  mockStartAfter,
  mockRunTransaction,
  mockTransactionGet,
  mockTransactionSet,
} = vi.hoisted(() => {
  const mockTransactionGet = vi.fn();
  const mockTransactionSet = vi.fn();
  const mockRunTransaction = vi.fn((_firestore: unknown, callback: unknown) =>
    (callback as (txn: { get: typeof mockTransactionGet; set: typeof mockTransactionSet }) => Promise<void>)({
      get: mockTransactionGet,
      set: mockTransactionSet,
    }),
  );
  return {
    mockDoc: vi.fn(() => 'mock-doc-ref'),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    mockSetDoc: vi.fn(() => Promise.resolve()),
    mockCollection: vi.fn(() => 'mock-collection-ref'),
    mockQuery: vi.fn(() => 'mock-query'),
    mockOrderBy: vi.fn(() => 'mock-order-by'),
    mockLimit: vi.fn(() => 'mock-limit'),
    mockStartAfter: vi.fn(() => 'mock-start-after'),
    mockRunTransaction,
    mockTransactionGet,
    mockTransactionSet,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  collection: mockCollection,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  runTransaction: mockRunTransaction,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
  auth: { currentUser: { uid: 'scorer-uid' } },
}));

const mockGetProfile = vi.fn();

vi.mock('../firestoreUserRepository', () => ({
  firestoreUserRepository: {
    getProfile: mockGetProfile,
  },
}));

import { firestorePlayerStatsRepository } from '../firestorePlayerStatsRepository';

// --- Factories ---

function makeResults(
  count: number,
  overrides: Partial<import('../../types').RecentResult> = {},
): import('../../types').RecentResult[] {
  return Array.from({ length: count }, (_, i) => ({
    result: 'win' as const,
    opponentTier: 'intermediate' as const,
    completedAt: Date.now() - i * 60000,
    gameType: 'singles' as const,
    ...overrides,
  }));
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    config: {
      gameType: 'singles',
      scoringMode: 'sideout',
      matchFormat: 'best-of-3',
      pointsToWin: 11,
    },
    team1PlayerIds: ['p1'],
    team2PlayerIds: ['p2'],
    team1Name: 'Alice',
    team2Name: 'Bob',
    games: [
      { gameNumber: 1, team1Score: 11, team2Score: 7, winningSide: 1 },
      { gameNumber: 2, team1Score: 11, team2Score: 4, winningSide: 1 },
    ],
    winningSide: 1,
    status: 'completed',
    startedAt: 1000000,
    completedAt: 2000000,
    ...overrides,
  };
}

function makeEmptyStats(): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: { type: 'W', count: 0 },
    bestWinStreak: 0,
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: [],
    tier: 'beginner',
    tierConfidence: 'low',
    tierUpdatedAt: 0,
    lastPlayedAt: 0,
    updatedAt: 0,
    uniqueOpponentUids: [],
  };
}

function makeTournamentMatch(overrides: Partial<Match> = {}): Match {
  return makeMatch({
    tournamentId: 'tourney-1',
    tournamentTeam1Id: 'team-1',
    tournamentTeam2Id: 'team-2',
    ...overrides,
  });
}

function makeCasualMatch(overrides: Partial<Match> = {}): Match {
  return makeMatch({
    id: 'casual-match-1',
    team1PlayerIds: [],
    team2PlayerIds: [],
    ...overrides,
  });
}

/** Sets up mockGetDocs to return registrations for resolveParticipantUids */
function mockRegistrations(regs: Array<{ userId: string; teamId: string }>) {
  mockGetDocs.mockResolvedValueOnce({
    docs: regs.map((r, i) => ({ id: `reg-${i}`, data: () => r })),
  });
}

/** Sets up mockGetDoc for fetchPublicTiers + tournament config lookup */
function mockTierLookups(
  tiersByUid: Record<string, import('../../types').Tier>,
  uids: string[],
  tournamentConfig?: { defaultTier?: import('../../types').Tier },
) {
  // fetchPublicTiers: one getDoc per uid
  for (const uid of uids) {
    const tier = tiersByUid[uid];
    if (tier) {
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ tier }) });
    } else {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    }
  }
  // Tournament config lookup
  if (tournamentConfig !== undefined) {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ config: tournamentConfig }),
    });
  }
}

/** Sets up transaction.get mocks for N participants (matchRef not-exists + stats not-exists + leaderboard not-exists) */
function mockTransactionForParticipants(count: number, existingStats?: StatsSummary) {
  for (let i = 0; i < count; i++) {
    mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // matchRef
  }
  for (let i = 0; i < count; i++) {
    if (existingStats) {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...existingStats }) });
    } else {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // stats
    }
  }
  for (let i = 0; i < count; i++) {
    mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // leaderboard
  }
}

describe('firestorePlayerStatsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updatePlayerStats', () => {
    it('creates matchRef and new stats summary for first match', async () => {
      // No existing matchRef
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      // No existing stats
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      // No existing leaderboard doc
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      // Should write matchRef doc
      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'matchRefs', 'match-1',
      );

      // Should write stats/summary doc
      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'stats', 'summary',
      );

      // transaction.set called twice: matchRef + stats
      expect(mockTransactionSet).toHaveBeenCalledTimes(2);

      // Verify stats summary shape
      const statsCall = mockTransactionSet.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.totalMatches).toBe(1);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(0);
      expect(stats.winRate).toBeCloseTo(1.0);
      expect(stats.tier).toBe('beginner'); // damped with 1 match
      expect(stats.recentResults).toHaveLength(1);
    });

    it('skips if matchRef already exists (idempotency)', async () => {
      // matchRef already exists
      mockTransactionGet.mockResolvedValueOnce({ exists: () => true });

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      // Should NOT write anything
      expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it('updates existing stats summary incrementally', async () => {
      // No existing matchRef
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      // Existing stats with 5 matches
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 5;
      existingStats.wins = 3;
      existingStats.losses = 2;
      existingStats.winRate = 0.6;
      existingStats.currentStreak = { type: 'W', count: 2 };
      existingStats.bestWinStreak = 3;
      existingStats.singles = { matches: 5, wins: 3, losses: 2 };
      existingStats.recentResults = makeResults(5);
      mockTransactionGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      // Leaderboard doc (totalMatches will be 6 >= 5, so leaderboard write triggers)
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      const statsCall = mockTransactionSet.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.totalMatches).toBe(6);
      expect(stats.wins).toBe(4);
      expect(stats.losses).toBe(2);
      expect(stats.currentStreak).toEqual({ type: 'W', count: 3 });
      expect(stats.recentResults).toHaveLength(6);
    });

    it('resets win streak on a loss', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 3;
      existingStats.wins = 3;
      existingStats.losses = 0;
      existingStats.currentStreak = { type: 'W', count: 3 };
      existingStats.bestWinStreak = 3;
      mockTransactionGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      // Leaderboard doc (totalMatches will be 4 < 5, no leaderboard write)
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch({ winningSide: 2 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'loss', 'scorer-uid', 'Test User', null,
      );

      const statsCall = mockTransactionSet.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.currentStreak).toEqual({ type: 'L', count: 1 });
      expect(stats.bestWinStreak).toBe(3); // preserved
    });

    it('caps recentResults ring buffer at 50', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 50;
      existingStats.recentResults = makeResults(50);
      mockTransactionGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      // Leaderboard doc (totalMatches will be 51 >= 5, so leaderboard write triggers)
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      const statsCall = mockTransactionSet.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.recentResults).toHaveLength(50);
    });

    it('builds matchRef with correct fields', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // leaderboard

      const match = makeMatch({
        id: 'match-42',
        team1Name: 'Alice',
        team2Name: 'Bob',
        startedAt: 1000,
        completedAt: 2000,
      });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      const refCall = mockTransactionSet.mock.calls[0];
      const ref = refCall[1] as MatchRef;
      expect(ref.matchId).toBe('match-42');
      expect(ref.startedAt).toBe(1000);
      expect(ref.completedAt).toBe(2000);
      expect(ref.gameType).toBe('singles');
      expect(ref.result).toBe('win');
      expect(ref.playerTeam).toBe(1);
      expect(ref.scores).toBe('11-7, 11-4');
      expect(ref.gameScores).toEqual([[11, 7], [11, 4]]);
    });

    it('tracks a loss as first match correctly', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // leaderboard

      const match = makeMatch({ winningSide: 2 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'loss', 'scorer-uid', 'Test User', null,
      );

      const statsCall = mockTransactionSet.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.totalMatches).toBe(1);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(1);
      expect(stats.winRate).toBeCloseTo(0);
      expect(stats.currentStreak).toEqual({ type: 'L', count: 1 });
    });

    it('records correct perspective for team-2 player', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // leaderboard

      const match = makeMatch({ winningSide: 2 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 2, 'win', 'scorer-uid', 'Test User', null,
      );

      const refCall = mockTransactionSet.mock.calls[0];
      const ref = refCall[1] as MatchRef;
      expect(ref.playerTeam).toBe(2);
      expect(ref.result).toBe('win');
      expect(ref.opponentNames).toEqual(['Alice']); // team1Name is opponent

      const statsCall = mockTransactionSet.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.wins).toBe(1);
    });

    it('sets matchRef ownerId to scorerUid, not participant uid', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // leaderboard

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'participant-uid', match, 1, 'win', 'the-scorer-uid', 'Test User', null,
      );

      const refCall = mockTransactionSet.mock.calls[0];
      const ref = refCall[1] as MatchRef;
      expect(ref.ownerId).toBe('the-scorer-uid');
    });

    it('writes stats with merge: true', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // leaderboard

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      // Second transaction.set call is stats — should have merge: true
      const statsCall = mockTransactionSet.mock.calls[1];
      expect(statsCall[2]).toEqual({ merge: true });
    });

    it('tracks doubles stats separately', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // leaderboard

      const match = makeMatch({
        config: {
          gameType: 'doubles',
          scoringMode: 'rally',
          matchFormat: 'best-of-3',
          pointsToWin: 11,
        },
      });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      const statsCall = mockTransactionSet.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.doubles.matches).toBe(1);
      expect(stats.doubles.wins).toBe(1);
      expect(stats.singles.matches).toBe(0);
    });
  });

  describe('processMatchCompletion', () => {
    it('writes stats for scorer only on casual match', async () => {
      // matchRef check (not exists) + stats check (not exists) + leaderboard (not exists) for scorer
      mockTransactionGet
        .mockResolvedValueOnce({ exists: () => false })  // matchRef
        .mockResolvedValueOnce({ exists: () => false })  // stats
        .mockResolvedValueOnce({ exists: () => false }); // leaderboard

      const match = makeCasualMatch();
      await firestorePlayerStatsRepository.processMatchCompletion(
        match, 'scorer-uid',
      );

      // Only scorer gets stats (casual match = no tournament, empty playerIds)
      // 2 transaction.set calls: matchRef + stats for scorer
      expect(mockTransactionSet).toHaveBeenCalledTimes(2);
    });

    it('writes stats for all tournament participants', async () => {
      // Mock registration lookup: 2 registrations mapping to teams
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'reg-1', data: () => ({ userId: 'uid-A', teamId: 'team-A' }) },
          { id: 'reg-2', data: () => ({ userId: 'uid-B', teamId: 'team-B' }) },
        ],
      });

      // fetchPublicTiers: one getDoc per participant UID (no public tier docs exist yet)
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => false })  // uid-A public tier
        .mockResolvedValueOnce({ exists: () => false })  // uid-B public tier
        // Tournament config lookup
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ config: { defaultTier: 'beginner' } }) });

      // Both participants run transactions concurrently (Promise.all).
      // Due to microtask interleaving, get calls alternate:
      //   uid-A matchRef, uid-B matchRef, uid-A stats, uid-B stats, uid-A leaderboard, uid-B leaderboard
      mockTransactionGet
        .mockResolvedValueOnce({ exists: () => false })  // uid-A matchRef
        .mockResolvedValueOnce({ exists: () => false })  // uid-B matchRef
        .mockResolvedValueOnce({ exists: () => false })  // uid-A stats
        .mockResolvedValueOnce({ exists: () => false })  // uid-B stats
        .mockResolvedValueOnce({ exists: () => false })  // uid-A leaderboard
        .mockResolvedValueOnce({ exists: () => false }); // uid-B leaderboard

      const match = makeMatch({
        tournamentId: 'tourn-1',
        tournamentTeam1Id: 'team-A',
        tournamentTeam2Id: 'team-B',
      });

      await firestorePlayerStatsRepository.processMatchCompletion(
        match, 'scorer-uid',
      );

      // 2 participants x 2 writes each (matchRef + stats) = 4 transaction.set calls
      expect(mockTransactionSet).toHaveBeenCalledTimes(4);
      // writePublicTier called once per participant = 2 setDoc calls
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
    });

    it('swallows errors for individual players without blocking others', async () => {
      // Transaction fails because transaction.get rejects
      mockTransactionGet.mockRejectedValueOnce(new Error('Firestore error'));

      const match = makeMatch();
      // Should not throw
      await expect(
        firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid'),
      ).resolves.not.toThrow();
    });

    it('does not give scorer phantom stats when tournament registration lookup fails', async () => {
      // Registration lookup throws
      mockGetDocs.mockRejectedValueOnce(new Error('Permission denied'));

      const match = makeMatch({
        tournamentId: 'tourn-1',
        tournamentTeam1Id: 'team-A',
        tournamentTeam2Id: 'team-B',
      });

      await firestorePlayerStatsRepository.processMatchCompletion(
        match, 'scorer-uid',
      );

      // No stats should be written — registration failed, so no participants resolved
      expect(mockTransactionSet).not.toHaveBeenCalled();
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });

  describe('getStatsSummary', () => {
    it('returns stats summary when document exists', async () => {
      const stats = makeEmptyStats();
      stats.totalMatches = 10;
      stats.wins = 7;
      stats.winRate = 0.7;
      stats.tier = 'intermediate';
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => stats,
      });

      const result = await firestorePlayerStatsRepository.getStatsSummary('user-1');

      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'stats', 'summary',
      );
      expect(result).not.toBeNull();
      expect(result!.totalMatches).toBe(10);
      expect(result!.tier).toBe('intermediate');
    });

    it('returns null when no stats document exists', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await firestorePlayerStatsRepository.getStatsSummary('user-1');

      expect(result).toBeNull();
    });
  });

  describe('getRecentMatchRefs', () => {
    it('returns match refs ordered by completedAt desc', async () => {
      const matchRef1 = { matchId: 'm1', completedAt: 2000, result: 'win', gameType: 'singles' };
      const matchRef2 = { matchId: 'm2', completedAt: 1000, result: 'loss', gameType: 'doubles' };
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => matchRef1 },
          { data: () => matchRef2 },
        ],
      });

      const results = await firestorePlayerStatsRepository.getRecentMatchRefs('user-1', 10);

      expect(mockCollection).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'matchRefs',
      );
      expect(mockOrderBy).toHaveBeenCalledWith('completedAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(results).toHaveLength(2);
      expect(results[0].matchId).toBe('m1');
    });

    it('returns empty array when no match refs exist', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const results = await firestorePlayerStatsRepository.getRecentMatchRefs('user-1');

      expect(results).toEqual([]);
    });

    it('uses startAfter cursor when provided', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await firestorePlayerStatsRepository.getRecentMatchRefs('user-1', 10, 5000);

      expect(mockStartAfter).toHaveBeenCalledWith(5000);
    });

    it('defaults to limit of 10', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await firestorePlayerStatsRepository.getRecentMatchRefs('user-1');

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  // ============================================================
  // Tournament enrichment tests (Task 5)
  // ============================================================

  describe('resolveOpponentTier (via processMatchCompletion)', () => {
    it('singles match: uses opponent real tier directly', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      // resolveParticipantUids: 2 registrations (singles, one per team)
      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      // fetchPublicTiers: uid-B is 'advanced', uid-A is 'intermediate'
      mockTierLookups(
        { 'uid-A': 'intermediate', 'uid-B': 'advanced' },
        ['uid-A', 'uid-B'],
        { defaultTier: 'beginner' },
      );

      // Both participants get transaction calls
      mockTransactionForParticipants(2);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // uid-A (team 1, won): opponent is uid-B with tier 'advanced'
      // Promise.all transaction SET order: [0] uid-A matchRef, [1] uid-A stats,
      //   [2] uid-B matchRef, [3] uid-B stats
      const uidAStats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(uidAStats.recentResults[0].opponentTier).toBe('advanced');

      // uid-B (team 2, lost): opponent is uid-A with tier 'intermediate'
      const uidBStats = mockTransactionSet.mock.calls[3][1] as StatsSummary;
      expect(uidBStats.recentResults[0].opponentTier).toBe('intermediate');
    });

    it('doubles match: averages opponents tier multipliers via nearestTier', async () => {
      const match = makeTournamentMatch({
        winningSide: 1,
        config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
      });

      // 4 registrations: 2 per team
      mockRegistrations([
        { userId: 'uid-A1', teamId: 'team-1' },
        { userId: 'uid-A2', teamId: 'team-1' },
        { userId: 'uid-B1', teamId: 'team-2' },
        { userId: 'uid-B2', teamId: 'team-2' },
      ]);

      // uid-B1 = 'intermediate' (0.8), uid-B2 = 'advanced' (1.0)
      // avg = (0.8 + 1.0) / 2 = 0.9 → nearestTier(0.9) = 'advanced' (dist 0.1 vs 0.1 for intermediate, tiebreak: closer to 1.0)
      mockTierLookups(
        { 'uid-A1': 'beginner', 'uid-A2': 'beginner', 'uid-B1': 'intermediate', 'uid-B2': 'advanced' },
        ['uid-A1', 'uid-A2', 'uid-B1', 'uid-B2'],
        { defaultTier: 'beginner' },
      );

      mockTransactionForParticipants(4);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // uid-A1 (team 1): opponents are uid-B1 (intermediate=0.8) + uid-B2 (advanced=1.0)
      // avg multiplier = 0.9, nearestTier(0.9) → 'advanced' (0.9 is equidistant from 0.8 and 1.0, tiebreak → closer to 1.0 = advanced)
      // SET order: [0] A1 ref, [1] A1 stats, [2] A2 ref, [3] A2 stats, [4] B1 ref, [5] B1 stats, ...
      const uidA1Stats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(uidA1Stats.recentResults[0].opponentTier).toBe('advanced');
    });

    it('missing opponent tier: falls back to tournament defaultTier', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      // uid-B has no public tier doc; tournament defaultTier = 'intermediate'
      mockTierLookups(
        { 'uid-A': 'beginner' },
        ['uid-A', 'uid-B'],
        { defaultTier: 'intermediate' },
      );

      mockTransactionForParticipants(2);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // uid-A's opponent is uid-B whose tier is missing → fallback to 'intermediate'
      const uidAStats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(uidAStats.recentResults[0].opponentTier).toBe('intermediate');
    });

    it('all opponents missing, no defaultTier: falls back to beginner', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      // No public tier docs for anyone; tournament config has no defaultTier
      mockTierLookups({}, ['uid-A', 'uid-B'], {});

      mockTransactionForParticipants(2);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // Fallback: defaultTier resolves to 'beginner' when config has no defaultTier
      const uidAStats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(uidAStats.recentResults[0].opponentTier).toBe('beginner');
    });
  });

  describe('fetchPublicTiers (via processMatchCompletion)', () => {
    it('fetches public/tier doc for each participant', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      mockTierLookups(
        { 'uid-A': 'advanced' },
        ['uid-A', 'uid-B'],
        { defaultTier: 'beginner' },
      );

      mockTransactionForParticipants(2);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // getDoc called: 2x for fetchPublicTiers + 1x for tournament config = 3 total
      expect(mockGetDoc).toHaveBeenCalledTimes(3);

      // Verify it asked for the right doc paths
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'users', 'uid-A', 'public', 'tier');
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'users', 'uid-B', 'public', 'tier');
    });

    it('gracefully handles a rejected fetch via Promise.allSettled', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      // uid-A fetch succeeds, uid-B fetch rejects
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'advanced' }) }) // uid-A
        .mockRejectedValueOnce(new Error('Network error'))                                   // uid-B
        // Tournament config lookup
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ config: { defaultTier: 'intermediate' } }) });

      mockTransactionForParticipants(2);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // uid-A won: opponent is uid-B whose tier fetch failed → falls back to 'intermediate' (tournament default)
      const uidAStats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(uidAStats.recentResults[0].opponentTier).toBe('intermediate');

      // uid-B lost: opponent is uid-A whose tier fetch succeeded → 'advanced'
      const uidBStats = mockTransactionSet.mock.calls[3][1] as StatsSummary;
      expect(uidBStats.recentResults[0].opponentTier).toBe('advanced');
    });

    it('handles non-existent docs gracefully (returns empty for those)', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      // Both public tier docs don't exist
      mockTierLookups({}, ['uid-A', 'uid-B'], { defaultTier: 'intermediate' });

      mockTransactionForParticipants(2);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // Both players' opponent tier should fall back to 'intermediate' (tournament default)
      // SET order: [0] uid-A ref, [1] uid-A stats, [2] uid-B ref, [3] uid-B stats
      const uidAStats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(uidAStats.recentResults[0].opponentTier).toBe('intermediate');
      const uidBStats = mockTransactionSet.mock.calls[3][1] as StatsSummary;
      expect(uidBStats.recentResults[0].opponentTier).toBe('intermediate');
    });
  });

  describe('duplicate UID guard in resolveParticipantUids', () => {
    it('deduplicates when same UID appears on both teams', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      // Same UID on both teams (data corruption)
      mockRegistrations([
        { userId: 'uid-dupe', teamId: 'team-1' },
        { userId: 'uid-dupe', teamId: 'team-2' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      // fetchPublicTiers: 2 unique UIDs (uid-dupe, uid-B)
      mockTierLookups(
        {},
        ['uid-dupe', 'uid-B'],
        { defaultTier: 'beginner' },
      );

      // Only 2 participants after dedup
      mockTransactionForParticipants(2);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // Only 2 participants should get stats (uid-dupe kept on team-1, second occurrence skipped)
      // 2 participants x 2 writes = 4 transaction.set calls
      expect(mockTransactionSet).toHaveBeenCalledTimes(4);
    });
  });

  describe('enriched matchRef fields', () => {
    it('tournament match: opponentIds populated from opposing team UIDs', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      mockTierLookups({}, ['uid-A', 'uid-B'], { defaultTier: 'beginner' });
      mockTransactionForParticipants(2);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // uid-A matchRef (first transaction.set call): opponent is uid-B
      const uidARef = mockTransactionSet.mock.calls[0][1] as MatchRef;
      expect(uidARef.opponentIds).toEqual(['uid-B']);

      // uid-B matchRef: SET order [0] A ref, [1] A stats, [2] B ref, [3] B stats
      const uidBRef = mockTransactionSet.mock.calls[2][1] as MatchRef;
      expect(uidBRef.opponentIds).toEqual(['uid-A']);
    });

    it('tournament doubles match: partnerId populated from same team', async () => {
      const match = makeTournamentMatch({
        winningSide: 1,
        config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
      });

      mockRegistrations([
        { userId: 'uid-A1', teamId: 'team-1' },
        { userId: 'uid-A2', teamId: 'team-1' },
        { userId: 'uid-B1', teamId: 'team-2' },
        { userId: 'uid-B2', teamId: 'team-2' },
      ]);

      mockTierLookups({}, ['uid-A1', 'uid-A2', 'uid-B1', 'uid-B2'], { defaultTier: 'beginner' });
      mockTransactionForParticipants(4);

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // uid-A1's matchRef: partner = uid-A2, opponents = [uid-B1, uid-B2]
      const uidA1Ref = mockTransactionSet.mock.calls[0][1] as MatchRef;
      expect(uidA1Ref.partnerId).toBe('uid-A2');
      expect(uidA1Ref.opponentIds).toEqual(['uid-B1', 'uid-B2']);

      // uid-A2's matchRef at [2]: partner = uid-A1
      const uidA2Ref = mockTransactionSet.mock.calls[2][1] as MatchRef;
      expect(uidA2Ref.partnerId).toBe('uid-A1');
      expect(uidA2Ref.opponentIds).toEqual(['uid-B1', 'uid-B2']);

      // uid-B1's matchRef at [4]: partner = uid-B2, opponents = [uid-A1, uid-A2]
      const uidB1Ref = mockTransactionSet.mock.calls[4][1] as MatchRef;
      expect(uidB1Ref.partnerId).toBe('uid-B2');
      expect(uidB1Ref.opponentIds).toEqual(['uid-A1', 'uid-A2']);
    });

    it('casual match: opponentIds stays [], partnerId stays null', async () => {
      const match = makeCasualMatch();

      // Casual: no getDocs call for registrations
      mockTransactionGet
        .mockResolvedValueOnce({ exists: () => false })  // matchRef
        .mockResolvedValueOnce({ exists: () => false })  // stats
        .mockResolvedValueOnce({ exists: () => false }); // leaderboard

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      const ref = mockTransactionSet.mock.calls[0][1] as MatchRef;
      expect(ref.opponentIds).toEqual([]);
      expect(ref.partnerId).toBeNull();
    });
  });

  describe('uniqueOpponentUids tracking', () => {
    it('new opponent UIDs merged into existing set', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      mockTierLookups({}, ['uid-A', 'uid-B'], { defaultTier: 'beginner' });

      // uid-A already has stats with some unique opponents
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 3;
      existingStats.wins = 2;
      existingStats.losses = 1;
      existingStats.uniqueOpponentUids = ['uid-old-1', 'uid-old-2'];

      // uid-A matchRef (not exists), uid-B matchRef (not exists)
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-A matchRef
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-B matchRef
      // uid-A stats (exists with prior opponents), uid-B stats (not exists)
      mockTransactionGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...existingStats }) });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-B stats
      // leaderboard docs
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-A leaderboard
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-B leaderboard

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // uid-A's stats at [1]: SET order [0] A ref, [1] A stats, [2] B ref, [3] B stats
      const uidAStats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(uidAStats.uniqueOpponentUids).toContain('uid-old-1');
      expect(uidAStats.uniqueOpponentUids).toContain('uid-old-2');
      expect(uidAStats.uniqueOpponentUids).toContain('uid-B');
      expect(uidAStats.uniqueOpponentUids).toHaveLength(3);
    });

    it('duplicate opponents not added twice', async () => {
      const match = makeTournamentMatch({ winningSide: 1 });

      mockRegistrations([
        { userId: 'uid-A', teamId: 'team-1' },
        { userId: 'uid-B', teamId: 'team-2' },
      ]);

      mockTierLookups({}, ['uid-A', 'uid-B'], { defaultTier: 'beginner' });

      // uid-A already has uid-B in unique opponents
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 5;
      existingStats.wins = 3;
      existingStats.losses = 2;
      existingStats.uniqueOpponentUids = ['uid-B', 'uid-C'];

      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-A matchRef
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-B matchRef
      mockTransactionGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...existingStats }) });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-B stats
      // leaderboard docs
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-A leaderboard
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false }); // uid-B leaderboard

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      // uid-A's uniqueOpponentUids should still have exactly uid-B and uid-C (no duplicate uid-B)
      const uidAStats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(uidAStats.uniqueOpponentUids).toEqual(expect.arrayContaining(['uid-B', 'uid-C']));
      expect(uidAStats.uniqueOpponentUids).toHaveLength(2);
    });

    it('casual matches do not update uniqueOpponentUids', async () => {
      const match = makeCasualMatch();

      mockTransactionGet
        .mockResolvedValueOnce({ exists: () => false })  // matchRef
        .mockResolvedValueOnce({ exists: () => false })  // stats
        .mockResolvedValueOnce({ exists: () => false }); // leaderboard

      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

      const stats = mockTransactionSet.mock.calls[1][1] as StatsSummary;
      expect(stats.uniqueOpponentUids).toEqual([]);
    });
  });

  describe('tierUpdated flag (idempotency)', () => {
    it('when match already processed, writePublicTier is NOT called', async () => {
      // matchRef already exists → transaction returns early
      mockTransactionGet.mockResolvedValueOnce({ exists: () => true });

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      // setDoc (used by writePublicTier) should NOT be called
      expect(mockSetDoc).not.toHaveBeenCalled();
      // transaction.set should NOT be called (no writes)
      expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it('writePublicTier IS called when match is newly processed', async () => {
      mockTransactionGet
        .mockResolvedValueOnce({ exists: () => false })  // matchRef
        .mockResolvedValueOnce({ exists: () => false })  // stats
        .mockResolvedValueOnce({ exists: () => false }); // leaderboard

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Test User', null,
      );

      // writePublicTier writes via setDoc
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'users', 'user-1', 'public', 'tier');
    });
  });

  describe('winningSide null guard', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTransactionGet.mockResolvedValue({ exists: () => false });
    });

    it('returns no participants when winningSide is null (abandoned match)', async () => {
      const match = makeCasualMatch({ winningSide: null, status: 'abandoned' });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');
      expect(mockTransactionSet).not.toHaveBeenCalled();
    });
  });

  describe('casual path with scorerRole/scorerTeam', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTransactionGet.mockResolvedValue({ exists: () => false });
      mockGetDoc.mockResolvedValue({ exists: () => false });
    });

    it('spectator scorer gets no stats', async () => {
      const match = makeCasualMatch({ scorerRole: 'spectator' });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');
      expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it('scorer on team 2 gets correct result when team 2 wins', async () => {
      const match = makeCasualMatch({ scorerRole: 'player', scorerTeam: 2, winningSide: 2 });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');
      expect(mockTransactionSet).toHaveBeenCalled();
      const matchRefArg = mockTransactionSet.mock.calls[0][1];
      expect(matchRefArg.playerTeam).toBe(2);
      expect(matchRefArg.result).toBe('win');
    });

    it('scorer on team 2 gets loss when team 1 wins', async () => {
      const match = makeCasualMatch({ scorerRole: 'player', scorerTeam: 2, winningSide: 1 });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');
      expect(mockTransactionSet).toHaveBeenCalled();
      const matchRefArg = mockTransactionSet.mock.calls[0][1];
      expect(matchRefArg.playerTeam).toBe(2);
      expect(matchRefArg.result).toBe('loss');
    });

    it('undefined scorerRole defaults to player (backward compat)', async () => {
      const match = makeCasualMatch(); // no scorerRole, no scorerTeam
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');
      expect(mockTransactionSet).toHaveBeenCalled();
      const matchRefArg = mockTransactionSet.mock.calls[0][1];
      expect(matchRefArg.playerTeam).toBe(1);
      expect(matchRefArg.result).toBe('win');
    });

    it('respects team1PlayerIds/team2PlayerIds when populated (Phase 2+ ready)', async () => {
      const match = makeCasualMatch({
        team1PlayerIds: ['uid-A'],
        team2PlayerIds: ['uid-B'],
        winningSide: 1,
      });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');
      expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('capacity guard', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTransactionGet.mockResolvedValue({ exists: () => false });
      mockGetDoc.mockResolvedValue({ exists: () => false });
    });

    it('rejects team with more than 2 players in doubles', async () => {
      const match = makeCasualMatch({
        config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: ['uid-A', 'uid-B', 'uid-C'],
        team2PlayerIds: ['uid-D'],
        winningSide: 1,
      });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'uid-A');
      expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it('rejects team with more than 1 player in singles', async () => {
      const match = makeCasualMatch({
        config: { gameType: 'singles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: ['uid-A', 'uid-B'],
        team2PlayerIds: ['uid-C'],
        winningSide: 1,
      });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'uid-A');
      expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it('allows exactly 2 players per team in doubles', async () => {
      const match = makeCasualMatch({
        config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: ['uid-A', 'uid-B'],
        team2PlayerIds: ['uid-C', 'uid-D'],
        winningSide: 1,
      });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'uid-A');
      // 4 participants x 2 writes each (matchRef + stats) = 8
      expect(mockTransactionSet).toHaveBeenCalledTimes(8);
    });

    it('scorer in team array does not double-count with fallback', async () => {
      const match = makeCasualMatch({
        team1PlayerIds: ['scorer-uid'],
        team2PlayerIds: [],
        winningSide: 1,
        scorerRole: 'player',
        scorerTeam: 1,
      });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');
      // 1 participant x 2 writes (matchRef + stats) = 2
      expect(mockTransactionSet).toHaveBeenCalledTimes(2);
    });

    it('partial linking: 1 UID on team 1, empty team 2, correct stats', async () => {
      const match = makeCasualMatch({
        team1PlayerIds: ['uid-A'],
        team2PlayerIds: [],
        winningSide: 1,
        scorerRole: 'player',
        scorerTeam: 1,
      });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'uid-A');
      // 1 participant x 2 writes (matchRef + stats) = 2
      expect(mockTransactionSet).toHaveBeenCalledTimes(2);
      // Stats is the second transaction.set call (index 1)
      const statsArg = mockTransactionSet.mock.calls[1][1];
      expect(statsArg.wins).toBe(1);
    });
  });

  describe('dedup guard (shared)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTransactionGet.mockResolvedValue({ exists: () => false });
      mockGetDoc.mockResolvedValue({ exists: () => false });
    });

    it('deduplicates UIDs in casual team arrays', async () => {
      const match = makeCasualMatch({
        team1PlayerIds: ['uid-A'],
        team2PlayerIds: ['uid-A'],
        winningSide: 1,
      });
      await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('leaderboard write in updatePlayerStats', () => {
    it('writes leaderboard entry when totalMatches reaches 5', async () => {
      // Match ref: not exists (new match)
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      // Stats doc: exists with 4 matches (this will be the 5th)
      mockTransactionGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          schemaVersion: 1,
          totalMatches: 4, wins: 3, losses: 1, winRate: 0.75,
          currentStreak: { type: 'W', count: 2 }, bestWinStreak: 3,
          singles: { matches: 4, wins: 3, losses: 1 },
          doubles: { matches: 0, wins: 0, losses: 0 },
          recentResults: [], tier: 'intermediate', tierConfidence: 'medium',
          tierUpdatedAt: Date.now(), lastPlayedAt: Date.now(), updatedAt: Date.now(),
          uniqueOpponentUids: ['opp-1', 'opp-2', 'opp-3'],
        }),
      });
      // Leaderboard doc: not exists yet
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch({ winningSide: 1 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Alice Test', 'https://photo.example.com/alice.jpg',
      );

      // Should have a transaction.set call with compositeScore field (leaderboard write)
      const setCalls = mockTransactionSet.mock.calls;
      const leaderboardCall = setCalls.find(
        (call) => {
          const data = call[1] as Record<string, unknown>;
          return data && typeof data === 'object' && 'compositeScore' in data;
        },
      );
      expect(leaderboardCall).toBeDefined();
      expect((leaderboardCall![1] as Record<string, unknown>).displayName).toBe('Alice Test');
    });

    it('does not write leaderboard entry when totalMatches < 5', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          schemaVersion: 1, totalMatches: 2, wins: 1, losses: 1, winRate: 0.5,
          currentStreak: { type: 'L', count: 1 }, bestWinStreak: 1,
          singles: { matches: 2, wins: 1, losses: 1 },
          doubles: { matches: 0, wins: 0, losses: 0 },
          recentResults: [], tier: 'beginner', tierConfidence: 'low',
          tierUpdatedAt: Date.now(), lastPlayedAt: Date.now(), updatedAt: Date.now(),
          uniqueOpponentUids: ['opp-1'],
        }),
      });
      // Leaderboard doc (totalMatches will be 3 < 5, no leaderboard write)
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch({ winningSide: 1 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Bob', null,
      );

      // No transaction.set call should have compositeScore
      const setCalls = mockTransactionSet.mock.calls;
      const leaderboardCall = setCalls.find(
        (call) => {
          const data = call[1] as Record<string, unknown>;
          return data && typeof data === 'object' && 'compositeScore' in data;
        },
      );
      expect(leaderboardCall).toBeUndefined();
    });

    it('preserves createdAt from existing leaderboard entry', async () => {
      const existingCreatedAt = Date.now() - 100000;

      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          schemaVersion: 1, totalMatches: 10, wins: 7, losses: 3, winRate: 0.7,
          currentStreak: { type: 'W', count: 3 }, bestWinStreak: 3,
          singles: { matches: 10, wins: 7, losses: 3 },
          doubles: { matches: 0, wins: 0, losses: 0 },
          recentResults: [], tier: 'advanced', tierConfidence: 'high',
          tierUpdatedAt: Date.now(), lastPlayedAt: Date.now(), updatedAt: Date.now(),
          uniqueOpponentUids: ['opp-1', 'opp-2', 'opp-3', 'opp-4', 'opp-5', 'opp-6'],
        }),
      });
      // Existing leaderboard doc
      mockTransactionGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ createdAt: existingCreatedAt }),
      });

      const match = makeMatch({ winningSide: 1 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid', 'Charlie', null,
      );

      const setCalls = mockTransactionSet.mock.calls;
      const leaderboardCall = setCalls.find(
        (call) => {
          const data = call[1] as Record<string, unknown>;
          return data && typeof data === 'object' && 'compositeScore' in data;
        },
      );
      expect(leaderboardCall).toBeDefined();
      expect((leaderboardCall![1] as Record<string, unknown>).createdAt).toBe(existingCreatedAt);
    });
  });
});
