import type { StatsSummary } from '../../../data/types';
import type { BadgeDefinition } from './badgeDefinitions';

export interface AchievementProgress {
  current: number;
  target: number;
}

export function computeProgress(def: BadgeDefinition, stats: StatsSummary | null): AchievementProgress | undefined {
  if (!stats) return undefined;

  const progressMap: Record<string, { current: number; target: number }> = {
    first_rally: { current: stats.totalMatches, target: 1 },
    warming_up: { current: stats.totalMatches, target: 10 },
    battle_tested: { current: stats.totalMatches, target: 25 },
    half_century: { current: stats.totalMatches, target: 50 },
    century_club: { current: stats.totalMatches, target: 100 },
    hat_trick: { current: stats.bestWinStreak, target: 3 },
    on_fire: { current: stats.bestWinStreak, target: 5 },
    unstoppable: { current: stats.bestWinStreak, target: 10 },
    new_rival: { current: (stats.uniqueOpponentUids ?? []).length, target: 5 },
    social_butterfly: { current: (stats.uniqueOpponentUids ?? []).length, target: 15 },
    community_pillar: { current: (stats.uniqueOpponentUids ?? []).length, target: 30 },
    first_win: { current: stats.wins, target: 1 },
    winning_ways: { current: stats.totalMatches >= 20 ? Math.round(stats.winRate * 100) : stats.totalMatches, target: stats.totalMatches >= 20 ? 60 : 20 },
    dominant_force: { current: stats.totalMatches >= 30 ? Math.round(stats.winRate * 100) : stats.totalMatches, target: stats.totalMatches >= 30 ? 75 : 30 },
    doubles_specialist: { current: stats.doubles.wins, target: 25 },
    singles_ace: { current: stats.singles.wins, target: 25 },
  };

  return progressMap[def.id];
}
