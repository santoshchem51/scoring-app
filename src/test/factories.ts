import type { RecentResult, StatsSummary, LeaderboardEntry } from '../data/types';

export function makeResult(overrides: Partial<RecentResult> = {}): RecentResult {
  return {
    result: 'win',
    opponentTier: 'intermediate',
    completedAt: Date.now(),
    gameType: 'singles',
    ...overrides,
  };
}

export function makeStatsSummary(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 10,
    wins: 6,
    losses: 4,
    winRate: 0.6,
    currentStreak: { type: 'W', count: 2 },
    bestWinStreak: 3,
    singles: { matches: 5, wins: 3, losses: 2 },
    doubles: { matches: 5, wins: 3, losses: 2 },
    recentResults: [],
    tier: 'intermediate',
    tierConfidence: 'medium',
    tierUpdatedAt: Date.now(),
    lastPlayedAt: Date.now(),
    updatedAt: Date.now(),
    uniqueOpponentUids: ['opp-1', 'opp-2'],
    ...overrides,
  };
}

export function makeLeaderboardEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    uid: 'user-1',
    displayName: 'Alice',
    photoURL: null,
    tier: 'intermediate',
    tierConfidence: 'medium',
    totalMatches: 10,
    wins: 6,
    winRate: 0.6,
    currentStreak: { type: 'W', count: 2 },
    compositeScore: 55,
    last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 50 },
    lastPlayedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
