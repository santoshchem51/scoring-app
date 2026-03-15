import { describe, it, expect } from 'vitest';
import { computeUpdatedStats, buildMatchRefFromMatch } from '../statsComputation';
import type { StatsSummary, CloudMatch, Tier } from '../../shared/types';

function emptyStats(): StatsSummary {
  return {
    schemaVersion: 1, totalMatches: 0, wins: 0, losses: 0, winRate: 0,
    currentStreak: { type: 'W', count: 0 }, bestWinStreak: 0,
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: [], tier: 'beginner', tierConfidence: 'low',
    tierUpdatedAt: 0, lastPlayedAt: 0, updatedAt: 0, uniqueOpponentUids: [],
  };
}

function makeMatch(overrides: Partial<CloudMatch> = {}): CloudMatch {
  return {
    id: 'match-1',
    config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [], team2PlayerIds: [],
    team1Name: 'Team A', team2Name: 'Team B',
    games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
    winningSide: 1, status: 'completed',
    startedAt: 1000, completedAt: 2000,
    ownerId: 'owner-1', sharedWith: [], visibility: 'private', syncedAt: 3000,
    ...overrides,
  };
}

describe('computeUpdatedStats', () => {
  it('increments wins for a winning player', () => {
    const stats = emptyStats();
    const result = computeUpdatedStats(stats, makeMatch(), 1, 'win', 'beginner', []);
    expect(result.totalMatches).toBe(1);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(1);
    expect(result.singles.wins).toBe(1);
    expect(result.currentStreak).toEqual({ type: 'W', count: 1 });
  });

  it('increments losses for a losing player', () => {
    const stats = emptyStats();
    const result = computeUpdatedStats(stats, makeMatch(), 2, 'loss', 'beginner', []);
    expect(result.totalMatches).toBe(1);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(1);
  });

  it('updates doubles stats for doubles matches', () => {
    const match = makeMatch({
      config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    });
    const stats = emptyStats();
    const result = computeUpdatedStats(stats, match, 1, 'win', 'beginner', []);
    expect(result.doubles.wins).toBe(1);
    expect(result.singles.wins).toBe(0);
  });

  it('merges opponent UIDs into uniqueOpponentUids', () => {
    const stats = emptyStats();
    stats.uniqueOpponentUids = ['existing-uid'];
    const result = computeUpdatedStats(stats, makeMatch(), 1, 'win', 'beginner', ['opp-1', 'opp-2']);
    expect(result.uniqueOpponentUids).toContain('existing-uid');
    expect(result.uniqueOpponentUids).toContain('opp-1');
    expect(result.uniqueOpponentUids).toContain('opp-2');
  });

  it('caps recentResults ring buffer at 50', () => {
    const stats = emptyStats();
    stats.recentResults = Array.from({ length: 50 }, (_, i) => ({
      result: 'win' as const, opponentTier: 'beginner' as Tier,
      completedAt: i, gameType: 'singles' as const,
    }));
    const result = computeUpdatedStats(stats, makeMatch(), 1, 'win', 'beginner', []);
    expect(result.recentResults.length).toBe(50);
  });
});

describe('buildMatchRefFromMatch', () => {
  it('builds a match ref with correct fields', () => {
    const match = makeMatch();
    const ref = buildMatchRefFromMatch(match, 1, 'win', 'owner-1');
    expect(ref.matchId).toBe('match-1');
    expect(ref.result).toBe('win');
    expect(ref.playerTeam).toBe(1);
    expect(ref.ownerId).toBe('owner-1');
    expect(ref.scores).toBe('11-5');
    expect(ref.gameScores).toEqual([[11, 5]]);
  });
});
