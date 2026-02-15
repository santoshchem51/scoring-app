import type { PoolStanding } from '../../../data/types';

/**
 * Seed bracket teams from pool standings using cross-pool seeding.
 * Takes top N teams from each pool, then interleaves:
 * All #1 seeds (sorted by record), all #2 seeds, etc.
 */
export function seedBracketFromPools(
  poolStandings: PoolStanding[][],
  teamsPerPoolAdvancing: number,
): string[] {
  if (poolStandings.length === 0) return [];

  const seeded: string[] = [];

  for (let rank = 0; rank < teamsPerPoolAdvancing; rank++) {
    const teamsAtRank: PoolStanding[] = [];
    for (const pool of poolStandings) {
      if (rank < pool.length) {
        teamsAtRank.push(pool[rank]);
      }
    }
    teamsAtRank.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointDiff - a.pointDiff;
    });
    seeded.push(...teamsAtRank.map((s) => s.teamId));
  }

  return seeded;
}
