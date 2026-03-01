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
  tournamentTeam1Id?: string;
  tournamentTeam2Id?: string;
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
  displayNameLower: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
  // Layer 7 Wave A additions (optional for backward compat)
  bio?: string;
  profileVisibility?: 'public' | 'private';
  updatedAt?: number;
}

// --- Player Stats types (Layer 7 Wave A) ---

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
}

// --- Tournament types (Layer 2) ---

export type TournamentVisibility = 'private' | 'public';
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

export type TeamFormation = 'byop' | 'auto-pair';

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
  teamFormation: TeamFormation | null;  // null for singles
  minPlayers: number | null;
  entryFee: EntryFee | null;
  rules: TournamentRules;
  pausedFrom: TournamentStatus | null;
  cancellationReason: string | null;
  createdAt: number;
  updatedAt: number;
  visibility: TournamentVisibility;
  shareCode: string | null;
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
  playerName: string | null;        // display name (from Google profile or organizer entry)
  teamId: string | null;
  paymentStatus: PaymentStatus;
  paymentNote: string;
  lateEntry: boolean;
  skillRating: number | null;       // 2.5-5.0, optional
  partnerId: string | null;         // BYOP: userId of desired partner
  partnerName: string | null;       // BYOP: display name for lookup
  profileComplete: boolean;         // true when rating + partner (if BYOP) filled
  registeredAt: number;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface TournamentInvitation {
  id: string;
  tournamentId: string;
  invitedUserId: string;
  invitedEmail: string;
  invitedName: string;
  invitedByUserId: string;
  status: InvitationStatus;
  createdAt: number;
  respondedAt: number | null;
}

// --- Player Buddies types ---

export type BuddyGroupVisibility = 'private' | 'public';
export type BuddyGroupMemberRole = 'admin' | 'member';
export type GameSessionStatus = 'proposed' | 'confirmed' | 'cancelled' | 'completed';
export type GameSessionVisibility = 'group' | 'open';
export type RsvpStyle = 'simple' | 'voting';
export type RsvpResponse = 'in' | 'out' | 'maybe';
export type DayOfStatus = 'none' | 'on-my-way' | 'here' | 'cant-make-it';
export type BuddyNotificationType =
  | 'session_proposed'
  | 'session_confirmed'
  | 'session_cancelled'
  | 'spot_opened'
  | 'player_joined'
  | 'group_invite'
  | 'voting_reminder';

export interface BuddyGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  defaultLocation: string | null;
  defaultDay: string | null;
  defaultTime: string | null;
  memberCount: number;
  visibility: BuddyGroupVisibility;
  shareCode: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface BuddyGroupMember {
  userId: string;
  displayName: string;
  photoURL: string | null;
  role: BuddyGroupMemberRole;
  joinedAt: number;
}

export interface TimeSlot {
  id: string;
  date: number;
  startTime: string;
  endTime: string;
  voteCount: number;
}

export interface GameSession {
  id: string;
  groupId: string | null;
  createdBy: string;
  title: string;
  location: string;
  courtsAvailable: number;
  spotsTotal: number;
  spotsConfirmed: number;
  scheduledDate: number | null;
  timeSlots: TimeSlot[] | null;
  confirmedSlot: TimeSlot | null;
  rsvpStyle: RsvpStyle;
  rsvpDeadline: number | null;
  visibility: GameSessionVisibility;
  shareCode: string;
  autoOpenOnDropout: boolean;
  minPlayers: number;
  status: GameSessionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SessionRsvp {
  userId: string;
  displayName: string;
  photoURL: string | null;
  response: RsvpResponse;
  dayOfStatus: DayOfStatus;
  selectedSlotIds: string[];
  respondedAt: number;
  statusUpdatedAt: number | null;
}

export interface BuddyNotification {
  id: string;
  userId: string;
  type: BuddyNotificationType;
  sessionId: string | null;
  groupId: string | null;
  actorName: string;
  message: string;
  read: boolean;
  createdAt: number;
}
