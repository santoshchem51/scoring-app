import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../db';
import type { Match } from '../../types';

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { currentUser: null as { uid: string } | null },
}));

vi.mock('../firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: {
    processMatchCompletion: vi.fn(),
  },
}));

vi.mock('../firestoreMatchRepository', () => ({
  firestoreMatchRepository: {},
}));

vi.mock('../firestoreScoreEventRepository', () => ({
  firestoreScoreEventRepository: {},
}));

vi.mock('../firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {},
}));

vi.mock('../firestoreUserRepository', () => ({
  firestoreUserRepository: {},
}));

vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {},
}));

vi.mock('../config', () => ({
  auth: mockAuth,
  firestore: 'mock-firestore',
}));

import { cloudSync } from '../cloudSync';

describe('cloudSync.syncPlayerStatsAfterMatch', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.syncQueue.clear();
    mockAuth.currentUser = { uid: 'test-user' } as { uid: string };
  });

  it('enqueues a playerStats job with match dependency', async () => {
    const match = { id: 'match-1' } as Match;

    cloudSync.syncPlayerStatsAfterMatch(match);

    await vi.waitFor(async () => {
      const job = await db.syncQueue.get('playerStats:match-1');
      expect(job).toBeDefined();
      expect(job!.type).toBe('playerStats');
      expect(job!.context).toEqual({ type: 'playerStats', scorerUid: 'test-user' });
      expect(job!.dependsOn).toEqual(['match:match-1']);
    });
  });

  it('does nothing when user is not authenticated', async () => {
    mockAuth.currentUser = null;
    const match = { id: 'match-1' } as Match;

    cloudSync.syncPlayerStatsAfterMatch(match);

    await new Promise((r) => setTimeout(r, 50));
    const count = await db.syncQueue.count();
    expect(count).toBe(0);
  });

  it('swallows enqueue errors without throwing', () => {
    const match = { id: 'match-1' } as Match;

    // Should not throw (fire-and-forget)
    expect(() => cloudSync.syncPlayerStatsAfterMatch(match)).not.toThrow();
  });
});
