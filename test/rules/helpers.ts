/**
 * Test data factories for Firestore security rules testing.
 * All shapes match the document types in src/data/types.ts.
 */
import type {
  RulesTestEnvironment,
  RulesTestContext,
} from '@firebase/rules-unit-testing';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Re-export for convenience
export { assertSucceeds, assertFails };

// Shared test environment
let testEnv: RulesTestEnvironment;

export async function setupTestEnv(): Promise<RulesTestEnvironment> {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  testEnv = await initializeTestEnvironment({
    projectId: 'picklescore-rules-test',
    firestore: {
      rules: readFileSync(rulesPath, 'utf8'),
      host: '127.0.0.1',
      port: 8180,
    },
  });
  return testEnv;
}

export function getTestEnv(): RulesTestEnvironment {
  return testEnv;
}

export async function teardownTestEnv(): Promise<void> {
  if (testEnv) {
    await testEnv.cleanup();
  }
}

export async function clearFirestore(): Promise<void> {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
}

/** Get a Firestore context authenticated as a specific user */
export function authedContext(uid: string): RulesTestContext {
  return testEnv.authenticatedContext(uid);
}

/** Get an unauthenticated Firestore context */
export function unauthedContext(): RulesTestContext {
  return testEnv.unauthenticatedContext();
}

// ── Test data factories ─────────────────────────────────────────────────

export function makeUserProfile(uid: string) {
  return {
    id: uid,
    displayName: 'Test User',
    email: `${uid}@test.com`,
    photoURL: null,
    createdAt: Date.now(),
  };
}

export function makeCloudMatch(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    config: {
      gameType: 'doubles',
      scoringMode: 'sideout',
      matchFormat: 'single',
      pointsToWin: 11,
    },
    team1PlayerIds: ['p1', 'p2'],
    team2PlayerIds: ['p3', 'p4'],
    team1Name: 'Team A',
    team2Name: 'Team B',
    games: [],
    winningSide: null,
    status: 'in-progress',
    startedAt: Date.now(),
    completedAt: null,
    ownerId,
    sharedWith: [],
    visibility: 'private',
    syncedAt: Date.now(),
    ...overrides,
  };
}

export function makeScoreEvent(matchId: string) {
  return {
    id: 'event-1',
    matchId,
    gameNumber: 1,
    timestamp: Date.now(),
    type: 'POINT_SCORED',
    team: 1,
    serverNumber: 1,
    team1Score: 1,
    team2Score: 0,
    recordedBy: 'owner-1',
  };
}

export function makeTournament(organizerId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'tourney-1',
    name: 'Test Tournament',
    date: Date.now(),
    location: 'Test Court',
    format: 'round-robin',
    config: {
      gameType: 'doubles',
      scoringMode: 'sideout',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount: 2,
      teamsPerPoolAdvancing: 2,
    },
    organizerId,
    scorekeeperIds: [],
    status: 'setup',
    maxPlayers: null,
    teamFormation: 'byop',
    minPlayers: null,
    entryFee: null,
    rules: {
      registrationDeadline: null,
      checkInRequired: false,
      checkInOpens: null,
      checkInCloses: null,
      scoringRules: '',
      timeoutRules: '',
      conductRules: '',
      penalties: [],
      additionalNotes: '',
    },
    pausedFrom: null,
    cancellationReason: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function makeTeam(tournamentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'team-1',
    tournamentId,
    name: 'Test Team',
    playerIds: ['p1', 'p2'],
    seed: null,
    poolId: null,
    ...overrides,
  };
}

export function makePool(tournamentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'pool-1',
    tournamentId,
    name: 'Pool A',
    teamIds: ['team-1', 'team-2'],
    schedule: [],
    standings: [],
    ...overrides,
  };
}

export function makeBracketSlot(tournamentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'slot-1',
    tournamentId,
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

export function makeRegistration(userId: string, tournamentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'reg-1',
    tournamentId,
    userId,
    teamId: null,
    paymentStatus: 'unpaid',
    paymentNote: '',
    lateEntry: false,
    skillRating: null,
    partnerId: null,
    partnerName: null,
    profileComplete: false,
    registeredAt: Date.now(),
    ...overrides,
  };
}
