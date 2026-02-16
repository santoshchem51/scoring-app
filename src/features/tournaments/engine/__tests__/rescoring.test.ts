import { describe, it, expect } from 'vitest';
import { deriveWinnerFromGames } from '../rescoring';
import type { GameResult } from '../../../../data/types';

function game(team1Score: number, team2Score: number, gameNumber: number): GameResult {
  return {
    gameNumber,
    team1Score,
    team2Score,
    winningSide: team1Score > team2Score ? 1 : 2,
  };
}

describe('deriveWinnerFromGames', () => {
  it('returns side 1 when team1 wins single game', () => {
    const games = [game(11, 5, 1)];
    expect(deriveWinnerFromGames(games)).toBe(1);
  });

  it('returns side 2 when team2 wins single game', () => {
    const games = [game(5, 11, 1)];
    expect(deriveWinnerFromGames(games)).toBe(2);
  });

  it('returns side 1 when team1 wins 2-1 in best-of-3', () => {
    const games = [game(11, 7, 1), game(5, 11, 2), game(11, 9, 3)];
    expect(deriveWinnerFromGames(games)).toBe(1);
  });

  it('returns side 2 when team2 wins 2-0 in best-of-3', () => {
    const games = [game(5, 11, 1), game(8, 11, 2)];
    expect(deriveWinnerFromGames(games)).toBe(2);
  });

  it('returns side 1 when team1 wins 3-2 in best-of-5', () => {
    const games = [
      game(11, 5, 1), game(5, 11, 2), game(11, 9, 3),
      game(7, 11, 4), game(11, 8, 5),
    ];
    expect(deriveWinnerFromGames(games)).toBe(1);
  });

  it('returns null for empty games array', () => {
    expect(deriveWinnerFromGames([])).toBeNull();
  });
});
