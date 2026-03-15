// functions/src/shared/types.ts — canonical type definitions shared between client and Cloud Functions

export type ScoringMode = 'sideout' | 'rally';
export type MatchFormat = 'single' | 'best-of-3' | 'best-of-5';
export type MatchStatus = 'in-progress' | 'completed' | 'abandoned';
export type GameType = 'singles' | 'doubles';

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
  team1Color?: string;
  team2Color?: string;
  games: GameResult[];
  winningSide: 1 | 2 | null;
  status: MatchStatus;
  startedAt: number;
  completedAt: number | null;
  tournamentId?: string;
  tournamentTeam1Id?: string;
  tournamentTeam2Id?: string;
  poolId?: string;
  bracketSlotId?: string;
  court?: string;
  lastSnapshot?: string | null;
  scorerRole?: 'player' | 'spectator';
  scorerTeam?: 1 | 2;
  ownerUid?: string;
}

export type MatchVisibility = 'private' | 'shared' | 'public';

export interface CloudMatch extends Match {
  ownerId: string;
  sharedWith: string[];
  visibility: MatchVisibility;
  syncedAt: number;
}

export type Tier = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type TierConfidence = 'low' | 'medium' | 'high';

export interface RecentResult {
  result: 'win' | 'loss';
  opponentTier: Tier;
  completedAt: number;
  gameType: 'singles' | 'doubles';
}

export interface MatchRef {
  matchId: string;
  startedAt: number;
  completedAt: number;
  gameType: 'singles' | 'doubles';
  scoringMode: 'sideout' | 'rally';
  result: 'win' | 'loss';
  scores: string;
  gameScores: number[][];
  playerTeam: 1 | 2;
  opponentNames: string[];
  opponentIds: string[];
  partnerName: string | null;
  partnerId: string | null;
  ownerId: string;
  tournamentId: string | null;
  tournamentName: string | null;
}

export interface StatsSummary {
  schemaVersion: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: { type: 'W' | 'L'; count: number };
  bestWinStreak: number;
  singles: { matches: number; wins: number; losses: number };
  doubles: { matches: number; wins: number; losses: number };
  recentResults: RecentResult[];
  tier: Tier;
  tierConfidence: TierConfidence;
  tierUpdatedAt: number;
  lastPlayedAt: number;
  updatedAt: number;
  uniqueOpponentUids: string[];
}

export interface Last30dStats {
  totalMatches: number;
  wins: number;
  winRate: number;
  compositeScore: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  tier: Tier;
  tierConfidence: TierConfidence;
  totalMatches: number;
  wins: number;
  winRate: number;
  currentStreak: { type: 'W' | 'L'; count: number };
  compositeScore: number;
  last30d: Last30dStats;
  lastPlayedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
  bio?: string;
  profileVisibility?: 'public' | 'private';
  updatedAt?: number;
}
