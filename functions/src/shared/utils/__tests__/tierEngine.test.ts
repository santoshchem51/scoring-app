import { describe, it, expect } from 'vitest';
import { computeTierScore, computeTier, computeTierConfidence, nearestTier, TIER_MULTIPLIER } from '../tierEngine';

describe('tierEngine (shared)', () => {
  it('returns prior score for empty results', () => {
    expect(computeTierScore([])).toBe(0.25);
  });

  it('computes tier from score with hysteresis', () => {
    expect(computeTier(0.35, 'beginner')).toBe('intermediate');
    expect(computeTier(0.30, 'intermediate')).toBe('intermediate'); // hysteresis gap
    expect(computeTier(0.26, 'intermediate')).toBe('beginner');
  });

  it('computes confidence from match count and opponents', () => {
    expect(computeTierConfidence(5, 2)).toBe('low');
    expect(computeTierConfidence(8, 3)).toBe('medium');
    expect(computeTierConfidence(20, 6)).toBe('high');
  });

  it('nearestTier maps multiplier to closest tier', () => {
    expect(nearestTier(0.5)).toBe('beginner');
    expect(nearestTier(1.0)).toBe('advanced');
    expect(nearestTier(1.3)).toBe('expert');
  });

  it('TIER_MULTIPLIER has all four tiers', () => {
    expect(Object.keys(TIER_MULTIPLIER)).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
  });
});
