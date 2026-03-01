import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Match, StatsSummary, MatchRef } from '../../types';

const {
  mockDoc,
  mockSetDoc,
  mockGetDoc,
  mockCollection,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockSetDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  collection: mockCollection,
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
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      // No existing stats
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      // Should write matchRef doc
      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'matchRefs', 'match-1',
      );

      // Should write stats/summary doc
      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'stats', 'summary',
      );

      // setDoc called twice: matchRef + stats
      expect(mockSetDoc).toHaveBeenCalledTimes(2);

      // Verify stats summary shape
      const statsCall = mockSetDoc.mock.calls[1];
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
      mockGetDoc.mockResolvedValueOnce({ exists: () => true });

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      // Should NOT write anything
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('updates existing stats summary incrementally', async () => {
      // No existing matchRef
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
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
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.totalMatches).toBe(6);
      expect(stats.wins).toBe(4);
      expect(stats.losses).toBe(2);
      expect(stats.currentStreak).toEqual({ type: 'W', count: 3 });
      expect(stats.recentResults).toHaveLength(6);
    });

    it('resets win streak on a loss', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 3;
      existingStats.wins = 3;
      existingStats.losses = 0;
      existingStats.currentStreak = { type: 'W', count: 3 };
      existingStats.bestWinStreak = 3;
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch({ winningSide: 2 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'loss',
      );

      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.currentStreak).toEqual({ type: 'L', count: 1 });
      expect(stats.bestWinStreak).toBe(3); // preserved
    });

    it('caps recentResults ring buffer at 50', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 50;
      existingStats.recentResults = makeResults(50);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.recentResults).toHaveLength(50);
    });

    it('builds matchRef with correct fields', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch({
        id: 'match-42',
        team1Name: 'Alice',
        team2Name: 'Bob',
        startedAt: 1000,
        completedAt: 2000,
      });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      const refCall = mockSetDoc.mock.calls[0];
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

    it('tracks doubles stats separately', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch({
        config: {
          gameType: 'doubles',
          scoringMode: 'rally',
          matchFormat: 'best-of-3',
          pointsToWin: 11,
        },
      });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.doubles.matches).toBe(1);
      expect(stats.doubles.wins).toBe(1);
      expect(stats.singles.matches).toBe(0);
    });
  });
});
