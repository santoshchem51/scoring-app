import { describe, it, expect } from 'vitest';
import { calculateStandings } from '../standings';
import type { Match } from '../../../../data/types';

function makeMatch(overrides: Partial<Match> & { team1Name: string; team2Name: string }): Match {
  return {
    id: crypto.randomUUID(),
    config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Color: undefined,
    team2Color: undefined,
    games: [],
    winningSide: null,
    status: 'completed',
    startedAt: Date.now(),
    completedAt: Date.now(),
    ...overrides,
  };
}

const byName = (m: Match) => ({ team1: m.team1Name, team2: m.team2Name });

describe('calculateStandings', () => {
  it('returns empty standings for no matches', () => {
    const standings = calculateStandings(['A', 'B'], [], byName);
    expect(standings).toHaveLength(2);
    expect(standings[0].wins).toBe(0);
    expect(standings[0].losses).toBe(0);
  });

  it('calculates wins and losses correctly', () => {
    const matches: Match[] = [
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1,
      }),
    ];
    const standings = calculateStandings(['A', 'B'], matches, byName);
    const teamA = standings.find((s) => s.teamId === 'A');
    const teamB = standings.find((s) => s.teamId === 'B');
    expect(teamA?.wins).toBe(1);
    expect(teamA?.losses).toBe(0);
    expect(teamB?.wins).toBe(0);
    expect(teamB?.losses).toBe(1);
  });

  it('calculates point differential', () => {
    const matches: Match[] = [
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 7, winningSide: 1 }],
        winningSide: 1,
      }),
    ];
    const standings = calculateStandings(['A', 'B'], matches, byName);
    const teamA = standings.find((s) => s.teamId === 'A');
    expect(teamA?.pointsFor).toBe(11);
    expect(teamA?.pointsAgainst).toBe(7);
    expect(teamA?.pointDiff).toBe(4);
  });

  it('sorts by wins first, then point diff', () => {
    const matches: Match[] = [
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 9, winningSide: 1 }],
        winningSide: 1,
      }),
      makeMatch({
        team1Name: 'C', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 3, winningSide: 1 }],
        winningSide: 1,
      }),
    ];
    const standings = calculateStandings(['A', 'B', 'C'], matches, byName);
    expect(standings[0].teamId).toBe('C');
    expect(standings[1].teamId).toBe('A');
    expect(standings[2].teamId).toBe('B');
  });

  it('accumulates points across multiple games in a match', () => {
    const matches: Match[] = [
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [
          { gameNumber: 1, team1Score: 11, team2Score: 8, winningSide: 1 },
          { gameNumber: 2, team1Score: 9, team2Score: 11, winningSide: 2 },
          { gameNumber: 3, team1Score: 11, team2Score: 6, winningSide: 1 },
        ],
        winningSide: 1,
      }),
    ];
    const standings = calculateStandings(['A', 'B'], matches, byName);
    const teamA = standings.find((s) => s.teamId === 'A')!;
    const teamB = standings.find((s) => s.teamId === 'B')!;
    // A scored: 11 + 9 + 11 = 31, conceded: 8 + 11 + 6 = 25
    expect(teamA.pointsFor).toBe(31);
    expect(teamA.pointsAgainst).toBe(25);
    expect(teamA.pointDiff).toBe(6);
    // B scored: 8 + 11 + 6 = 25, conceded: 11 + 9 + 11 = 31
    expect(teamB.pointsFor).toBe(25);
    expect(teamB.pointsAgainst).toBe(31);
    expect(teamB.pointDiff).toBe(-6);
  });

  it('breaks ties by point differential when wins are equal', () => {
    const matches: Match[] = [
      // A beats C by a large margin
      makeMatch({
        team1Name: 'A', team2Name: 'C',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 2, winningSide: 1 }],
        winningSide: 1,
      }),
      // B beats C by a small margin
      makeMatch({
        team1Name: 'B', team2Name: 'C',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 9, winningSide: 1 }],
        winningSide: 1,
      }),
    ];
    const standings = calculateStandings(['A', 'B', 'C'], matches, byName);
    // A and B both have 1 win, but A has higher point diff (+9 vs +2)
    expect(standings[0].teamId).toBe('A');
    expect(standings[1].teamId).toBe('B');
    expect(standings[0].wins).toBe(1);
    expect(standings[1].wins).toBe(1);
    expect(standings[0].pointDiff).toBeGreaterThan(standings[1].pointDiff);
  });

  it('uses custom getTeamIds when provided', () => {
    const teamIds = ['team-1', 'team-2'];
    const matches: Match[] = [
      {
        id: 'm1',
        config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: ['p1', 'p2'],
        team2PlayerIds: ['p3', 'p4'],
        team1Name: 'Alpha',
        team2Name: 'Beta',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1,
        status: 'completed',
        startedAt: 1000,
        completedAt: 2000,
      } as Match,
    ];

    const getTeamIds = () => ({ team1: 'team-1', team2: 'team-2' });
    const standings = calculateStandings(teamIds, matches, getTeamIds);

    expect(standings[0].teamId).toBe('team-1');
    expect(standings[0].wins).toBe(1);
    expect(standings[0].losses).toBe(0);
    expect(standings[1].teamId).toBe('team-2');
    expect(standings[1].wins).toBe(0);
    expect(standings[1].losses).toBe(1);
  });

  it('excludes in-progress matches from standings', () => {
    const matches: Match[] = [
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1,
        status: 'completed',
      }),
      makeMatch({
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 7, team2Score: 3, winningSide: 1 }],
        winningSide: null,
        status: 'in-progress',
      }),
    ];
    const standings = calculateStandings(['A', 'B'], matches, byName);
    const teamA = standings.find((s) => s.teamId === 'A')!;
    // Only the completed match should count
    expect(teamA.wins).toBe(1);
    expect(teamA.pointsFor).toBe(11);
    expect(teamA.pointsAgainst).toBe(5);
  });
});
