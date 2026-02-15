import type { Match, PoolStanding } from '../../../data/types';

/**
 * Calculate pool standings from completed matches.
 * teamIds map to match.team1Name / match.team2Name.
 * Sorts by wins (desc), then point differential (desc).
 */
export function calculateStandings(teamIds: string[], matches: Match[]): PoolStanding[] {
  const standings: PoolStanding[] = teamIds.map((teamId) => {
    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    const completedMatches = matches.filter((m) => m.status === 'completed');

    for (const match of completedMatches) {
      const isTeam1 = match.team1Name === teamId;
      const isTeam2 = match.team2Name === teamId;

      if (!isTeam1 && !isTeam2) continue;

      for (const game of match.games) {
        if (isTeam1) {
          pointsFor += game.team1Score;
          pointsAgainst += game.team2Score;
        } else {
          pointsFor += game.team2Score;
          pointsAgainst += game.team1Score;
        }
      }

      if (isTeam1 && match.winningSide === 1) wins++;
      else if (isTeam2 && match.winningSide === 2) wins++;
      else losses++;
    }

    return {
      teamId,
      wins,
      losses,
      pointsFor,
      pointsAgainst,
      pointDiff: pointsFor - pointsAgainst,
    };
  });

  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointDiff - a.pointDiff;
  });

  return standings;
}
