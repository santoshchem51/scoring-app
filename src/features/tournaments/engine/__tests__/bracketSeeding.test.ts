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
});
