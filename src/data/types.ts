export type ScoringMode = 'sideout' | 'rally';
export type MatchFormat = 'single' | 'best-of-3' | 'best-of-5';
export type MatchStatus = 'in-progress' | 'completed' | 'abandoned';
export type GameType = 'singles' | 'doubles';

export interface Player {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface MatchConfig {
  gameType: GameType;
  scoringMode: ScoringMode;
  matchFormat: MatchFormat;
  pointsToWin: 11 | 15 | 21;
}

export interface GameResult {
  gameNumber: number;
  team1Score: number;
  team2Score: number;
  winningSide: 1 | 2;
}

export interface Match {
  id: string;
  config: MatchConfig;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  team1Name: string;
  team2Name: string;
  team1Color?: string;   // hex color, e.g., '#22c55e'
  team2Color?: string;   // hex color, e.g., '#f97316'
  games: GameResult[];
  winningSide: 1 | 2 | null;
  status: MatchStatus;
  startedAt: number;
  completedAt: number | null;
  lastSnapshot?: string | null;
}

export interface ScoreEvent {
  id: string;
  matchId: string;
  gameNumber: number;
  timestamp: number;
  type: 'POINT_SCORED' | 'SIDE_OUT' | 'FAULT' | 'UNDO';
  team: 1 | 2;
  serverNumber?: 1 | 2;
  team1Score: number;
  team2Score: number;
  metadata?: Record<string, unknown>;
}

// --- Cloud types (Layer 1) ---

export type MatchVisibility = 'private' | 'shared' | 'public';

export interface CloudMatch extends Match {
  ownerId: string;
  sharedWith: string[];
  visibility: MatchVisibility;
  syncedAt: number;
}

export interface CloudScoreEvent extends ScoreEvent {
  recordedBy: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
}
