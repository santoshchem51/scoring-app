import { describe, it, expect } from 'vitest';
import { deriveWinnerFromGames, validateGameScores, checkBracketRescoreSafety } from '../rescoring';
import type { GameResult, BracketSlot } from '../../../../data/types';

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

describe('validateGameScores', () => {
  it('returns valid for correct single game scores', () => {
    const result = validateGameScores([game(11, 5, 1)]);
    expect(result).toEqual({ valid: true });
  });

  it('returns invalid when a game has a tie', () => {
    const tiedGame: GameResult = { gameNumber: 1, team1Score: 8, team2Score: 8, winningSide: 1 };
    const result = validateGameScores([tiedGame]);
    expect(result).toEqual({ valid: false, message: 'Game 1: scores cannot be tied.' });
  });

  it('returns invalid for empty games array', () => {
    const result = validateGameScores([]);
    expect(result).toEqual({ valid: false, message: 'At least one game is required.' });
  });

  it('returns valid for best-of-3 with 2 games (sweep)', () => {
    const result = validateGameScores([game(11, 5, 1), game(11, 7, 2)]);
    expect(result).toEqual({ valid: true });
  });

  it('returns valid for best-of-3 with 3 games', () => {
    const result = validateGameScores([game(11, 5, 1), game(5, 11, 2), game(11, 9, 3)]);
    expect(result).toEqual({ valid: true });
  });
});

function slot(overrides: Partial<BracketSlot>): BracketSlot {
  return {
    id: 'slot-1',
    tournamentId: 't1',
    round: 1,
    position: 0,
    team1Id: null,
    team2Id: null,
    matchId: null,
    winnerId: null,
    nextSlotId: null,
    ...overrides,
  };
}

describe('checkBracketRescoreSafety', () => {
  it('returns safe when winner stays the same', () => {
    const current = slot({ id: 's1', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2 });
    const result = checkBracketRescoreSafety(current, 'A', [current, final]);
    expect(result).toEqual({ safe: true });
  });

  it('returns safe when winner changes but next match has no matchId', () => {
    const current = slot({ id: 's1', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2, matchId: null });
    const result = checkBracketRescoreSafety(current, 'B', [current, final]);
    expect(result).toEqual({ safe: true });
  });

  it('returns unsafe when winner changes and next match has started', () => {
    const current = slot({ id: 's1', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2, matchId: 'match-final' });
    const result = checkBracketRescoreSafety(current, 'B', [current, final]);
    expect(result).toEqual({ safe: false, message: 'Cannot change winner — the next round match has already started.' });
  });

  it('returns safe for finals (no next slot) regardless of winner change', () => {
    const final = slot({ id: 'final', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: null });
    const result = checkBracketRescoreSafety(final, 'B', [final]);
    expect(result).toEqual({ safe: true });
  });

  it('returns safe when winner changes and next slot not found in array', () => {
    const current = slot({ id: 's1', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: 'missing' });
    const result = checkBracketRescoreSafety(current, 'B', [current]);
    expect(result).toEqual({ safe: true });
  });
});
