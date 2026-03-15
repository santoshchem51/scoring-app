import { describe, it, expect } from 'vitest';
import { extractLiveScore, extractGameCount } from '../scoreExtraction';
import type { Match, MatchConfig, GameResult } from '../../../../data/types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  const defaultConfig: MatchConfig = {
    gameType: 'doubles',
    scoringMode: 'rally',
    matchFormat: 'best-of-3',
    pointsToWin: 11,
  };
  return {
    id: 'test-match-1',
    config: defaultConfig,
    team1PlayerIds: ['p1'],
    team2PlayerIds: ['p2'],
    team1Name: 'Team A',
    team2Name: 'Team B',
    games: [],
    winningSide: null,
    status: 'in-progress',
    startedAt: Date.now(),
    completedAt: null,
    ...overrides,
  };
}

function makeGame(overrides: Partial<GameResult> = {}): GameResult {
  return {
    gameNumber: 1,
    team1Score: 0,
    team2Score: 0,
    winningSide: 1,
    ...overrides,
  };
}

describe('extractLiveScore', () => {
  it('returns 0-0 for undefined match', () => {
    expect(extractLiveScore(undefined)).toEqual({ team1Score: 0, team2Score: 0 });
  });

  it('parses lastSnapshot JSON for in-progress match', () => {
    const m = makeMatch({
      status: 'in-progress',
      lastSnapshot: JSON.stringify({ team1Score: 7, team2Score: 3 }),
    });
    expect(extractLiveScore(m)).toEqual({ team1Score: 7, team2Score: 3 });
  });

  it('parses lastSnapshot object for in-progress match', () => {
    const m = makeMatch({
      status: 'in-progress',
      lastSnapshot: { team1Score: 5, team2Score: 9 } as unknown as string,
    });
    expect(extractLiveScore(m)).toEqual({ team1Score: 5, team2Score: 9 });
  });

  it('falls back to last game when no snapshot', () => {
    const m = makeMatch({
      status: 'completed',
      games: [
        makeGame({ gameNumber: 1, team1Score: 11, team2Score: 8, winningSide: 1 }),
        makeGame({ gameNumber: 2, team1Score: 9, team2Score: 11, winningSide: 2 }),
      ],
    });
    expect(extractLiveScore(m)).toEqual({ team1Score: 9, team2Score: 11 });
  });

  it('handles malformed JSON gracefully', () => {
    const m = makeMatch({
      status: 'in-progress',
      lastSnapshot: '{bad json!!!',
      games: [
        makeGame({ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }),
      ],
    });
    expect(extractLiveScore(m)).toEqual({ team1Score: 11, team2Score: 5 });
  });

  it('returns 0-0 for match with no games and no snapshot', () => {
    const m = makeMatch({ status: 'in-progress', games: [] });
    expect(extractLiveScore(m)).toEqual({ team1Score: 0, team2Score: 0 });
  });
});

describe('extractGameCount', () => {
  it('returns 0-0 for undefined match', () => {
    expect(extractGameCount(undefined)).toEqual({ team1Wins: 0, team2Wins: 0 });
  });

  it('returns 0-0 for match with no games', () => {
    const m = makeMatch({ games: [] });
    expect(extractGameCount(m)).toEqual({ team1Wins: 0, team2Wins: 0 });
  });

  it('counts wins correctly', () => {
    const m = makeMatch({
      games: [
        makeGame({ gameNumber: 1, team1Score: 11, team2Score: 8, winningSide: 1 }),
        makeGame({ gameNumber: 2, team1Score: 9, team2Score: 11, winningSide: 2 }),
        makeGame({ gameNumber: 3, team1Score: 11, team2Score: 6, winningSide: 1 }),
      ],
    });
    expect(extractGameCount(m)).toEqual({ team1Wins: 2, team2Wins: 1 });
  });
});
