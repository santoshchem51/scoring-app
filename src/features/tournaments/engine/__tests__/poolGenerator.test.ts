import { describe, it, expect } from 'vitest';
import { generatePools } from '../poolGenerator';

describe('generatePools', () => {
  it('distributes 8 teams into 2 pools of 4', () => {
    const teams = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
    const pools = generatePools(teams, 2);
    expect(pools).toHaveLength(2);
    expect(pools[0]).toHaveLength(4);
    expect(pools[1]).toHaveLength(4);
  });

  it('uses snake-draft order (seeds balanced)', () => {
    const teams = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
    const pools = generatePools(teams, 2);
    expect(pools[0]).toEqual(['S1', 'S4', 'S5', 'S8']);
    expect(pools[1]).toEqual(['S2', 'S3', 'S6', 'S7']);
  });

  it('handles uneven distribution (5 teams, 2 pools)', () => {
    const teams = ['A', 'B', 'C', 'D', 'E'];
    const pools = generatePools(teams, 2);
    expect(pools).toHaveLength(2);
    const sizes = pools.map((p) => p.length).sort();
    expect(sizes).toEqual([2, 3]);
  });

  it('handles 4 teams, 2 pools', () => {
    const pools = generatePools(['A', 'B', 'C', 'D'], 2);
    expect(pools[0]).toEqual(['A', 'D']);
    expect(pools[1]).toEqual(['B', 'C']);
  });

  it('single pool returns all teams', () => {
    const pools = generatePools(['A', 'B', 'C'], 1);
    expect(pools).toHaveLength(1);
    expect(pools[0]).toEqual(['A', 'B', 'C']);
  });

  it('every team appears exactly once', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const pools = generatePools(teams, 3);
    const allTeams = pools.flat();
    expect(allTeams.sort()).toEqual([...teams].sort());
  });

  it('returns empty pools for 0 teams', () => {
    const pools = generatePools([], 2);
    expect(pools).toHaveLength(2);
    expect(pools[0]).toEqual([]);
    expect(pools[1]).toEqual([]);
  });

  it('handles poolCount greater than teamCount (some pools empty)', () => {
    const pools = generatePools(['A'], 3);
    expect(pools).toHaveLength(3);
    const allTeams = pools.flat();
    expect(allTeams).toEqual(['A']);
    // At least some pools should be empty
    const emptyPools = pools.filter((p) => p.length === 0);
    expect(emptyPools.length).toBe(2);
  });
});
