import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing the callable
vi.mock('firebase-admin/firestore', () => {
  const mockTransaction = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const mockDb = {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    runTransaction: vi.fn((fn: any) => fn(mockTransaction)),
  };
  return {
    getFirestore: () => mockDb,
    FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
  };
});

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

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
});
