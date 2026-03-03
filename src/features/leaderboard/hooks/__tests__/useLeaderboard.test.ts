import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';

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

vi.mock('../../../../data/firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: {
    getStatsSummary: vi.fn(() => Promise.resolve(null)),
  },
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

  it('returns expected shape with all properties', () => {
    createRoot((dispose) => {
      const result = useLeaderboard();
      // Accessor functions
      expect(typeof result.entries).toBe('function');
      expect(typeof result.userEntry).toBe('function');
      expect(typeof result.userRank).toBe('function');
      expect(typeof result.loading).toBe('function');
      // Signal getters
      expect(typeof result.scope).toBe('function');
      expect(typeof result.timeframe).toBe('function');
      // Signal setters
      expect(typeof result.setScope).toBe('function');
      expect(typeof result.setTimeframe).toBe('function');
      dispose();
    });
  });

  it('has correct default values for scope and timeframe', () => {
    createRoot((dispose) => {
      const result = useLeaderboard();
      expect(result.scope()).toBe('global');
      expect(result.timeframe()).toBe('allTime');
      dispose();
    });
  });

  it('setScope updates the scope signal', () => {
    createRoot((dispose) => {
      const result = useLeaderboard();
      expect(result.scope()).toBe('global');
      result.setScope('friends');
      expect(result.scope()).toBe('friends');
      dispose();
    });
  });

  it('setTimeframe updates the timeframe signal', () => {
    createRoot((dispose) => {
      const result = useLeaderboard();
      expect(result.timeframe()).toBe('allTime');
      result.setTimeframe('last30d');
      expect(result.timeframe()).toBe('last30d');
      dispose();
    });
  });

  it('entries returns empty array before data loads', () => {
    createRoot((dispose) => {
      const result = useLeaderboard();
      expect(result.entries()).toEqual([]);
      dispose();
    });
  });

  it('userEntry returns null before data loads', () => {
    createRoot((dispose) => {
      const result = useLeaderboard();
      expect(result.userEntry()).toBeNull();
      dispose();
    });
  });

  it('userRank returns null before data loads', () => {
    createRoot((dispose) => {
      const result = useLeaderboard();
      expect(result.userRank()).toBeNull();
      dispose();
    });
  });

  describe('invalidateLeaderboardCache', () => {
    it('does not throw when called with no arguments (full clear)', () => {
      expect(() => invalidateLeaderboardCache()).not.toThrow();
    });

    it('does not throw when called with scope and timeframe (selective)', () => {
      expect(() => invalidateLeaderboardCache('global', 'allTime')).not.toThrow();
    });

    it('does not throw for friends scope with last30d timeframe', () => {
      expect(() => invalidateLeaderboardCache('friends', 'last30d')).not.toThrow();
    });

    it('can be called multiple times without error', () => {
      expect(() => {
        invalidateLeaderboardCache();
        invalidateLeaderboardCache('global', 'allTime');
        invalidateLeaderboardCache('friends', 'last30d');
        invalidateLeaderboardCache();
      }).not.toThrow();
    });
  });

  describe('scope and timeframe signals', () => {
    it('accepts both valid scope values', () => {
      createRoot((dispose) => {
        const result = useLeaderboard();
        result.setScope('global');
        expect(result.scope()).toBe('global');
        result.setScope('friends');
        expect(result.scope()).toBe('friends');
        dispose();
      });
    });

    it('accepts both valid timeframe values', () => {
      createRoot((dispose) => {
        const result = useLeaderboard();
        result.setTimeframe('allTime');
        expect(result.timeframe()).toBe('allTime');
        result.setTimeframe('last30d');
        expect(result.timeframe()).toBe('last30d');
        dispose();
      });
    });
  });
});
