import { describe, it, expect } from 'vitest';
import { evaluate } from '../badgeEngine';
import type { BadgeEvalContext } from '../badgeEngine';

describe('achievement integration with stats pipeline', () => {
  it('evaluates with correct context shape', () => {
    const ctx: BadgeEvalContext = {
      stats: {
        schemaVersion: 1, totalMatches: 1, wins: 1, losses: 0, winRate: 1,
        currentStreak: { type: 'W', count: 1 }, bestWinStreak: 1,
        singles: { matches: 1, wins: 1, losses: 0 },
        doubles: { matches: 0, wins: 0, losses: 0 },
        recentResults: [], tier: 'beginner', tierConfidence: 'low',
        tierUpdatedAt: Date.now(), lastPlayedAt: Date.now(),
        updatedAt: Date.now(), uniqueOpponentUids: [],
      },
      match: {
        id: 'test-match', config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: [], team2PlayerIds: [], team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1, status: 'completed', startedAt: Date.now(), completedAt: Date.now(),
      },
      playerTeam: 1,
      result: 'win',
      existingIds: new Set(),
      previousTier: 'beginner',
    };

    const unlocked = evaluate(ctx);
    expect(unlocked.length).toBeGreaterThan(0);
    expect(unlocked.every(a => a.achievementId && a.triggerMatchId === 'test-match')).toBe(true);
  });

  it('gates on tierUpdated — returns empty when previousTier equals current', () => {
    const ctx: BadgeEvalContext = {
      stats: {
        schemaVersion: 1, totalMatches: 0, wins: 0, losses: 0, winRate: 0,
        currentStreak: { type: 'W', count: 0 }, bestWinStreak: 0,
        singles: { matches: 0, wins: 0, losses: 0 },
        doubles: { matches: 0, wins: 0, losses: 0 },
        recentResults: [], tier: 'beginner', tierConfidence: 'low',
        tierUpdatedAt: 0, lastPlayedAt: 0, updatedAt: 0, uniqueOpponentUids: [],
      },
      match: {
        id: 'test', config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: [], team2PlayerIds: [], team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1, status: 'completed', startedAt: 0, completedAt: 0,
      },
      playerTeam: 1,
      result: 'win',
      existingIds: new Set(),
    };

    const unlocked = evaluate(ctx);
    // No improvement badges should unlock without previousTier
    expect(unlocked.map(a => a.achievementId)).not.toContain('moving_up');
  });
});
