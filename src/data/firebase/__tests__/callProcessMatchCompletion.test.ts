import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { status: 'ok' } })),
}));

vi.mock('../config', () => ({
  functions: {},
}));

describe('callProcessMatchCompletion', () => {
  it('exports a callable function', async () => {
    const { callProcessMatchCompletion } = await import('../callProcessMatchCompletion');
    expect(typeof callProcessMatchCompletion).toBe('function');
  });

  it('calls the callable with matchId', async () => {
    const { callProcessMatchCompletion } = await import('../callProcessMatchCompletion');
    const result = await callProcessMatchCompletion('test-match-id');
    expect(result).toEqual({ status: 'ok' });
  });
});
