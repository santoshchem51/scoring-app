// functions/src/lib/statsComputation.ts — Pure server-side stats computation
// No Firestore imports. Only shared types and shared utils.

import type { StatsSummary, CloudMatch, Tier, RecentResult, MatchRef } from '../shared/types';
import { computeTierScore, computeTier, computeTierConfidence } from '../shared/utils/tierEngine';

const RING_BUFFER_SIZE = 50;

// --- Streak helper ---

function updateStreak(
  current: { type: 'W' | 'L'; count: number },
  result: 'win' | 'loss',
): { type: 'W' | 'L'; count: number } {
  const streakType = result === 'win' ? 'W' : 'L';
  if (current.type === streakType) {
    return { type: streakType, count: current.count + 1 };
  }
  return { type: streakType, count: 1 };
}

// --- Unique opponent estimation (v1 approximation) ---

function estimateUniqueOpponents(matchCount: number): number {
  return Math.ceil(matchCount * 0.7);
}

// --- Core stats computation ---

/**
 * Pure function: takes existing stats and a match result, returns updated stats.
 * Does NOT mutate the input — returns a new StatsSummary.
 */
export function computeUpdatedStats(
  existing: StatsSummary,
  match: CloudMatch,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
  opponentTier: Tier,
  opponentUids: string[],
): StatsSummary {
  const stats: StatsSummary = JSON.parse(JSON.stringify(existing));

  const isWin = result === 'win';
  const gameType = match.config.gameType;

  // Totals
  stats.totalMatches += 1;
  stats.wins += isWin ? 1 : 0;
  stats.losses += isWin ? 0 : 1;
  stats.winRate = stats.totalMatches > 0 ? stats.wins / stats.totalMatches : 0;

  // Format-specific stats
  const formatStats = gameType === 'singles' ? stats.singles : stats.doubles;
  formatStats.matches += 1;
  formatStats.wins += isWin ? 1 : 0;
  formatStats.losses += isWin ? 0 : 1;

  // Streak
  const newStreak = updateStreak(stats.currentStreak, result);
  stats.currentStreak = newStreak;
  if (newStreak.type === 'W' && newStreak.count > stats.bestWinStreak) {
    stats.bestWinStreak = newStreak.count;
  }

  // Ring buffer
  const newResult: RecentResult = {
    result,
    opponentTier,
    completedAt: match.completedAt ?? Date.now(),
    gameType,
  };
  stats.recentResults = [...stats.recentResults, newResult].slice(-RING_BUFFER_SIZE);

  // Tier computation
  const score = computeTierScore(stats.recentResults);
  stats.tier = computeTier(score, stats.tier);

  // Unique opponents: merge new opponent UIDs
  const existingUids = new Set(stats.uniqueOpponentUids ?? []);
  for (const oid of opponentUids) {
    existingUids.add(oid);
  }
  stats.uniqueOpponentUids = [...existingUids];

  const uniqueOpponents = stats.uniqueOpponentUids.length || estimateUniqueOpponents(stats.totalMatches);
  stats.tierConfidence = computeTierConfidence(stats.totalMatches, uniqueOpponents);
  stats.tierUpdatedAt = Date.now();

  stats.lastPlayedAt = match.completedAt ?? Date.now();
  stats.updatedAt = Date.now();

  return stats;
}

// --- MatchRef builder ---

/**
 * Builds a MatchRef from a completed match.
 * Formats scores as "11-5, 9-11, 11-7" and gameScores as [[11,5],[9,11],[11,7]].
 */
export function buildMatchRefFromMatch(
  match: CloudMatch,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
  scorerUid: string,
): MatchRef {
  const opponentTeam = playerTeam === 1 ? 2 : 1;
  const opponentNames = opponentTeam === 1 ? [match.team1Name] : [match.team2Name];
  const partnerName = match.config.gameType === 'doubles'
    ? (playerTeam === 1 ? match.team1Name : match.team2Name)
    : null;

  const scores = match.games
    .map((g) => `${g.team1Score}-${g.team2Score}`)
    .join(', ');
  // Firestore Admin SDK doesn't support nested arrays in the emulator's gRPC layer.
  // Store gameScores as an array of {t1, t2} maps instead of [[11,5],[9,11]].
  const gameScoresFlat = match.games.map((g) => ({ t1: g.team1Score, t2: g.team2Score }));

  return {
    matchId: match.id,
    startedAt: match.startedAt,
    completedAt: match.completedAt ?? Date.now(),
    gameType: match.config.gameType,
    scoringMode: match.config.scoringMode,
    result,
    scores,
    gameScores: gameScoresFlat as unknown as number[][],
    playerTeam,
    opponentNames,
    opponentIds: [],
    partnerName,
    partnerId: null,
    ownerId: scorerUid,
    tournamentId: match.tournamentId ?? null,
    tournamentName: null,
  };
}
