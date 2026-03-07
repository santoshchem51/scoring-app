import { describe, it, expect } from 'vitest';
import { evaluate } from '../badgeEngine';
import type { BadgeEvalContext } from '../badgeEngine';
import type { StatsSummary, Match, Tier } from '../../../../data/types';

function makeStats(overrides: Partial<StatsSummary> = {}): StatsSummary {
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
    ...overrides,
  };
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
    winningSide: 1,
    status: 'completed',
    startedAt: Date.now(),
    completedAt: Date.now(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<BadgeEvalContext> = {}): BadgeEvalContext {
  return {
    stats: makeStats(),
    match: makeMatch(),
    playerTeam: 1,
    result: 'win',
    existingIds: new Set(),
    ...overrides,
  };
}

function unlockedIds(ctx: BadgeEvalContext): string[] {
  return evaluate(ctx).map(a => a.achievementId);
}

describe('badgeEngine.evaluate', () => {
  // --- Milestones ---
  describe('milestones', () => {
    it('unlocks first_rally at 1 match', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 1 }) }))).toContain('first_rally');
    });

    it('does not unlock first_rally at 0 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 0 }) }))).not.toContain('first_rally');
    });

    it('unlocks warming_up at 10 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 10 }) }))).toContain('warming_up');
    });

    it('unlocks battle_tested at 25 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 25 }) }))).toContain('battle_tested');
    });

    it('unlocks half_century at 50 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 50 }) }))).toContain('half_century');
    });

    it('unlocks century_club at 100 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 100 }) }))).toContain('century_club');
    });

    it('does not unlock century_club at 99 matches', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ totalMatches: 99 }) }))).not.toContain('century_club');
    });
  });

  // --- Streaks ---
  describe('streaks', () => {
    it('unlocks hat_trick at bestWinStreak 3', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ bestWinStreak: 3 }) }))).toContain('hat_trick');
    });

    it('unlocks on_fire at bestWinStreak 5', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ bestWinStreak: 5 }) }))).toContain('on_fire');
    });

    it('unlocks unstoppable at bestWinStreak 10', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ bestWinStreak: 10 }) }))).toContain('unstoppable');
    });
  });

  // --- Improvement ---
  describe('improvement', () => {
    it('unlocks moving_up when promoted to intermediate', () => {
      const ctx = makeCtx({
        stats: makeStats({ tier: 'intermediate' }),
        previousTier: 'beginner',
      });
      expect(unlockedIds(ctx)).toContain('moving_up');
    });

    it('does not unlock moving_up without tier change', () => {
      const ctx = makeCtx({
        stats: makeStats({ tier: 'intermediate' }),
        previousTier: 'intermediate',
      });
      expect(unlockedIds(ctx)).not.toContain('moving_up');
    });

    it('unlocks level_up when promoted to advanced', () => {
      const ctx = makeCtx({
        stats: makeStats({ tier: 'advanced' }),
        previousTier: 'intermediate',
      });
      expect(unlockedIds(ctx)).toContain('level_up');
    });

    it('unlocks elite when promoted to expert', () => {
      const ctx = makeCtx({
        stats: makeStats({ tier: 'expert' }),
        previousTier: 'advanced',
      });
      expect(unlockedIds(ctx)).toContain('elite');
    });

    it('unlocks proven at high tier confidence', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ tierConfidence: 'high' }) }))).toContain('proven');
    });

    it('does not unlock proven at medium confidence', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ tierConfidence: 'medium' }) }))).not.toContain('proven');
    });
  });

  // --- Social ---
  describe('social', () => {
    it('unlocks new_rival at 5 unique opponents', () => {
      const uids = Array.from({ length: 5 }, (_, i) => `uid-${i}`);
      expect(unlockedIds(makeCtx({ stats: makeStats({ uniqueOpponentUids: uids }) }))).toContain('new_rival');
    });

    it('unlocks social_butterfly at 15 unique opponents', () => {
      const uids = Array.from({ length: 15 }, (_, i) => `uid-${i}`);
      expect(unlockedIds(makeCtx({ stats: makeStats({ uniqueOpponentUids: uids }) }))).toContain('social_butterfly');
    });

    it('unlocks community_pillar at 30 unique opponents', () => {
      const uids = Array.from({ length: 30 }, (_, i) => `uid-${i}`);
      expect(unlockedIds(makeCtx({ stats: makeStats({ uniqueOpponentUids: uids }) }))).toContain('community_pillar');
    });
  });

  // --- Moments ---
  describe('moments', () => {
    it('unlocks shutout when opponent scores 0 in any game', () => {
      const match = makeMatch({
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 0, winningSide: 1 }],
        winningSide: 1,
      });
      expect(unlockedIds(makeCtx({ match, result: 'win', playerTeam: 1 }))).toContain('shutout');
    });

    it('does not unlock shutout on a loss', () => {
      const match = makeMatch({
        games: [{ gameNumber: 1, team1Score: 0, team2Score: 11, winningSide: 2 }],
        winningSide: 2,
      });
      expect(unlockedIds(makeCtx({ match, result: 'loss', playerTeam: 1 }))).not.toContain('shutout');
    });

    it('unlocks comeback_kid when lost game 1 but won match (best-of-3)', () => {
      const match = makeMatch({
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
        games: [
          { gameNumber: 1, team1Score: 5, team2Score: 11, winningSide: 2 },
          { gameNumber: 2, team1Score: 11, team2Score: 4, winningSide: 1 },
          { gameNumber: 3, team1Score: 11, team2Score: 6, winningSide: 1 },
        ],
        winningSide: 1,
      });
      expect(unlockedIds(makeCtx({ match, result: 'win', playerTeam: 1 }))).toContain('comeback_kid');
    });

    it('does not unlock comeback_kid in single-game match', () => {
      const match = makeMatch({
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1,
      });
      expect(unlockedIds(makeCtx({ match, result: 'win', playerTeam: 1 }))).not.toContain('comeback_kid');
    });

    it('unlocks perfect_match when won all games in best-of-3', () => {
      const match = makeMatch({
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
        games: [
          { gameNumber: 1, team1Score: 11, team2Score: 4, winningSide: 1 },
          { gameNumber: 2, team1Score: 11, team2Score: 6, winningSide: 1 },
        ],
        winningSide: 1,
      });
      expect(unlockedIds(makeCtx({ match, result: 'win', playerTeam: 1 }))).toContain('perfect_match');
    });

    it('does not unlock perfect_match in single-game match', () => {
      expect(unlockedIds(makeCtx({ result: 'win' }))).not.toContain('perfect_match');
    });

    it('unlocks doubles_specialist at 25 doubles wins', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ doubles: { matches: 30, wins: 25, losses: 5 } }),
      }))).toContain('doubles_specialist');
    });

    it('unlocks singles_ace at 25 singles wins', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ singles: { matches: 30, wins: 25, losses: 5 } }),
      }))).toContain('singles_ace');
    });
  });

  // --- Consistency ---
  describe('consistency', () => {
    it('unlocks first_win at 1 win', () => {
      expect(unlockedIds(makeCtx({ stats: makeStats({ wins: 1 }) }))).toContain('first_win');
    });

    it('unlocks winning_ways at 60% win rate with 20+ matches', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ winRate: 0.6, totalMatches: 20 }),
      }))).toContain('winning_ways');
    });

    it('does not unlock winning_ways below 20 matches', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ winRate: 0.7, totalMatches: 19 }),
      }))).not.toContain('winning_ways');
    });

    it('unlocks dominant_force at 75% win rate with 30+ matches', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ winRate: 0.75, totalMatches: 30 }),
      }))).toContain('dominant_force');
    });

    it('does not unlock dominant_force below 30 matches', () => {
      expect(unlockedIds(makeCtx({
        stats: makeStats({ winRate: 0.8, totalMatches: 29 }),
      }))).not.toContain('dominant_force');
    });
  });

  // --- Cross-cutting ---
  describe('cross-cutting', () => {
    it('skips already-unlocked achievements', () => {
      const ctx = makeCtx({
        stats: makeStats({ totalMatches: 1, wins: 1 }),
        existingIds: new Set(['first_rally', 'first_win']),
      });
      const ids = unlockedIds(ctx);
      expect(ids).not.toContain('first_rally');
      expect(ids).not.toContain('first_win');
    });

    it('returns empty array when nothing qualifies', () => {
      const ctx = makeCtx({ stats: makeStats() });
      expect(evaluate(ctx)).toEqual([]);
    });

    it('can unlock multiple achievements at once', () => {
      const ctx = makeCtx({
        stats: makeStats({ totalMatches: 1, wins: 1 }),
      });
      const ids = unlockedIds(ctx);
      expect(ids).toContain('first_rally');
      expect(ids).toContain('first_win');
    });
  });
});
