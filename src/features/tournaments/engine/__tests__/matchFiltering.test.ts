import { describe, it, expect } from 'vitest';
import { getInProgressMatches } from '../matchFiltering';
import type { TournamentPool, BracketSlot } from '../../../../data/types';

function makePool(overrides: Partial<TournamentPool> = {}): TournamentPool {
  return {
    id: crypto.randomUUID(),
    tournamentId: 't1',
    name: 'Pool A',
    teamIds: [],
    schedule: [],
    standings: [],
    ...overrides,
  };
}

function makeBracketSlot(overrides: Partial<BracketSlot> = {}): BracketSlot {
  return {
    id: crypto.randomUUID(),
    tournamentId: 't1',
    round: 1,
    position: 1,
    team1Id: null,
    team2Id: null,
    matchId: null,
    winnerId: null,
    nextSlotId: null,
    ...overrides,
  };
}

describe('getInProgressMatches', () => {
  it('returns empty results for empty pools and bracket', () => {
    const result = getInProgressMatches([], []);
    expect(result.poolMatches).toEqual([]);
    expect(result.bracketMatches).toEqual([]);
  });

  it('finds pool match with matchId (in-progress)', () => {
    const pool = makePool({
      name: 'Pool A',
      schedule: [
        { round: 1, team1Id: 'ta', team2Id: 'tb', matchId: 'm1', court: 'Court 1' },
      ],
    });

    const result = getInProgressMatches([pool], []);

    expect(result.poolMatches).toHaveLength(1);
    expect(result.poolMatches[0]).toEqual({
      matchId: 'm1',
      team1Id: 'ta',
      team2Id: 'tb',
      court: 'Court 1',
      round: 1,
      poolName: 'Pool A',
      poolId: pool.id,
    });
  });

  it('excludes pool match without matchId (not started)', () => {
    const pool = makePool({
      schedule: [
        { round: 1, team1Id: 'ta', team2Id: 'tb', matchId: null, court: null },
      ],
    });

    const result = getInProgressMatches([pool], []);
    expect(result.poolMatches).toHaveLength(0);
  });

  it('finds bracket match with matchId but no winnerId (in-progress)', () => {
    const slot = makeBracketSlot({
      matchId: 'm2',
      team1Id: 'ta',
      team2Id: 'tb',
      winnerId: null,
      round: 2,
      position: 1,
    });

    const result = getInProgressMatches([], [slot]);

    expect(result.bracketMatches).toHaveLength(1);
    expect(result.bracketMatches[0]).toEqual({
      matchId: 'm2',
      team1Id: 'ta',
      team2Id: 'tb',
      round: 2,
      position: 1,
      slotId: slot.id,
    });
  });

  it('excludes bracket match with matchId AND winnerId (completed)', () => {
    const slot = makeBracketSlot({
      matchId: 'm3',
      team1Id: 'ta',
      team2Id: 'tb',
      winnerId: 'ta',
    });

    const result = getInProgressMatches([], [slot]);
    expect(result.bracketMatches).toHaveLength(0);
  });

  it('handles multiple pools with mixed states', () => {
    const poolA = makePool({
      name: 'Pool A',
      schedule: [
        { round: 1, team1Id: 'a1', team2Id: 'a2', matchId: 'm1', court: 'Court 1' },
        { round: 2, team1Id: 'a1', team2Id: 'a3', matchId: null, court: null },
      ],
    });
    const poolB = makePool({
      name: 'Pool B',
      schedule: [
        { round: 1, team1Id: 'b1', team2Id: 'b2', matchId: null, court: null },
        { round: 1, team1Id: 'b3', team2Id: 'b4', matchId: 'm4', court: 'Court 3' },
      ],
    });

    const bracketSlots: BracketSlot[] = [
      makeBracketSlot({ matchId: 'm5', team1Id: 'x', team2Id: 'y', winnerId: null }),
      makeBracketSlot({ matchId: 'm6', team1Id: 'p', team2Id: 'q', winnerId: 'p' }),
      makeBracketSlot({ matchId: null, team1Id: null, team2Id: null }),
    ];

    const result = getInProgressMatches([poolA, poolB], bracketSlots);

    expect(result.poolMatches).toHaveLength(2);
    expect(result.poolMatches.map((m) => m.matchId)).toEqual(['m1', 'm4']);

    expect(result.bracketMatches).toHaveLength(1);
    expect(result.bracketMatches[0].matchId).toBe('m5');
  });
});
