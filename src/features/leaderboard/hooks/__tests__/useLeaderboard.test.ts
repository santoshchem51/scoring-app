import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetGlobalLeaderboard,
  mockGetFriendsLeaderboard,
  mockGetUserRank,
  mockGetUserEntry,
} = vi.hoisted(() => ({
  mockGetGlobalLeaderboard: vi.fn(() => Promise.resolve([])),
  mockGetFriendsLeaderboard: vi.fn(() => Promise.resolve([])),
  mockGetUserRank: vi.fn(() => Promise.resolve(1)),
  mockGetUserEntry: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../data/firebase/firestoreLeaderboardRepository', () => ({
  firestoreLeaderboardRepository: {
    getGlobalLeaderboard: mockGetGlobalLeaderboard,
    getFriendsLeaderboard: mockGetFriendsLeaderboard,
    getUserRank: mockGetUserRank,
    getUserEntry: mockGetUserEntry,
  },
}));

vi.mock('../../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'test-uid', displayName: 'Test User' }),
  }),
}));

import { useLeaderboard, invalidateLeaderboardCache } from '../useLeaderboard';

describe('useLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateLeaderboardCache();
  });

  it('exports useLeaderboard function', () => {
    expect(useLeaderboard).toBeDefined();
    expect(typeof useLeaderboard).toBe('function');
  });

  it('exports invalidateLeaderboardCache function', () => {
    expect(invalidateLeaderboardCache).toBeDefined();
    expect(typeof invalidateLeaderboardCache).toBe('function');
  });
});
