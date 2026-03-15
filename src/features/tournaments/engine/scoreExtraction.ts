import type { Match } from '../../../data/types';

export interface LiveScore {
  team1Score: number;
  team2Score: number;
}

export interface GameCount {
  team1Wins: number;
  team2Wins: number;
}

export function extractLiveScore(match: Match | undefined | null): LiveScore {
  if (!match) return { team1Score: 0, team2Score: 0 };

  if (match.lastSnapshot && match.status === 'in-progress') {
    try {
      const snap = typeof match.lastSnapshot === 'string'
        ? JSON.parse(match.lastSnapshot)
        : match.lastSnapshot;
      return { team1Score: snap.team1Score ?? 0, team2Score: snap.team2Score ?? 0 };
    } catch { /* fall through */ }
  }

  if (match.games.length > 0) {
    const last = match.games[match.games.length - 1];
    return { team1Score: last.team1Score, team2Score: last.team2Score };
  }

  return { team1Score: 0, team2Score: 0 };
}

export function extractGameCount(match: Match | undefined | null): GameCount {
  if (!match) return { team1Wins: 0, team2Wins: 0 };

  let t1 = 0;
  let t2 = 0;
  for (const g of match.games) {
    if (g.winningSide === 1) t1++;
    else if (g.winningSide === 2) t2++;
  }
  return { team1Wins: t1, team2Wins: t2 };
}
