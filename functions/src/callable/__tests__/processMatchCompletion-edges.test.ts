import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
const mockTransaction = {
  get: vi.fn(),
  set: vi.fn(),
};
const mockGet = vi.fn();
const mockDb = {
  collection: vi.fn().mockReturnThis(),
  doc: vi.fn().mockReturnThis(),
  get: mockGet,
  set: vi.fn().mockResolvedValue(undefined),
  runTransaction: vi.fn((fn: any) => fn(mockTransaction)),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

// Mock resolveParticipants to return a single participant for idempotency test
vi.mock('../../lib/participantResolution', () => ({
  resolveParticipants: vi.fn(() => [
    { uid: 'player-1', playerTeam: 1, result: 'win' },
  ]),
}));

vi.mock('../../lib/statsComputation', () => ({
  computeUpdatedStats: vi.fn(() => ({
    schemaVersion: 1, totalMatches: 1, wins: 1, losses: 0, winRate: 1,
    currentStreak: { type: 'W', count: 1 }, bestWinStreak: 1,
    singles: { matches: 1, wins: 1, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: ['W'], tier: 'beginner', tierConfidence: 'low',
    tierUpdatedAt: 0, lastPlayedAt: Date.now(), updatedAt: Date.now(),
    uniqueOpponentUids: [],
  })),
  buildMatchRefFromMatch: vi.fn(() => ({
    matchId: 'match-1', result: 'win', playedAt: Date.now(),
  })),
}));

vi.mock('../../shared/utils/leaderboardScoring', () => ({
  buildLeaderboardEntry: vi.fn(() => null),
}));

vi.mock('../../shared/utils/tierEngine', () => ({
  nearestTier: vi.fn(() => 'beginner'),
  TIER_MULTIPLIER: { beginner: 1, intermediate: 1.5, advanced: 2, pro: 2.5 },
}));

describe('processMatchCompletion edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects match with winningSide null (failed-precondition)', async () => {
    // Match doc exists, status completed, but winningSide is null
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'match-1',
      data: () => ({
        status: 'completed',
        winningSide: null,
        ownerId: 'user-1',
        sharedWith: [],
        config: { gameType: 'singles' },
      }),
    });

    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;

    try {
      await handler({ data: { matchId: 'match-1' }, auth: { uid: 'user-1' } });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('failed-precondition');
      expect(err.message).toContain('winningSide');
    }
  });

  it('skips writes when matchRef already exists (idempotency)', async () => {
    // Match doc: valid completed match
    mockGet.mockResolvedValue({
      exists: true,
      id: 'match-1',
      data: () => ({
        status: 'completed',
        winningSide: 1,
        ownerId: 'user-1',
        sharedWith: [],
        config: { gameType: 'singles' },
      }),
    });

    // tier doc reads — allSettled expects resolved values
    // The db.doc().get() calls for tier and profile use the same mockGet
    // but runTransaction mocks are separate via mockTransaction

    // Inside transaction: matchRef already exists (idempotent guard)
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({}),
    });

    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;

    const result = await handler({
      data: { matchId: 'match-1' },
      auth: { uid: 'user-1' },
    });

    // The transaction should NOT have called set, because matchRef already exists
    expect(mockTransaction.set).not.toHaveBeenCalled();
    // Should still return ok with processed results
    expect(result.status).toBe('ok');
  });
});
