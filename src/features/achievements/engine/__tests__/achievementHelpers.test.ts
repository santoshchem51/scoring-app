import { describe, it, expect } from 'vitest';
import { computeProgress } from '../achievementHelpers';
import type { BadgeDefinition } from '../badgeDefinitions';
import type { StatsSummary } from '../../../../data/types';

function makeDef(id: string): BadgeDefinition {
  return { id, name: '', description: '', category: 'milestones', tier: 'bronze', icon: '' };
}

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

describe('computeProgress', () => {
  it('returns undefined for null stats', () => {
    const result = computeProgress(makeDef('first_rally'), null);
    expect(result).toBeUndefined();
  });

  it('returns correct progress for first_rally (totalMatches/1)', () => {
    const stats = makeStats({ totalMatches: 0 });
    const result = computeProgress(makeDef('first_rally'), stats);
    expect(result).toEqual({ current: 0, target: 1 });
  });

  it('returns correct progress for century_club (totalMatches/100)', () => {
    const stats = makeStats({ totalMatches: 42 });
    const result = computeProgress(makeDef('century_club'), stats);
    expect(result).toEqual({ current: 42, target: 100 });
  });

  it('returns correct progress for hat_trick (bestWinStreak/3)', () => {
    const stats = makeStats({ bestWinStreak: 2 });
    const result = computeProgress(makeDef('hat_trick'), stats);
    expect(result).toEqual({ current: 2, target: 3 });
  });

  it('returns correct progress for new_rival (uniqueOpponentUids.length/5)', () => {
    const stats = makeStats({ uniqueOpponentUids: ['a', 'b', 'c'] });
    const result = computeProgress(makeDef('new_rival'), stats);
    expect(result).toEqual({ current: 3, target: 5 });
  });

  it('returns correct progress for doubles_specialist (doubles.wins/25)', () => {
    const stats = makeStats({ doubles: { matches: 20, wins: 12, losses: 8 } });
    const result = computeProgress(makeDef('doubles_specialist'), stats);
    expect(result).toEqual({ current: 12, target: 25 });
  });

  it('returns correct progress for winning_ways when totalMatches < 20 (match progress toward 20)', () => {
    const stats = makeStats({ totalMatches: 15, winRate: 0.8 });
    const result = computeProgress(makeDef('winning_ways'), stats);
    expect(result).toEqual({ current: 15, target: 20 });
  });

  it('returns correct progress for winning_ways when totalMatches >= 20 (win rate toward 60)', () => {
    const stats = makeStats({ totalMatches: 25, winRate: 0.52 });
    const result = computeProgress(makeDef('winning_ways'), stats);
    expect(result).toEqual({ current: 52, target: 60 });
  });

  it('returns undefined for unknown badge IDs (e.g., improvement badges like moving_up)', () => {
    const stats = makeStats({ totalMatches: 50 });
    const result = computeProgress(makeDef('moving_up'), stats);
    expect(result).toBeUndefined();
  });
});
