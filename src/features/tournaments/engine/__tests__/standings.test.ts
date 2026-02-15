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

describe('calculateStandings', () => {
  it('returns empty standings for no matches', () => {
    const standings = calculateStandings(['A', 'B'], []);
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
    const standings = calculateStandings(['A', 'B'], matches);
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
    const standings = calculateStandings(['A', 'B'], matches);
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
    const standings = calculateStandings(['A', 'B', 'C'], matches);
    expect(standings[0].teamId).toBe('C');
    expect(standings[1].teamId).toBe('A');
    expect(standings[2].teamId).toBe('B');
  });
});
