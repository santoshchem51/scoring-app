import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StatsSummary, UnlockedAchievement } from '../../../../data/types';

// --- Mock auth ---
const mockAuth = { currentUser: null as { uid: string } | null };
vi.mock('../../../../data/firebase/config', () => ({
  auth: mockAuth,
  firestore: {},
}));

// --- Mock stats repo ---
const mockGetStatsSummary = vi.fn();
vi.mock('../../../../data/firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: {
    getStatsSummary: (...args: unknown[]) => mockGetStatsSummary(...args),
  },
}));

// --- Mock achievement repo ---
const mockGetUnlockedIds = vi.fn();
const mockCreate = vi.fn();
vi.mock('../../repository/firestoreAchievementRepository', () => ({
  firestoreAchievementRepository: {
    getUnlockedIds: (...args: unknown[]) => mockGetUnlockedIds(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

// --- Mock badge engine ---
const mockEvaluate = vi.fn();
vi.mock('../badgeEngine', () => ({
  evaluate: (...args: unknown[]) => mockEvaluate(...args),
}));

// --- Mock badge definitions ---
vi.mock('../badgeDefinitions', () => ({
  getDefinition: (id: string) => {
    const defs: Record<string, { id: string; name: string; description: string; icon: string; tier: string; category: string }> = {
      first_rally: { id: 'first_rally', name: 'First Rally', description: 'Play your first match', icon: 'icon1', tier: 'bronze', category: 'milestones' },
      warming_up: { id: 'warming_up', name: 'Warming Up', description: 'Play 10 matches', icon: 'icon2', tier: 'bronze', category: 'milestones' },
      hat_trick: { id: 'hat_trick', name: 'Hat Trick', description: 'Win 3 in a row', icon: 'icon3', tier: 'bronze', category: 'streaks' },
      first_win: { id: 'first_win', name: 'First Win', description: 'Win your first match', icon: 'icon4', tier: 'bronze', category: 'consistency' },
      proven: { id: 'proven', name: 'Proven', description: 'High confidence', icon: 'icon5', tier: 'silver', category: 'improvement' },
      shutout: { id: 'shutout', name: 'Shutout', description: 'Win without opponent scoring', icon: 'icon6', tier: 'silver', category: 'moments' },
      comeback_kid: { id: 'comeback_kid', name: 'Comeback Kid', description: 'Lose game 1 but win', icon: 'icon7', tier: 'silver', category: 'moments' },
      perfect_match: { id: 'perfect_match', name: 'Perfect Match', description: 'Win every game', icon: 'icon8', tier: 'silver', category: 'moments' },
    };
    return defs[id] ?? undefined;
  },
}));

// --- Mock Dexie ---
const mockBulkPut = vi.fn();
vi.mock('../../../../data/db', () => ({
  db: {
    achievements: {
      bulkPut: (...args: unknown[]) => mockBulkPut(...args),
    },
  },
}));

// --- Mock toast store ---
const mockEnqueueToast = vi.fn();
vi.mock('../../store/achievementStore', () => ({
  enqueueToast: (...args: unknown[]) => mockEnqueueToast(...args),
}));

// --- Helpers ---
function makeStats(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: { type: 'W', count: 0 },
    bestWinStreak: 0,
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: [],
    tier: 'beginner',
    tierConfidence: 'low',
    tierUpdatedAt: 0,
    lastPlayedAt: 0,
    updatedAt: 0,
    uniqueOpponentUids: [],
    ...overrides,
  };
}

function makeUnlocked(id: string): UnlockedAchievement {
  return {
    achievementId: id,
    unlockedAt: Date.now(),
    triggerMatchId: 'migration-check',
    triggerContext: { type: 'stats', field: id, value: 1 },
  };
}

const MIGRATION_KEY = 'picklescore_achievement_migration_version';

describe('runAchievementMigration', () => {
  let runAchievementMigration: () => Promise<void>;

  beforeEach(async () => {
    vi.resetAllMocks();
    localStorage.clear();

    // Reset auth
    mockAuth.currentUser = null;

    // Dynamic import to get fresh module each time
    const mod = await import('../achievementMigration');
    runAchievementMigration = mod.runAchievementMigration;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('skips migration if version matches localStorage', async () => {
    // Import to get the version constant
    const { MIGRATION_VERSION } = await import('../achievementMigration');
    localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION);
    mockAuth.currentUser = { uid: 'user-1' };

    await runAchievementMigration();

    expect(mockGetStatsSummary).not.toHaveBeenCalled();
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it('skips migration if no authenticated user', async () => {
    mockAuth.currentUser = null;

    await runAchievementMigration();

    expect(mockGetStatsSummary).not.toHaveBeenCalled();
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it('skips migration and sets version if user has no stats', async () => {
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetStatsSummary.mockResolvedValue(null);

    await runAchievementMigration();

    expect(mockGetStatsSummary).toHaveBeenCalledWith('user-1');
    expect(mockEvaluate).not.toHaveBeenCalled();
    const { MIGRATION_VERSION } = await import('../achievementMigration');
    expect(localStorage.getItem(MIGRATION_KEY)).toBe(MIGRATION_VERSION);
  });

  it('evaluates and writes retroactive achievements', async () => {
    const stats = makeStats({ totalMatches: 10, wins: 5 });
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetStatsSummary.mockResolvedValue(stats);
    mockGetUnlockedIds.mockResolvedValue(new Set());

    const unlocked = [makeUnlocked('first_rally'), makeUnlocked('first_win')];
    mockEvaluate.mockReturnValue(unlocked);
    mockCreate.mockResolvedValue(undefined);
    mockBulkPut.mockResolvedValue(undefined);

    await runAchievementMigration();

    // Should write each achievement to Firestore
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith('user-1', expect.objectContaining({
      achievementId: 'first_rally',
      triggerMatchId: 'retroactive-migration',
    }));
    expect(mockCreate).toHaveBeenCalledWith('user-1', expect.objectContaining({
      achievementId: 'first_win',
      triggerMatchId: 'retroactive-migration',
    }));

    // Should bulk-put to Dexie
    expect(mockBulkPut).toHaveBeenCalledTimes(1);
    const putRows = mockBulkPut.mock.calls[0][0];
    expect(putRows).toHaveLength(2);
    expect(putRows[0].achievementId).toBe('first_rally');
    expect(putRows[1].achievementId).toBe('first_win');

    // Should enqueue toasts for both (under the 3 cap)
    expect(mockEnqueueToast).toHaveBeenCalledTimes(2);
  });

  it('caps toasts at MAX_RETROACTIVE_TOASTS (3)', async () => {
    const stats = makeStats({ totalMatches: 100, wins: 60, bestWinStreak: 5 });
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetStatsSummary.mockResolvedValue(stats);
    mockGetUnlockedIds.mockResolvedValue(new Set());

    // Return 5 achievements
    const unlocked = [
      makeUnlocked('first_rally'),
      makeUnlocked('warming_up'),
      makeUnlocked('hat_trick'),
      makeUnlocked('first_win'),
      makeUnlocked('proven'),
    ];
    mockEvaluate.mockReturnValue(unlocked);
    mockCreate.mockResolvedValue(undefined);
    mockBulkPut.mockResolvedValue(undefined);

    await runAchievementMigration();

    // All 5 written to Firestore
    expect(mockCreate).toHaveBeenCalledTimes(5);

    // Dexie rows: first 3 have toastShown: 0, last 2 have toastShown: 1
    const putRows = mockBulkPut.mock.calls[0][0];
    expect(putRows).toHaveLength(5);
    expect(putRows[0].toastShown).toBe(0);
    expect(putRows[1].toastShown).toBe(0);
    expect(putRows[2].toastShown).toBe(0);
    expect(putRows[3].toastShown).toBe(1);
    expect(putRows[4].toastShown).toBe(1);

    // Only 3 toasts enqueued
    expect(mockEnqueueToast).toHaveBeenCalledTimes(3);
  });

  it('uses result: loss so moment-based badges cannot trigger', async () => {
    const stats = makeStats({ totalMatches: 1, wins: 1 });
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetStatsSummary.mockResolvedValue(stats);
    mockGetUnlockedIds.mockResolvedValue(new Set());
    mockEvaluate.mockReturnValue([]);

    await runAchievementMigration();

    // Verify evaluate was called with result: 'loss'
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
    const evalCtx = mockEvaluate.mock.calls[0][0];
    expect(evalCtx.result).toBe('loss');
    // No previousTier means improvement badges also won't trigger
    expect(evalCtx.previousTier).toBeUndefined();
  });

  it('sets localStorage version on success', async () => {
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetStatsSummary.mockResolvedValue(makeStats());
    mockGetUnlockedIds.mockResolvedValue(new Set());
    mockEvaluate.mockReturnValue([]);

    await runAchievementMigration();

    const { MIGRATION_VERSION } = await import('../achievementMigration');
    expect(localStorage.getItem(MIGRATION_KEY)).toBe(MIGRATION_VERSION);
  });

  it('does not set localStorage version on failure (allows retry)', async () => {
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetStatsSummary.mockRejectedValue(new Error('Firestore error'));

    await runAchievementMigration();

    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
  });

  it('continues writing other achievements when one Firestore write fails', async () => {
    const stats = makeStats({ totalMatches: 10, wins: 5 });
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetStatsSummary.mockResolvedValue(stats);
    mockGetUnlockedIds.mockResolvedValue(new Set());

    const unlocked = [makeUnlocked('first_rally'), makeUnlocked('first_win')];
    mockEvaluate.mockReturnValue(unlocked);
    // First write fails, second succeeds
    mockCreate
      .mockRejectedValueOnce(new Error('write error'))
      .mockResolvedValueOnce(undefined);
    mockBulkPut.mockResolvedValue(undefined);

    await runAchievementMigration();

    // Both create calls were attempted
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // Dexie bulk put still happens
    expect(mockBulkPut).toHaveBeenCalledTimes(1);
    // Version should still be set (partial success is OK)
    const { MIGRATION_VERSION } = await import('../achievementMigration');
    expect(localStorage.getItem(MIGRATION_KEY)).toBe(MIGRATION_VERSION);
  });

  it('passes existing achievement IDs to evaluate for de-duplication', async () => {
    const stats = makeStats({ totalMatches: 10 });
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetStatsSummary.mockResolvedValue(stats);

    const existingIds = new Set(['first_rally', 'first_win']);
    mockGetUnlockedIds.mockResolvedValue(existingIds);
    mockEvaluate.mockReturnValue([]);

    await runAchievementMigration();

    const evalCtx = mockEvaluate.mock.calls[0][0];
    expect(evalCtx.existingIds).toBe(existingIds);
  });
});
