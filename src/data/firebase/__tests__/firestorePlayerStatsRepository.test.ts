import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Match, StatsSummary, MatchRef } from '../../types';

const {
  mockDoc,
  mockGetDocs,
  mockCollection,
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
    mockGetDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    mockCollection: vi.fn(() => 'mock-collection-ref'),
    mockRunTransaction,
    mockTransactionGet,
    mockTransactionSet,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  runTransaction: mockRunTransaction,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
  auth: { currentUser: { uid: 'scorer-uid' } },
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
  };
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

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid',
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
        'user-1', match, 1, 'win', 'scorer-uid',
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

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid',
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

      const match = makeMatch({ winningSide: 2 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'loss', 'scorer-uid',
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

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid',
      );

      const statsCall = mockTransactionSet.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.recentResults).toHaveLength(50);
    });

    it('builds matchRef with correct fields', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch({
        id: 'match-42',
        team1Name: 'Alice',
        team2Name: 'Bob',
        startedAt: 1000,
        completedAt: 2000,
      });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid',
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

      const match = makeMatch({ winningSide: 2 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'loss', 'scorer-uid',
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

      const match = makeMatch({ winningSide: 2 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 2, 'win', 'scorer-uid',
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

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'participant-uid', match, 1, 'win', 'the-scorer-uid',
      );

      const refCall = mockTransactionSet.mock.calls[0];
      const ref = refCall[1] as MatchRef;
      expect(ref.ownerId).toBe('the-scorer-uid');
    });

    it('writes stats with merge: true', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid',
      );

      // Second transaction.set call is stats — should have merge: true
      const statsCall = mockTransactionSet.mock.calls[1];
      expect(statsCall[2]).toEqual({ merge: true });
    });

    it('tracks doubles stats separately', async () => {
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
      mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

      const match = makeMatch({
        config: {
          gameType: 'doubles',
          scoringMode: 'rally',
          matchFormat: 'best-of-3',
          pointsToWin: 11,
        },
      });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win', 'scorer-uid',
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
      // matchRef check (not exists) + stats check (not exists) for scorer
      mockTransactionGet
        .mockResolvedValueOnce({ exists: () => false })  // matchRef
        .mockResolvedValueOnce({ exists: () => false }); // stats

      const match = makeMatch();
      await firestorePlayerStatsRepository.processMatchCompletion(
        match, 'scorer-uid',
      );

      // Only scorer gets stats (casual match = no tournament)
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

      // Both participants run transactions concurrently (Promise.all).
      // Due to microtask interleaving, get calls alternate:
      //   uid-A matchRef, uid-B matchRef, uid-A stats, uid-B stats
      mockTransactionGet
        .mockResolvedValueOnce({ exists: () => false })  // uid-A matchRef
        .mockResolvedValueOnce({ exists: () => false })  // uid-B matchRef
        .mockResolvedValueOnce({ exists: () => false })  // uid-A stats
        .mockResolvedValueOnce({ exists: () => false }); // uid-B stats

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
  });
});
