import type { StatsSummary, Match, Tier, UnlockedAchievement, AchievementTriggerContext } from '../../../data/types';
import { ACHIEVEMENT_DEFINITIONS } from './badgeDefinitions';
import type { BadgeDefinition } from './badgeDefinitions';

export interface BadgeEvalContext {
  stats: StatsSummary;
  match: Match;
  playerTeam: 1 | 2;
  result: 'win' | 'loss';
  existingIds: Set<string>;
  previousTier?: Tier;
}

type CheckFn = (ctx: BadgeEvalContext) => boolean;

const TIER_ORDER: Record<Tier, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

const checks: Record<string, CheckFn> = {
  // Milestones
  first_rally: (ctx) => ctx.stats.totalMatches >= 1,
  warming_up: (ctx) => ctx.stats.totalMatches >= 10,
  battle_tested: (ctx) => ctx.stats.totalMatches >= 25,
  half_century: (ctx) => ctx.stats.totalMatches >= 50,
  century_club: (ctx) => ctx.stats.totalMatches >= 100,
  // Streaks
  hat_trick: (ctx) => ctx.stats.bestWinStreak >= 3,
  on_fire: (ctx) => ctx.stats.bestWinStreak >= 5,
  unstoppable: (ctx) => ctx.stats.bestWinStreak >= 10,
  // Improvement
  moving_up: (ctx) => {
    if (!ctx.previousTier) return false;
    return TIER_ORDER[ctx.previousTier] < TIER_ORDER['intermediate'] && TIER_ORDER[ctx.stats.tier] >= TIER_ORDER['intermediate'];
  },
  level_up: (ctx) => {
    if (!ctx.previousTier) return false;
    return TIER_ORDER[ctx.previousTier] < TIER_ORDER['advanced'] && TIER_ORDER[ctx.stats.tier] >= TIER_ORDER['advanced'];
  },
  elite: (ctx) => {
    if (!ctx.previousTier) return false;
    return TIER_ORDER[ctx.previousTier] < TIER_ORDER['expert'] && TIER_ORDER[ctx.stats.tier] >= TIER_ORDER['expert'];
  },
  proven: (ctx) => ctx.stats.tierConfidence === 'high',
  // Social
  new_rival: (ctx) => (ctx.stats.uniqueOpponentUids ?? []).length >= 5,
  social_butterfly: (ctx) => (ctx.stats.uniqueOpponentUids ?? []).length >= 15,
  community_pillar: (ctx) => (ctx.stats.uniqueOpponentUids ?? []).length >= 30,
  // Moments
  shutout: (ctx) => {
    if (ctx.result !== 'win') return false;
    return ctx.match.games.some(g => {
      const loserScore = ctx.playerTeam === 1 ? g.team2Score : g.team1Score;
      return loserScore === 0;
    });
  },
  comeback_kid: (ctx) => {
    if (ctx.result !== 'win') return false;
    if (ctx.match.games.length < 2) return false;
    const game1 = ctx.match.games[0];
    return game1.winningSide !== ctx.playerTeam;
  },
  perfect_match: (ctx) => {
    if (ctx.result !== 'win') return false;
    if (ctx.match.games.length < 2) return false;
    return ctx.match.games.every(g => g.winningSide === ctx.playerTeam);
  },
  doubles_specialist: (ctx) => ctx.stats.doubles.wins >= 25,
  singles_ace: (ctx) => ctx.stats.singles.wins >= 25,
  // Consistency
  first_win: (ctx) => ctx.stats.wins >= 1,
  winning_ways: (ctx) => ctx.stats.totalMatches >= 20 && ctx.stats.winRate >= 0.6,
  dominant_force: (ctx) => ctx.stats.totalMatches >= 30 && ctx.stats.winRate >= 0.75,
};

function buildTriggerContext(def: BadgeDefinition, ctx: BadgeEvalContext): AchievementTriggerContext {
  if (def.category === 'moments') {
    const scores = ctx.match.games.map(g => `${g.team1Score}-${g.team2Score}`).join(', ');
    return { type: 'match', matchScore: scores, outcome: ctx.result };
  }
  if (def.category === 'improvement' && ctx.previousTier) {
    return { type: 'tier', from: ctx.previousTier, to: ctx.stats.tier };
  }
  // Stats-based
  const fieldMap: Record<string, number> = {
    first_rally: ctx.stats.totalMatches,
    warming_up: ctx.stats.totalMatches,
    battle_tested: ctx.stats.totalMatches,
    half_century: ctx.stats.totalMatches,
    century_club: ctx.stats.totalMatches,
    hat_trick: ctx.stats.bestWinStreak,
    on_fire: ctx.stats.bestWinStreak,
    unstoppable: ctx.stats.bestWinStreak,
    proven: ctx.stats.totalMatches,
    new_rival: (ctx.stats.uniqueOpponentUids ?? []).length,
    social_butterfly: (ctx.stats.uniqueOpponentUids ?? []).length,
    community_pillar: (ctx.stats.uniqueOpponentUids ?? []).length,
    first_win: ctx.stats.wins,
    winning_ways: ctx.stats.winRate,
    dominant_force: ctx.stats.winRate,
    doubles_specialist: ctx.stats.doubles.wins,
    singles_ace: ctx.stats.singles.wins,
  };
  return { type: 'stats', field: def.id, value: fieldMap[def.id] ?? 0 };
}

export function evaluate(ctx: BadgeEvalContext): UnlockedAchievement[] {
  const now = Date.now();
  return ACHIEVEMENT_DEFINITIONS
    .filter(def => {
      if (ctx.existingIds.has(def.id)) return false;
      const check = checks[def.id];
      return check ? check(ctx) : false;
    })
    .map(def => ({
      achievementId: def.id,
      unlockedAt: now,
      triggerMatchId: ctx.match.id,
      triggerContext: buildTriggerContext(def, ctx),
    }));
}
