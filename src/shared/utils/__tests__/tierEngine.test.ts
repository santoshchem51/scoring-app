import { describe, it, expect } from 'vitest';
import type { RecentResult } from '../../../data/types';
import { computeTierScore, computeTier, computeTierConfidence } from '../tierEngine';

// --- Factory ---
function makeResult(overrides: Partial<RecentResult> = {}): RecentResult {
  return {
    result: 'win',
    opponentTier: 'intermediate',
    completedAt: Date.now(),
    gameType: 'singles',
    ...overrides,
  };
}

function makeResults(
  count: number,
  overrides: Partial<RecentResult> = {},
): RecentResult[] {
  return Array.from({ length: count }, (_, i) =>
    makeResult({ completedAt: Date.now() - i * 60000, ...overrides }),
  );
}

// --- computeTierScore ---

describe('computeTierScore', () => {
  it('returns 0.25 for empty results (prior)', () => {
    expect(computeTierScore([])).toBeCloseTo(0.25, 2);
  });

  it('damps toward 0.25 with few matches (3 wins)', () => {
    const results = makeResults(3, { result: 'win', opponentTier: 'intermediate' });
    const score = computeTierScore(results);
    // With 3 matches, dampingFactor = 3/15 = 0.2
    // rawScore = weightedWins / totalWeight. All wins, recency=1.0, tierMul=0.8
    // weightedWins = 3 * 1.0 * 0.8 = 2.4, totalWeight = 3 * 1.0 = 3.0
    // rawScore = 2.4 / 3.0 = 0.8
    // score = 0.25 + (0.8 - 0.25) * 0.2 = 0.25 + 0.11 = 0.36
    expect(score).toBeGreaterThan(0.25);
    expect(score).toBeLessThan(0.6);
  });

  it('converges to real score at 15+ matches', () => {
    const results = makeResults(15, { result: 'win', opponentTier: 'intermediate' });
    const score = computeTierScore(results);
    // dampingFactor = 1.0, rawScore = 0.8 (all wins * 0.8 multiplier)
    expect(score).toBeGreaterThan(0.7);
  });

  it('caps around intermediate for 100% wins vs beginners', () => {
    const results = makeResults(20, { result: 'win', opponentTier: 'beginner' });
    const score = computeTierScore(results);
    // beginner multiplier = 0.5, rawScore = 0.5
    expect(score).toBeLessThan(0.65);
  });

  it('rewards wins vs experts', () => {
    const vsBeginners = computeTierScore(
      makeResults(20, { result: 'win', opponentTier: 'beginner' }),
    );
    const vsExperts = computeTierScore(
      makeResults(20, { result: 'win', opponentTier: 'expert' }),
    );
    expect(vsExperts).toBeGreaterThan(vsBeginners);
  });

  it('weights recent matches more heavily', () => {
    // Same total wins/losses (10 each), but positioned differently
    const recentLosses: RecentResult[] = [
      ...makeResults(10, { result: 'loss' }),
      ...makeResults(10, { result: 'win', completedAt: Date.now() - 100000 }),
    ];
    const recentWins: RecentResult[] = [
      ...makeResults(10, { result: 'win' }),
      ...makeResults(10, { result: 'loss', completedAt: Date.now() - 100000 }),
    ];
    expect(computeTierScore(recentWins)).toBeGreaterThan(
      computeTierScore(recentLosses),
    );
  });

  it('handles all losses -> low score', () => {
    const results = makeResults(20, { result: 'loss' });
    const score = computeTierScore(results);
    expect(score).toBeLessThan(0.25);
  });

  it('returns clamped value between 0 and 1', () => {
    const allWins = makeResults(50, { result: 'win', opponentTier: 'expert' });
    const allLosses = makeResults(50, { result: 'loss', opponentTier: 'beginner' });
    expect(computeTierScore(allWins)).toBeLessThanOrEqual(1.0);
    expect(computeTierScore(allWins)).toBeGreaterThanOrEqual(0.0);
    expect(computeTierScore(allLosses)).toBeLessThanOrEqual(1.0);
    expect(computeTierScore(allLosses)).toBeGreaterThanOrEqual(0.0);
  });

  it('50% win rate vs mixed opponents -> mid range', () => {
    const results: RecentResult[] = [];
    for (let i = 0; i < 20; i++) {
      results.push(makeResult({
        result: i % 2 === 0 ? 'win' : 'loss',
        opponentTier: 'intermediate',
        completedAt: Date.now() - i * 60000,
      }));
    }
    const score = computeTierScore(results);
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.7);
  });

  it('closed friend group: 4 players trading wins converge to intermediate', () => {
    const results: RecentResult[] = [];
    for (let i = 0; i < 30; i++) {
      results.push(makeResult({
        result: i % 2 === 0 ? 'win' : 'loss',
        opponentTier: 'beginner',
        completedAt: Date.now() - i * 60000,
      }));
    }
    const score = computeTierScore(results);
    expect(score).toBeLessThan(0.53);
    expect(score).toBeGreaterThan(0.2);
  });
});

// --- computeTier ---

describe('computeTier', () => {
  it('returns beginner for score below 0.33', () => {
    expect(computeTier(0.2, 'beginner')).toBe('beginner');
  });

  it('promotes from beginner to intermediate at 0.33', () => {
    expect(computeTier(0.34, 'beginner')).toBe('intermediate');
  });

  it('promotes from intermediate to advanced at 0.53', () => {
    expect(computeTier(0.54, 'intermediate')).toBe('advanced');
  });

  it('promotes from advanced to expert at 0.73', () => {
    expect(computeTier(0.74, 'advanced')).toBe('expert');
  });

  it('demotes from intermediate to beginner below 0.27', () => {
    expect(computeTier(0.26, 'intermediate')).toBe('beginner');
  });

  it('demotes from advanced to intermediate below 0.47', () => {
    expect(computeTier(0.46, 'advanced')).toBe('intermediate');
  });

  it('demotes from expert to advanced below 0.67', () => {
    expect(computeTier(0.66, 'expert')).toBe('advanced');
  });

  // Hysteresis: stay at current tier in the gap between promote/demote
  it('stays intermediate at 0.30 (between demote 0.27 and promote 0.33)', () => {
    expect(computeTier(0.30, 'intermediate')).toBe('intermediate');
  });

  it('stays advanced at 0.50 (between demote 0.47 and promote 0.53)', () => {
    expect(computeTier(0.50, 'advanced')).toBe('advanced');
  });

  it('stays expert at 0.70 (between demote 0.67 and promote 0.73)', () => {
    expect(computeTier(0.70, 'expert')).toBe('expert');
  });

  it('defaults to beginner for first-time player', () => {
    expect(computeTier(0.25, 'beginner')).toBe('beginner');
  });

  // Exact boundary tests (thresholds use strict > and <)
  it('does not promote from beginner at exactly 0.33', () => {
    expect(computeTier(0.33, 'beginner')).toBe('beginner');
  });

  it('does not demote from intermediate at exactly 0.27', () => {
    expect(computeTier(0.27, 'intermediate')).toBe('intermediate');
  });

  it('does not promote from intermediate at exactly 0.53', () => {
    expect(computeTier(0.53, 'intermediate')).toBe('intermediate');
  });

  it('does not demote from expert at exactly 0.67', () => {
    expect(computeTier(0.67, 'expert')).toBe('expert');
  });

  // Multi-tier jumps (recursive)
  it('jumps from beginner to expert when score is very high', () => {
    expect(computeTier(0.80, 'beginner')).toBe('expert');
  });

  it('jumps from expert to beginner when score is very low', () => {
    expect(computeTier(0.10, 'expert')).toBe('beginner');
  });

  // Defensive guard
  it('returns beginner for invalid currentTier', () => {
    expect(computeTier(0.5, 'invalid' as any)).toBe('beginner');
  });
});

// --- computeTierConfidence ---

describe('computeTierConfidence', () => {
  it('returns low for fewer than 8 matches', () => {
    expect(computeTierConfidence(5, 2)).toBe('low');
  });

  it('returns low for 8 matches but only 2 unique opponents', () => {
    expect(computeTierConfidence(8, 2)).toBe('low');
  });

  it('returns medium for 8 matches and 3 unique opponents', () => {
    expect(computeTierConfidence(8, 3)).toBe('medium');
  });

  it('returns medium for 19 matches and 5 unique opponents', () => {
    expect(computeTierConfidence(19, 5)).toBe('medium');
  });

  it('returns high for 20 matches and 6 unique opponents', () => {
    expect(computeTierConfidence(20, 6)).toBe('high');
  });

  it('returns high for 50 matches and 10 unique opponents', () => {
    expect(computeTierConfidence(50, 10)).toBe('high');
  });

  it('returns low for 0 matches', () => {
    expect(computeTierConfidence(0, 0)).toBe('low');
  });
});
