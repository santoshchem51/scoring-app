export type ScoringMode = 'sideout' | 'rally';
export type MatchFormat = 'single' | 'best-of-3' | 'best-of-5';
export type GameType = 'singles' | 'doubles';

export interface ScoringContext {
  config: {
    gameType: GameType;
    scoringMode: ScoringMode;
    matchFormat: MatchFormat;
    pointsToWin: number;
  };
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  gameNumber: number;
  gamesWon: [number, number];
  gamesToWin: number;
  history: ScoringSnapshot[];
}

export interface ScoringSnapshot {
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  gameNumber: number;
  gamesWon: [number, number];
}

export type ScoringEvent =
  | { type: 'START_GAME' }
  | { type: 'SCORE_POINT'; team: 1 | 2 }
  | { type: 'SIDE_OUT' }
  | { type: 'UNDO' }
  | { type: 'START_NEXT_GAME' }
  | { type: 'RESUME'; snapshot: ScoringSnapshot & { gamesWon: [number, number]; gameNumber: number; config: ScoringContext['config']; gamesToWin: number } };
