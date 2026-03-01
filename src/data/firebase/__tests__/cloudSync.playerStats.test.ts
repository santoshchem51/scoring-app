import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Match } from '../../types';

const { mockProcessMatchCompletion, mockAuth } = vi.hoisted(() => ({
  mockProcessMatchCompletion: vi.fn(),
  mockAuth: { currentUser: null as { uid: string } | null },
}));

vi.mock('../firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: {
    processMatchCompletion: mockProcessMatchCompletion,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'test-user' } as { uid: string };
  });

  it('calls processMatchCompletion with match and scorer uid', () => {
    mockProcessMatchCompletion.mockResolvedValue(undefined);
    const match = { id: 'match-1' } as Match;

    cloudSync.syncPlayerStatsAfterMatch(match);

    expect(mockProcessMatchCompletion).toHaveBeenCalledWith(match, 'test-user');
  });

  it('does nothing when user is not authenticated', () => {
    mockAuth.currentUser = null;
    const match = { id: 'match-1' } as Match;

    cloudSync.syncPlayerStatsAfterMatch(match);

    expect(mockProcessMatchCompletion).not.toHaveBeenCalled();
  });

  it('swallows errors without throwing', () => {
    mockProcessMatchCompletion.mockRejectedValue(new Error('Network error'));
    const match = { id: 'match-1' } as Match;

    // Should not throw (fire-and-forget)
    expect(() => cloudSync.syncPlayerStatsAfterMatch(match)).not.toThrow();
  });
});
