import { describe, it, expect } from 'vitest';
import { seedBracketFromPools } from '../bracketSeeding';
import type { PoolStanding } from '../../../../data/types';

function standing(teamId: string, wins: number, pointDiff: number): PoolStanding {
  return { teamId, wins, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff };
}

describe('seedBracketFromPools', () => {
  it('cross-seeds 2 pools, top 2 advancing', () => {
    const poolStandings = [
      [standing('A1', 3, 10), standing('A2', 2, 5), standing('A3', 1, -5)],
      [standing('B1', 3, 8), standing('B2', 2, 3), standing('B3', 0, -11)],
    ];
    const seeded = seedBracketFromPools(poolStandings, 2);
    expect(seeded).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('handles 3 pools, top 1 advancing', () => {
    const poolStandings = [
      [standing('A1', 2, 10), standing('A2', 1, 5)],
      [standing('B1', 2, 6), standing('B2', 1, 2)],
      [standing('C1', 2, 8), standing('C2', 1, -1)],
    ];
    const seeded = seedBracketFromPools(poolStandings, 1);
    expect(seeded).toEqual(['A1', 'C1', 'B1']);
  });

  it('returns empty for empty pools', () => {
    expect(seedBracketFromPools([], 2)).toEqual([]);
  });

  it('handles unequal pool sizes (4 vs 3 teams, top 2 advancing)', () => {
    const poolStandings = [
      [standing('A1', 3, 12), standing('A2', 2, 6), standing('A3', 1, -2), standing('A4', 0, -16)],
      [standing('B1', 2, 8), standing('B2', 1, 1), standing('B3', 0, -9)],
    ];
    const seeded = seedBracketFromPools(poolStandings, 2);
    // Rank 0: A1 (3W, +12) before B1 (2W, +8)
    // Rank 1: A2 (2W, +6) before B2 (1W, +1)
    expect(seeded).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('handles single pool advancing to bracket', () => {
    const poolStandings = [
      [standing('X1', 3, 15), standing('X2', 2, 5), standing('X3', 1, -5), standing('X4', 0, -15)],
    ];
    const seeded = seedBracketFromPools(poolStandings, 3);
    // All 3 come from the same pool, in their standing order
    expect(seeded).toEqual(['X1', 'X2', 'X3']);
  });

  it('orders by point differential when all teams are tied on wins', () => {
    const poolStandings = [
      [standing('A1', 1, 5), standing('A2', 1, 2)],
      [standing('B1', 1, 3), standing('B2', 1, -1)],
    ];
    const seeded = seedBracketFromPools(poolStandings, 2);
    // Rank 0: A1 (1W, +5) and B1 (1W, +3) -> sorted by pointDiff: A1, B1
    // Rank 1: A2 (1W, +2) and B2 (1W, -1) -> sorted by pointDiff: A2, B2
    expect(seeded).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
});
