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
    config: { poolCount: 0, poolSize: 0, advanceCount: 0, consolation: false, thirdPlace: false },
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
    shareCode: shareCode(),
    visibility: 'private',
    createdBy: 'test-user',
    description: '',
    location: 'Test Location',
    memberIds: [],
    adminIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function makeGameSession(overrides: Record<string, unknown> = {}) {
  const id = uid('session');
  return {
    id,
    title: `Session ${id.slice(-4)}`,
    shareCode: shareCode(),
    date: new Date(Date.now() + 86400000).toISOString(),
    time: '10:00 AM',
    location: 'Test Location',
    maxSpots: 8,
    status: 'proposed',
    rsvpMode: 'simple',
    createdBy: 'test-user',
    rsvps: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
