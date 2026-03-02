import type { Tier, RecentResult, StatsSummary, Last30dStats, LeaderboardEntry } from '../../data/types';

const TIER_SCORE: Record<Tier, number> = {
  beginner: 25,
  intermediate: 50,
  advanced: 75,
  expert: 100,
};

/**
 * Compute a composite leaderboard score (0-100) from tier, win rate, and activity.
 * Weights: 40% tier, 35% win rate, 25% activity (capped at 50 matches).
 * Clamps winRate to valid range to handle edge cases (NaN, negative, >1.0).
 */
export function computeCompositeScore(
  tier: Tier,
  winRate: number,
  totalMatches: number,
): number {
  const clampedWinRate = Number.isFinite(winRate) ? Math.max(0, Math.min(1, winRate)) : 0;
  const tierScore = TIER_SCORE[tier];
  const activityScore = Math.min(totalMatches / 50, 1) * 100;
  return 0.40 * tierScore + 0.35 * clampedWinRate * 100 + 0.25 * activityScore;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Compute stats for the last 30 days from recent results.
 */
export function computeLast30dStats(
  recentResults: RecentResult[],
  tier: Tier,
  now: number,
): Last30dStats {
  const cutoff = now - THIRTY_DAYS_MS;
  const recent = recentResults.filter((r) => r.completedAt > cutoff);
  const totalMatches = recent.length;
  const wins = recent.filter((r) => r.result === 'win').length;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;
  const compositeScore = computeCompositeScore(tier, winRate, totalMatches);
  return { totalMatches, wins, winRate, compositeScore };
}

const MIN_MATCHES_FOR_LEADERBOARD = 5;

/**
 * Build a LeaderboardEntry from user profile info and stats.
 * Returns null if the player doesn't meet the minimum match threshold.
 */
export function buildLeaderboardEntry(
  uid: string,
  displayName: string,
  photoURL: string | null,
  stats: StatsSummary,
  now: number,
): LeaderboardEntry | null {
  if (stats.totalMatches < MIN_MATCHES_FOR_LEADERBOARD) return null;
  const compositeScore = computeCompositeScore(stats.tier, stats.winRate, stats.totalMatches);
  const last30d = computeLast30dStats(stats.recentResults, stats.tier, now);
  return {
    uid,
    displayName,
    photoURL,
    tier: stats.tier,
    tierConfidence: stats.tierConfidence,
    totalMatches: stats.totalMatches,
    wins: stats.wins,
    winRate: stats.winRate,
    currentStreak: stats.currentStreak,
    compositeScore,
    last30d,
    lastPlayedAt: stats.lastPlayedAt,
    createdAt: now,
    updatedAt: now,
  };
}
