// e2e/helpers/factories.ts
import { randomUUID } from 'crypto';

export function uid(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function shareCode() {
  return `E2E${randomUUID().slice(0, 5).toUpperCase()}`;
}

export function makeTournament(overrides: Record<string, unknown> = {}) {
  const id = uid('tournament');
  return {
    id,
    name: `Tournament ${id.slice(-4)}`,
    date: Date.now() + 86400000,
    location: 'Test Courts',
    format: 'round-robin',
    config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
    organizerId: 'test-organizer',
    staff: {},
    staffUids: [],
    status: 'registration',
    maxPlayers: 16,
    teamFormation: null,
    minPlayers: 4,
    entryFee: null,
    rules: { pointsToWin: 11, mustWin: true, bestOf: 1, playAllMatches: true },
    pausedFrom: null,
    cancellationReason: null,
    visibility: 'public',
    shareCode: shareCode(),
    accessMode: 'open',
    listed: true,
    buddyGroupId: null,
    buddyGroupName: null,
    registrationCounts: { confirmed: 0, pending: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function makeBuddyGroup(overrides: Record<string, unknown> = {}) {
  const id = uid('group');
  return {
    id,
    name: `Group ${id.slice(-4)}`,
    description: '',
    createdBy: 'test-user',
    defaultLocation: null,
    defaultDay: null,
    defaultTime: null,
    memberCount: 0,
    visibility: 'private',
    shareCode: shareCode(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function makeGameSession(overrides: Record<string, unknown> = {}) {
  const id = uid('session');
  return {
    id,
    groupId: null,
    createdBy: 'test-user',
    title: `Session ${id.slice(-4)}`,
    location: 'Test Location',
    courtsAvailable: 2,
    spotsTotal: 8,
    spotsConfirmed: 0,
    scheduledDate: Date.now() + 86400000,
    timeSlots: null,
    confirmedSlot: null,
    rsvpStyle: 'simple',
    rsvpDeadline: null,
    visibility: 'public',
    shareCode: shareCode(),
    autoOpenOnDropout: false,
    minPlayers: 4,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function makeTeam(overrides: Record<string, unknown> = {}) {
  const id = uid('team');
  return {
    id,
    tournamentId: '',
    name: `Team ${id.slice(-4)}`,
    playerIds: [`player-${randomUUID().slice(0, 8)}`],
    seed: null,
    poolId: null,
    ...overrides,
  };
}

export function makeBracketSlot(overrides: Record<string, unknown> = {}) {
  const id = uid('slot');
  return {
    id,
    tournamentId: '',
    round: 1,
    position: 1,
    team1Id: null,
    team2Id: null,
    matchId: null,
    winnerId: null,
    nextSlotId: null,
    ...overrides,
  };
}

export function makePool(overrides: Record<string, unknown> = {}) {
  const id = uid('pool');
  return {
    id,
    tournamentId: '',
    name: 'Pool A',
    teamIds: [],
    schedule: [],
    standings: [],
    ...overrides,
  };
}

export function makeUserProfile(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Test Player',
    displayNameLower: 'test player',
    email: 'testplayer@example.com',
    photoURL: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

export function makeStatsSummary(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    totalMatches: 10,
    wins: 7,
    losses: 3,
    winRate: 0.7,
    currentStreak: { type: 'W', count: 3 },
    bestWinStreak: 5,
    singles: { matches: 6, wins: 4, losses: 2 },
    doubles: { matches: 4, wins: 3, losses: 1 },
    recentResults: [],
    tier: 'intermediate',
    tierConfidence: 'medium',
    tierUpdatedAt: Date.now(),
    lastPlayedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function makeMatchRefSeed(overrides: Record<string, unknown> = {}) {
  const id = `match-${randomUUID().slice(0, 8)}`;
  return {
    id,
    data: {
      matchId: id,
      startedAt: Date.now() - 7200000,
      completedAt: Date.now() - 3600000,
      gameType: 'singles',
      scoringMode: 'rally',
      result: 'win',
      scores: '11-7, 11-4',
      gameScores: [],
      playerTeam: 1,
      opponentNames: ['Opponent'],
      opponentIds: [],
      partnerName: null,
      partnerId: null,
      ownerId: 'test-user',
      tournamentId: null,
      tournamentName: null,
      ...overrides,
    },
  };
}

export function makeScoreEvent(matchId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: uid('event'),
    matchId,
    gameNumber: 1,
    timestamp: Date.now(),
    type: 'POINT_SCORED',
    team: 1,
    team1Score: 1,
    team2Score: 0,
    recordedBy: 'test-scorer',
    visibility: 'public',
    ...overrides,
  };
}

export function makePublicMatch(ownerId: string, overrides: Record<string, unknown> = {}) {
  const status = (overrides.status as string) ?? 'in-progress';
  const team1Score = (overrides.team1Score as number) ?? 0;
  const team2Score = (overrides.team2Score as number) ?? 0;

  // Status-driven defaults for co-fields
  let statusDefaults: Record<string, unknown> = {};
  if (status === 'in-progress') {
    statusDefaults = {
      lastSnapshot: JSON.stringify({ team1Score, team2Score, gameNumber: 1 }),
      games: [],
      winningSide: null,
      completedAt: null,
    };
  } else if (status === 'completed') {
    const winningSide = team1Score >= team2Score ? 1 : 2;
    statusDefaults = {
      games: [{ gameNumber: 1, team1Score: team1Score || 11, team2Score: team2Score || 5, winningSide }],
      winningSide,
      completedAt: Date.now(),
    };
  }

  const merged = {
    id: uid('match'),
    config: {
      gameType: 'singles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
    },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team Alpha',
    team2Name: 'Team Beta',
    games: [],
    winningSide: null,
    status,
    startedAt: Date.now(),
    completedAt: null,
    ownerId,
    sharedWith: [],
    visibility: 'public',
    syncedAt: Date.now(),
    ...statusDefaults,
    ...overrides,
  };

  // Remove helper-only fields that are not real match fields
  delete merged.team1Score;
  delete merged.team2Score;

  return merged;
}

export function makeSpectatorProjection(overrides: Record<string, unknown> = {}) {
  return {
    publicTeam1Name: 'Team Alpha',
    publicTeam2Name: 'Team Beta',
    team1Score: 0,
    team2Score: 0,
    gameNumber: 1,
    team1Wins: 0,
    team2Wins: 0,
    status: 'in-progress',
    visibility: 'public',
    tournamentId: '',
    tournamentShareCode: '',
    spectatorCount: 0,
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function makeRsvp(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'test-user',
    displayName: 'Test Player',
    status: 'in',
    respondedAt: Date.now(),
    ...overrides,
  };
}

export function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('notif'),
    userId: 'test-user',
    category: 'tournament',
    type: 'tournament_update',
    message: 'Pool play has started.',
    payload: {},
    read: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

export function makeAchievement(overrides: Record<string, unknown> = {}) {
  return {
    achievementId: 'first-match',
    label: 'First Match',
    description: 'Played your first match',
    icon: 'trophy',
    unlockedAt: Date.now(),
    triggerMatchId: null,
    ...overrides,
  };
}
