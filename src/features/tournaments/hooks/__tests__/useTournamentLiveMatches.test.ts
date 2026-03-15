import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((_q: any, onNext: any) => {
    // Simulate empty snapshot
    onNext({ docs: [] });
    return () => {};
  }),
}));

vi.mock('../../../../data/firebase/config', () => ({
  firestore: {},
}));

describe('useTournamentLiveMatches', () => {
  it('exports a hook function', async () => {
    const mod = await import('../useTournamentLiveMatches');
    expect(typeof mod.useTournamentLiveMatches).toBe('function');
  });
});
