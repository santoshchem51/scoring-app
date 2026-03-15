import { describe, it, expect, vi } from 'vitest';

// Mock useLiveMatch
vi.mock('../../hooks/useLiveMatch', () => ({
  useLiveMatch: () => ({
    match: () => ({
      id: 'match-1',
      games: [{ gameNumber: 1, team1Score: 7, team2Score: 5, winningSide: 1 }],
      status: 'in-progress',
      lastSnapshot: JSON.stringify({ team1Score: 7, team2Score: 5, gameNumber: 1 }),
    }),
    loading: () => false,
  }),
}));

describe('LiveMatchCard', () => {
  it('exports a component', async () => {
    const mod = await import('../LiveMatchCard');
    expect(typeof mod.default).toBe('function');
  });
});
