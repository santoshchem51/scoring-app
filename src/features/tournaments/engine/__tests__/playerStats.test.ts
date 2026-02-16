import { describe, it, expect } from 'vitest';
import { getPlayerTeamId, getPlayerMatches, getPlayerStats } from '../playerStats';
import type { TournamentRegistration, TournamentTeam, TournamentPool, BracketSlot, PoolStanding } from '../../../../data/types';

const makeReg = (userId: string, teamId: string | null = null): TournamentRegistration => ({
  id: `reg-${userId}`,
  tournamentId: 't1',
  userId,
  playerName: userId,
  teamId,
  paymentStatus: 'unpaid',
  paymentNote: '',
  lateEntry: false,
  skillRating: null,
  partnerId: null,
  partnerName: null,
  profileComplete: false,
  registeredAt: Date.now(),
});

const makeTeam = (id: string, playerIds: string[]): TournamentTeam => ({
  id,
  tournamentId: 't1',
  name: `Team ${id}`,
  playerIds,
  seed: null,
  poolId: null,
});

const makePool = (teamIds: string[], standings: PoolStanding[], schedule: { team1Id: string; team2Id: string; matchId: string | null }[]): TournamentPool => ({
  id: 'pool-1',
  tournamentId: 't1',
  name: 'Pool A',
  teamIds,
  standings,
  schedule: schedule.map((s, i) => ({ round: i + 1, ...s, court: null })),
});

const makeSlot = (id: string, round: number, position: number, team1Id: string | null, team2Id: string | null, winnerId: string | null = null, matchId: string | null = null): BracketSlot => ({
  id,
  tournamentId: 't1',
  round,
  position,
  team1Id,
  team2Id,
  winnerId,
  matchId,
  nextSlotId: null,
});

describe('getPlayerTeamId', () => {
  it('returns teamId from registration', () => {
    const regs = [makeReg('u1', 'team-a')];
    const teams = [makeTeam('team-a', ['u1'])];
    expect(getPlayerTeamId('u1', regs, teams)).toBe('team-a');
  });

  it('finds teamId from team playerIds when registration has no teamId', () => {
    const regs = [makeReg('u1')];
    const teams = [makeTeam('team-a', ['u1', 'u2'])];
    expect(getPlayerTeamId('u1', regs, teams)).toBe('team-a');
  });

  it('returns null when player has no team', () => {
    const regs = [makeReg('u1')];
    expect(getPlayerTeamId('u1', regs, [])).toBeNull();
  });
});

describe('getPlayerMatches', () => {
  it('returns pool matches for the player team', () => {
    const pool = makePool(
      ['team-a', 'team-b', 'team-c'],
      [],
      [
        { team1Id: 'team-a', team2Id: 'team-b', matchId: 'm1' },
        { team1Id: 'team-a', team2Id: 'team-c', matchId: null },
        { team1Id: 'team-b', team2Id: 'team-c', matchId: null },
      ],
    );
    const teamNames: Record<string, string> = { 'team-a': 'Alice', 'team-b': 'Bob', 'team-c': 'Charlie' };
    const result = getPlayerMatches('team-a', [pool], [], teamNames);
    expect(result).toHaveLength(2);
    expect(result[0].opponentName).toBe('Bob');
    expect(result[0].matchId).toBe('m1');
    expect(result[1].opponentName).toBe('Charlie');
    expect(result[1].matchId).toBeNull();
  });

  it('returns bracket matches for the player team', () => {
    const slots = [
      makeSlot('s1', 1, 1, 'team-a', 'team-b', 'team-a', 'm1'),
      makeSlot('s2', 1, 2, 'team-c', 'team-d', 'team-c', 'm2'),
      makeSlot('s3', 2, 1, 'team-a', 'team-c', null, null),
    ];
    const teamNames: Record<string, string> = { 'team-a': 'Alice', 'team-b': 'Bob', 'team-c': 'Charlie', 'team-d': 'Diana' };
    const result = getPlayerMatches('team-a', [], slots, teamNames);
    expect(result).toHaveLength(2);
    expect(result[0].opponentName).toBe('Bob');
    expect(result[0].status).toBe('completed');
    expect(result[0].won).toBe(true);
    expect(result[1].opponentName).toBe('Charlie');
    expect(result[1].status).toBe('upcoming');
  });

  it('detects in-progress bracket match', () => {
    const slots = [makeSlot('s1', 1, 1, 'team-a', 'team-b', null, 'm1')];
    const teamNames: Record<string, string> = { 'team-a': 'Alice', 'team-b': 'Bob' };
    const result = getPlayerMatches('team-a', [], slots, teamNames);
    expect(result[0].status).toBe('in-progress');
    expect(result[0].matchId).toBe('m1');
  });

  it('returns empty when team not in any matches', () => {
    const result = getPlayerMatches('team-x', [], [], {});
    expect(result).toHaveLength(0);
  });
});

describe('getPlayerStats', () => {
  it('returns stats from pool standings', () => {
    const standings: PoolStanding[] = [
      { teamId: 'team-a', wins: 2, losses: 1, pointsFor: 33, pointsAgainst: 25, pointDiff: 8 },
      { teamId: 'team-b', wins: 1, losses: 2, pointsFor: 25, pointsAgainst: 33, pointDiff: -8 },
    ];
    const pool = makePool(['team-a', 'team-b'], standings, []);
    const result = getPlayerStats('team-a', [pool], []);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.pointsFor).toBe(33);
    expect(result.pointsAgainst).toBe(25);
    expect(result.pointDiff).toBe(8);
  });

  it('adds bracket wins and losses', () => {
    const slots = [
      makeSlot('s1', 1, 1, 'team-a', 'team-b', 'team-a', 'm1'),
      makeSlot('s2', 2, 1, 'team-a', 'team-c', 'team-c', 'm2'),
    ];
    const result = getPlayerStats('team-a', [], slots);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
  });

  it('combines pool and bracket stats', () => {
    const standings: PoolStanding[] = [
      { teamId: 'team-a', wins: 2, losses: 0, pointsFor: 22, pointsAgainst: 10, pointDiff: 12 },
    ];
    const pool = makePool(['team-a', 'team-b'], standings, []);
    const slots = [makeSlot('s1', 1, 1, 'team-a', 'team-b', 'team-a', 'm1')];
    const result = getPlayerStats('team-a', [pool], slots);
    expect(result.wins).toBe(3);
    expect(result.losses).toBe(0);
    expect(result.pointsFor).toBe(22);
  });

  it('returns zeroes when team has no matches', () => {
    const result = getPlayerStats('team-x', [], []);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.pointsFor).toBe(0);
  });
});
