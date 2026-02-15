import type { Match, PoolStanding } from '../../../data/types';

/**
 * Calculate pool standings from completed matches.
 * teamIds must match the values returned by getTeamIds.
 * Sorts by wins (desc), then point differential (desc).
 */
export function calculateStandings(
  teamIds: string[],
  matches: Match[],
  getTeamIds: (match: Match) => { team1: string; team2: string },
): PoolStanding[] {
  const standings: PoolStanding[] = teamIds.map((teamId) => {
    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    const completedMatches = matches.filter((m) => m.status === 'completed');

    for (const match of completedMatches) {
      const ids = getTeamIds(match);
      const isTeam1 = ids.team1 === teamId;
      const isTeam2 = ids.team2 === teamId;

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
