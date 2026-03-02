// e2e/helpers/factories.ts
import { randomUUID } from 'crypto';

function uid(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function shareCode() {
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
    config: { poolCount: 0, poolSize: 0, advanceCount: 0, consolation: false, thirdPlace: false },
    organizerId: 'test-organizer',
    scorekeeperIds: [],
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
      scoringMode: 'sideout',
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
