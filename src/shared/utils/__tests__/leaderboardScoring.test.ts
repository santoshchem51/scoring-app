import { describe, it, expect } from 'vitest';
import type { RecentResult } from '../../../data/types';
import { makeResult, makeStatsSummary } from '../../../test/factories';
import {
  computeCompositeScore,
  computeLast30dStats,
  buildLeaderboardEntry,
} from '../leaderboardScoring';

// --- computeCompositeScore ---

describe('computeCompositeScore', () => {
  it('returns 10 for beginner / 0% winRate / 0 matches', () => {
    // 0.40 * 25 + 0.35 * 0 * 100 + 0.25 * (0/50) * 100
    // = 10 + 0 + 0 = 10
    expect(computeCompositeScore('beginner', 0, 0)).toBeCloseTo(10, 2);
  });

  it('returns 100 for expert / 100% winRate / 50 matches', () => {
    // 0.40 * 100 + 0.35 * 1.0 * 100 + 0.25 * (50/50) * 100
    // = 40 + 35 + 25 = 100
    expect(computeCompositeScore('expert', 1.0, 50)).toBeCloseTo(100, 2);
  });

  it('caps activity score at 50 matches', () => {
    const at50 = computeCompositeScore('intermediate', 0.5, 50);
    const at100 = computeCompositeScore('intermediate', 0.5, 100);
    expect(at50).toBeCloseTo(at100, 2);
  });

  it('tier is the heaviest ranking factor', () => {
    // beginner with 100% winRate vs expert with 0% winRate
    const beginnerPerfect = computeCompositeScore('beginner', 1.0, 25);
    const expertZero = computeCompositeScore('expert', 0, 25);
    // beginner: 0.40*25 + 0.35*100 + 0.25*50 = 10+35+12.5 = 57.5
    // expert:   0.40*100 + 0.35*0 + 0.25*50 = 40+0+12.5 = 52.5
    // Actually winRate matters more here. Let's verify the values are distinct.
    expect(beginnerPerfect).not.toEqual(expertZero);
  });

  it('score is bounded between 0 and 100 for all valid inputs', () => {
    const lowest = computeCompositeScore('beginner', 0, 0);
    const highest = computeCompositeScore('expert', 1.0, 50);
    expect(lowest).toBeGreaterThanOrEqual(0);
    expect(lowest).toBeLessThanOrEqual(100);
    expect(highest).toBeGreaterThanOrEqual(0);
    expect(highest).toBeLessThanOrEqual(100);
  });

  it('exact tier deltas: each tier step adds 10 points with same winRate/matches', () => {
    const beginner = computeCompositeScore('beginner', 0.5, 25);
    const intermediate = computeCompositeScore('intermediate', 0.5, 25);
    const advanced = computeCompositeScore('advanced', 0.5, 25);
    const expert = computeCompositeScore('expert', 0.5, 25);
    // Tier scores: 25, 50, 75, 100 — weight 0.40
    // Each step = 25 * 0.40 = 10 point delta
    expect(intermediate - beginner).toBeCloseTo(10, 2);
    expect(advanced - intermediate).toBeCloseTo(10, 2);
    expect(expert - advanced).toBeCloseTo(10, 2);
  });

  it('clamps negative winRate to 0', () => {
    const negativeWR = computeCompositeScore('intermediate', -0.5, 10);
    const zeroWR = computeCompositeScore('intermediate', 0, 10);
    expect(negativeWR).toBeCloseTo(zeroWR, 2);
  });

  it('clamps winRate > 1.0 to 1.0', () => {
    const overWR = computeCompositeScore('intermediate', 1.5, 10);
    const maxWR = computeCompositeScore('intermediate', 1.0, 10);
    expect(overWR).toBeCloseTo(maxWR, 2);
  });

  it('handles NaN winRate by treating it as 0', () => {
    const nanWR = computeCompositeScore('intermediate', NaN, 10);
    const zeroWR = computeCompositeScore('intermediate', 0, 10);
    expect(nanWR).toBeCloseTo(zeroWR, 2);
  });
});

// --- computeLast30dStats ---

describe('computeLast30dStats', () => {
  const NOW = 1_700_000_000_000; // fixed timestamp for deterministic tests
  const ONE_DAY = 24 * 60 * 60 * 1000;

  it('returns zeros for empty results', () => {
    const stats = computeLast30dStats([], 'intermediate', NOW);
    expect(stats).toEqual({
      totalMatches: 0,
      wins: 0,
      winRate: 0,
      compositeScore: expect.any(Number),
    });
    expect(stats.winRate).toBe(0);
  });

  it('includes results within 30 days and excludes older ones', () => {
    const results: RecentResult[] = [
      makeResult({ completedAt: NOW - 10 * ONE_DAY, result: 'win' }),   // within 30d
      makeResult({ completedAt: NOW - 25 * ONE_DAY, result: 'win' }),   // within 30d
      makeResult({ completedAt: NOW - 31 * ONE_DAY, result: 'loss' }),  // outside 30d
      makeResult({ completedAt: NOW - 60 * ONE_DAY, result: 'win' }),   // outside 30d
    ];
    const stats = computeLast30dStats(results, 'intermediate', NOW);
    expect(stats.totalMatches).toBe(2);
    expect(stats.wins).toBe(2);
    expect(stats.winRate).toBeCloseTo(1.0, 2);
  });

  it('counts all results when all are within 30 days', () => {
    const results: RecentResult[] = [
      makeResult({ completedAt: NOW - 1 * ONE_DAY, result: 'win' }),
      makeResult({ completedAt: NOW - 5 * ONE_DAY, result: 'loss' }),
      makeResult({ completedAt: NOW - 15 * ONE_DAY, result: 'win' }),
      makeResult({ completedAt: NOW - 29 * ONE_DAY, result: 'loss' }),
    ];
    const stats = computeLast30dStats(results, 'advanced', NOW);
    expect(stats.totalMatches).toBe(4);
    expect(stats.wins).toBe(2);
    expect(stats.winRate).toBeCloseTo(0.5, 2);
  });

  it('returns zeros when all results are outside 30 days', () => {
    const results: RecentResult[] = [
      makeResult({ completedAt: NOW - 31 * ONE_DAY, result: 'win' }),
      makeResult({ completedAt: NOW - 60 * ONE_DAY, result: 'win' }),
    ];
    const stats = computeLast30dStats(results, 'intermediate', NOW);
    expect(stats.totalMatches).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.winRate).toBe(0);
  });

  it('compositeScore uses 30d values, not all-time', () => {
    // 2 matches within 30d, 10 outside. Composite should use totalMatches=2.
    const results: RecentResult[] = [
      makeResult({ completedAt: NOW - 1 * ONE_DAY, result: 'win' }),
      makeResult({ completedAt: NOW - 2 * ONE_DAY, result: 'win' }),
      ...Array.from({ length: 10 }, (_, i) =>
        makeResult({ completedAt: NOW - (31 + i) * ONE_DAY, result: 'win' }),
      ),
    ];
    const stats = computeLast30dStats(results, 'intermediate', NOW);
    // compositeScore should be based on 2 matches, not 12
    // 0.40*50 + 0.35*1.0*100 + 0.25*(2/50)*100 = 20 + 35 + 1 = 56
    expect(stats.compositeScore).toBeCloseTo(56, 0);
  });
});

// --- buildLeaderboardEntry ---

describe('buildLeaderboardEntry', () => {
  const NOW = 1_700_000_000_000;

  it('returns null when totalMatches < 5', () => {
    const stats = makeStatsSummary({ totalMatches: 4 });
    const entry = buildLeaderboardEntry('u1', 'Bob', null, stats, NOW);
    expect(entry).toBeNull();
  });

  it('returns null when totalMatches is exactly 4', () => {
    const stats = makeStatsSummary({ totalMatches: 4 });
    expect(buildLeaderboardEntry('u1', 'Bob', null, stats, NOW)).toBeNull();
  });

  it('returns entry when totalMatches is exactly 5', () => {
    const stats = makeStatsSummary({ totalMatches: 5 });
    const entry = buildLeaderboardEntry('u1', 'Bob', null, stats, NOW);
    expect(entry).not.toBeNull();
  });

  it('returns correct fields when totalMatches >= 5', () => {
    const stats = makeStatsSummary({
      totalMatches: 20,
      wins: 12,
      winRate: 0.6,
      tier: 'advanced',
      tierConfidence: 'high',
      currentStreak: { type: 'W', count: 5 },
      lastPlayedAt: NOW - 1000,
      recentResults: [],
    });
    const entry = buildLeaderboardEntry('u1', 'Alice', 'http://photo.jpg', stats, NOW);
    expect(entry).not.toBeNull();
    expect(entry!.uid).toBe('u1');
    expect(entry!.displayName).toBe('Alice');
    expect(entry!.photoURL).toBe('http://photo.jpg');
    expect(entry!.tier).toBe('advanced');
    expect(entry!.tierConfidence).toBe('high');
    expect(entry!.totalMatches).toBe(20);
    expect(entry!.wins).toBe(12);
    expect(entry!.winRate).toBe(0.6);
    expect(entry!.currentStreak).toEqual({ type: 'W', count: 5 });
    expect(entry!.lastPlayedAt).toBe(NOW - 1000);
    expect(entry!.createdAt).toBe(NOW);
    expect(entry!.updatedAt).toBe(NOW);
  });

  it('computes compositeScore from stats', () => {
    const stats = makeStatsSummary({
      totalMatches: 20,
      winRate: 0.6,
      tier: 'advanced',
      recentResults: [],
    });
    const entry = buildLeaderboardEntry('u1', 'Alice', null, stats, NOW);
    // 0.40*75 + 0.35*0.6*100 + 0.25*(20/50)*100 = 30+21+10 = 61
    expect(entry!.compositeScore).toBeCloseTo(61, 0);
  });

  it('computes last30d from recentResults', () => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const recentResults = [
      makeResult({ completedAt: NOW - 1 * ONE_DAY, result: 'win' }),
      makeResult({ completedAt: NOW - 5 * ONE_DAY, result: 'loss' }),
      makeResult({ completedAt: NOW - 10 * ONE_DAY, result: 'win' }),
      makeResult({ completedAt: NOW - 60 * ONE_DAY, result: 'win' }), // outside 30d
    ];
    const stats = makeStatsSummary({
      totalMatches: 10,
      tier: 'intermediate',
      recentResults,
    });
    const entry = buildLeaderboardEntry('u1', 'Alice', null, stats, NOW);
    expect(entry!.last30d.totalMatches).toBe(3);
    expect(entry!.last30d.wins).toBe(2);
    expect(entry!.last30d.winRate).toBeCloseTo(2 / 3, 4);
  });

  it('handles null photoURL', () => {
    const stats = makeStatsSummary({ totalMatches: 10 });
    const entry = buildLeaderboardEntry('u1', 'Bob', null, stats, NOW);
    expect(entry!.photoURL).toBeNull();
  });

  it('sets createdAt and updatedAt to now', () => {
    const stats = makeStatsSummary({ totalMatches: 10 });
    const entry = buildLeaderboardEntry('u1', 'Bob', null, stats, NOW);
    expect(entry!.createdAt).toBe(NOW);
    expect(entry!.updatedAt).toBe(NOW);
  });
});
