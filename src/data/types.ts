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
  tournamentId?: string;
  poolId?: string;
  bracketSlotId?: string;
  court?: string;
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

// --- Tournament types (Layer 2) ---

export type TournamentFormat = 'round-robin' | 'single-elimination' | 'pool-bracket';
export type TournamentStatus = 'setup' | 'registration' | 'pool-play' | 'bracket' | 'completed' | 'cancelled' | 'paused';
export type PaymentStatus = 'unpaid' | 'paid' | 'waived';

export interface EntryFee {
  amount: number;
  currency: string;
  paymentInstructions: string;
  deadline: number | null;
}

export interface TournamentRules {
  registrationDeadline: number | null;
  checkInRequired: boolean;
  checkInOpens: number | null;
  checkInCloses: number | null;
  scoringRules: string;
  timeoutRules: string;
  conductRules: string;
  penalties: Array<{ offense: string; consequence: string }>;
  additionalNotes: string;
}

export interface TournamentConfig {
  gameType: GameType;
  scoringMode: ScoringMode;
  matchFormat: MatchFormat;
  pointsToWin: 11 | 15 | 21;
  poolCount: number;
  teamsPerPoolAdvancing: number;
}

export interface Tournament {
  id: string;
  name: string;
  date: number;
  location: string;
  format: TournamentFormat;
  config: TournamentConfig;
  organizerId: string;
  scorekeeperIds: string[];
  status: TournamentStatus;
  maxPlayers: number | null;
  minPlayers: number | null;
  entryFee: EntryFee | null;
  rules: TournamentRules;
  pausedFrom: TournamentStatus | null;
  cancellationReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  name: string;
  playerIds: string[];
  seed: number | null;
  poolId: string | null;
}

export interface PoolStanding {
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export interface PoolScheduleEntry {
  round: number;
  team1Id: string;
  team2Id: string;
  matchId: string | null;
  court: string | null;
}

export interface TournamentPool {
  id: string;
  tournamentId: string;
  name: string;
  teamIds: string[];
  schedule: PoolScheduleEntry[];
  standings: PoolStanding[];
}

export interface BracketSlot {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  team1Id: string | null;
  team2Id: string | null;
  matchId: string | null;
  winnerId: string | null;
  nextSlotId: string | null;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  userId: string;
  teamId: string | null;
  paymentStatus: PaymentStatus;
  paymentNote: string;
  lateEntry: boolean;
  rulesAcknowledged: boolean;
  registeredAt: number;
}
