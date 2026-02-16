import type { GameResult } from '../../../data/types';

/**
 * Derive the match winner from game results.
 * Returns 1 if team1 wins majority of games, 2 if team2, null if no games.
 */
export function deriveWinnerFromGames(games: GameResult[]): 1 | 2 | null {
  if (games.length === 0) return null;

  let team1Wins = 0;
  let team2Wins = 0;

  for (const g of games) {
    if (g.team1Score > g.team2Score) team1Wins++;
    else team2Wins++;
  }

  return team1Wins > team2Wins ? 1 : 2;
}
