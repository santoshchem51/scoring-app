import type { GameResult, BracketSlot } from '../../../data/types';

/**
 * Derive the match winner from game results.
 * Returns 1 if team1 wins majority of games, 2 if team2, null if no games.
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateGameScores(games: GameResult[]): ValidationResult {
  if (games.length === 0) {
    return { valid: false, message: 'At least one game is required.' };
  }

  for (const g of games) {
    if (g.team1Score === g.team2Score) {
      return { valid: false, message: `Game ${g.gameNumber}: scores cannot be tied.` };
    }
  }

  return { valid: true };
}

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

export interface BracketSafetyResult {
  safe: boolean;
  message?: string;
}

export function checkBracketRescoreSafety(
  currentSlot: BracketSlot,
  newWinnerTeamId: string,
  allSlots: BracketSlot[],
): BracketSafetyResult {
  if (currentSlot.winnerId === newWinnerTeamId) {
    return { safe: true };
  }

  if (!currentSlot.nextSlotId) {
    return { safe: true };
  }

  const nextSlot = allSlots.find((s) => s.id === currentSlot.nextSlotId);
  if (!nextSlot) {
    return { safe: true };
  }

  if (nextSlot.matchId) {
    return { safe: false, message: 'Cannot change winner — the next round match has already started.' };
  }

  return { safe: true };
}
