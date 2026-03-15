import type { Match } from '../../../data/types';

export interface LiveScore {
  team1Score: number;
  team2Score: number;
}

export interface GameCount {
  team1: number;
  team2: number;
}

const ZERO_SCORE: LiveScore = { team1Score: 0, team2Score: 0 };
const ZERO_COUNT: GameCount = { team1: 0, team2: 0 };

export function extractLiveScore(match: Match | undefined | null): LiveScore {
  if (!match) return ZERO_SCORE;

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

  return ZERO_SCORE;
}

export function extractGameCount(match: Match | undefined | null): GameCount {
  if (!match) return ZERO_COUNT;

  let t1 = 0;
  let t2 = 0;
  for (const g of match.games) {
    if (g.winningSide === 1) t1++;
    else if (g.winningSide === 2) t2++;
  }
  return { team1: t1, team2: t2 };
}
