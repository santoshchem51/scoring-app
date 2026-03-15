import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing the callable
const mockGet = vi.fn();
const mockTransaction = {
  get: vi.fn(),
  set: vi.fn(),
};
const mockDb = {
  collection: vi.fn().mockReturnThis(),
  doc: vi.fn().mockReturnValue({ get: mockGet }),
  runTransaction: vi.fn((fn: any) => fn(mockTransaction)),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default: doc doesn't exist
  mockGet.mockResolvedValue({ exists: false, data: () => undefined, id: 'test' });
});

describe('processMatchCompletion validation', () => {
  it('rejects unauthenticated calls', async () => {
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    try {
      await handler({ data: { matchId: 'test' }, auth: null });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('unauthenticated');
      expect(err.message).toBe('Must be authenticated');
    }
  });

  it('rejects missing matchId', async () => {
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    try {
      await handler({ data: {}, auth: { uid: 'user-1' } });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('invalid-argument');
      expect(err.message).toBe('matchId must be a non-empty string');
    }
  });

  it('rejects non-string matchId', async () => {
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    try {
      await handler({ data: { matchId: 123 }, auth: { uid: 'user-1' } });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('invalid-argument');
      expect(err.message).toBe('matchId must be a non-empty string');
    }
  });

  it('rejects matchId with path traversal characters', async () => {
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    await expect(
      handler({ data: { matchId: '../../admin/secrets' }, auth: { uid: 'user-1' } }),
    ).rejects.toThrow('invalid');
  });

  it('rejects matchId with slash', async () => {
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    await expect(
      handler({ data: { matchId: 'foo/bar' }, auth: { uid: 'user-1' } }),
    ).rejects.toThrow('invalid');
  });

  it('rejects non-existent match', async () => {
    mockGet.mockResolvedValue({ exists: false, data: () => undefined, id: 'no-match' });
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    try {
      await handler({ data: { matchId: 'no-match' }, auth: { uid: 'user-1' } });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('not-found');
    }
  });

  it('rejects non-completed match', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: 'match-1',
      data: () => ({
        status: 'in-progress',
        winningSide: null,
        ownerId: 'user-1',
        sharedWith: [],
      }),
    });
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    try {
      await handler({ data: { matchId: 'match-1' }, auth: { uid: 'user-1' } });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('failed-precondition');
    }
  });

  it('rejects unauthorized caller', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: 'match-1',
      data: () => ({
        status: 'completed',
        winningSide: 1,
        ownerId: 'other-user',
        sharedWith: [],
      }),
    });
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    try {
      await handler({ data: { matchId: 'match-1' }, auth: { uid: 'attacker' } });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('permission-denied');
    }
  });

  it('rejects corrupted match document', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: 'match-1',
      data: () => ({
        status: 'completed',
        winningSide: 1,
        // missing ownerId and sharedWith
      }),
    });
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    try {
      await handler({ data: { matchId: 'match-1' }, auth: { uid: 'user-1' } });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('data-loss');
    }
  });
});
