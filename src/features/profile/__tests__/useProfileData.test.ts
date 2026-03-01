import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserProfile, StatsSummary, MatchRef } from '../../../data/types';

const { mockGetProfile, mockGetStatsSummary, mockGetRecentMatchRefs } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockGetStatsSummary: vi.fn(),
  mockGetRecentMatchRefs: vi.fn(),
}));

vi.mock('../../../data/firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: {
    getProfile: mockGetProfile,
  },
}));

vi.mock('../../../data/firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: {
    getStatsSummary: mockGetStatsSummary,
    getRecentMatchRefs: mockGetRecentMatchRefs,
  },
}));

import { fetchProfileBundle } from '../hooks/useProfileData';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    displayName: 'Alice',
    displayNameLower: 'alice',
    email: 'alice@test.com',
    photoURL: null,
    createdAt: 1000000,
    ...overrides,
  };
}

function makeStats(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 10,
    wins: 7,
    losses: 3,
    winRate: 0.7,
    currentStreak: { type: 'W', count: 3 },
    bestWinStreak: 5,
    singles: { matches: 6, wins: 4, losses: 2 },
    doubles: { matches: 4, wins: 3, losses: 1 },
    recentResults: [],
    tier: 'intermediate',
    tierConfidence: 'medium',
    tierUpdatedAt: 2000000,
    lastPlayedAt: 3000000,
    updatedAt: 3000000,
    ...overrides,
  };
}

function makeMatchRef(overrides: Partial<MatchRef> = {}): MatchRef {
  return {
    matchId: 'm1',
    startedAt: 1000,
    completedAt: 2000,
    gameType: 'singles',
    scoringMode: 'sideout',
    result: 'win',
    scores: '11-7, 11-4',
    gameScores: [[11, 7], [11, 4]],
    playerTeam: 1,
    opponentNames: ['Bob'],
    opponentIds: [],
    partnerName: null,
    partnerId: null,
    ownerId: 'user-1',
    tournamentId: null,
    tournamentName: null,
    ...overrides,
  };
}

describe('fetchProfileBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches profile, stats, and matches in parallel', async () => {
    const profile = makeProfile();
    const stats = makeStats();
    const matches = [makeMatchRef()];
    mockGetProfile.mockResolvedValueOnce(profile);
    mockGetStatsSummary.mockResolvedValueOnce(stats);
    mockGetRecentMatchRefs.mockResolvedValueOnce(matches);

    const result = await fetchProfileBundle('user-1');

    expect(mockGetProfile).toHaveBeenCalledWith('user-1');
    expect(mockGetStatsSummary).toHaveBeenCalledWith('user-1');
    expect(mockGetRecentMatchRefs).toHaveBeenCalledWith('user-1', 10);
    expect(result.profile).toEqual(profile);
    expect(result.stats).toEqual(stats);
    expect(result.matches).toEqual(matches);
  });

  it('returns partial data when stats fetch fails', async () => {
    const profile = makeProfile();
    mockGetProfile.mockResolvedValueOnce(profile);
    mockGetStatsSummary.mockRejectedValueOnce(new Error('permission-denied'));
    mockGetRecentMatchRefs.mockResolvedValueOnce([]);

    const result = await fetchProfileBundle('user-1');

    expect(result.profile).toEqual(profile);
    expect(result.stats).toBeNull();
    expect(result.errors.stats).not.toBeNull();
  });

  it('returns partial data when matches fetch fails', async () => {
    const profile = makeProfile();
    const stats = makeStats();
    mockGetProfile.mockResolvedValueOnce(profile);
    mockGetStatsSummary.mockResolvedValueOnce(stats);
    mockGetRecentMatchRefs.mockRejectedValueOnce(new Error('network error'));

    const result = await fetchProfileBundle('user-1');

    expect(result.profile).toEqual(profile);
    expect(result.stats).toEqual(stats);
    expect(result.matches).toEqual([]);
    expect(result.errors.matches).not.toBeNull();
  });

  it('tracks lastCompletedAt from last match for pagination cursor', async () => {
    const matches = [
      makeMatchRef({ matchId: 'm1', completedAt: 3000 }),
      makeMatchRef({ matchId: 'm2', completedAt: 2000 }),
      makeMatchRef({ matchId: 'm3', completedAt: 1000 }),
    ];
    mockGetProfile.mockResolvedValueOnce(makeProfile());
    mockGetStatsSummary.mockResolvedValueOnce(makeStats());
    mockGetRecentMatchRefs.mockResolvedValueOnce(matches);

    const result = await fetchProfileBundle('user-1');

    expect(result.lastCompletedAt).toBe(1000);
  });

  it('returns null lastCompletedAt when no matches', async () => {
    mockGetProfile.mockResolvedValueOnce(makeProfile());
    mockGetStatsSummary.mockResolvedValueOnce(makeStats());
    mockGetRecentMatchRefs.mockResolvedValueOnce([]);

    const result = await fetchProfileBundle('user-1');

    expect(result.lastCompletedAt).toBeNull();
  });

  it('returns null profile when profile fetch fails', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('not-found'));
    mockGetStatsSummary.mockResolvedValueOnce(makeStats());
    mockGetRecentMatchRefs.mockResolvedValueOnce([]);

    const result = await fetchProfileBundle('user-1');

    expect(result.profile).toBeNull();
    expect(result.errors.profile).not.toBeNull();
    expect(result.stats).not.toBeNull();
  });
});
