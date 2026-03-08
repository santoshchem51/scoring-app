import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mock references (stable across vi.resetModules()) ──

const {
  mockOnAuthStateChanged,
  mockSignInWithPopup,
  mockSignOut,
  mockSyncUserProfile,
  mockEnqueueLocalMatchPush,
  mockPullCloudMatchesToLocal,
  mockResetAwaitingAuthJobs,
  mockStartProcessor,
  mockStopProcessor,
  mockWakeProcessor,
  mockRunAchievementMigration,
  mockStartNotificationListener,
  mockStopNotificationListener,
  mockCleanupExpiredNotifications,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockSignInWithPopup: vi.fn(),
  mockSignOut: vi.fn(),
  mockSyncUserProfile: vi.fn().mockResolvedValue(undefined),
  mockEnqueueLocalMatchPush: vi.fn().mockResolvedValue(undefined),
  mockPullCloudMatchesToLocal: vi.fn().mockResolvedValue(undefined),
  mockResetAwaitingAuthJobs: vi.fn().mockResolvedValue(undefined),
  mockStartProcessor: vi.fn(),
  mockStopProcessor: vi.fn(),
  mockWakeProcessor: vi.fn(),
  mockRunAchievementMigration: vi.fn().mockResolvedValue(undefined),
  mockStartNotificationListener: vi.fn(),
  mockStopNotificationListener: vi.fn(),
  mockCleanupExpiredNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../data/firebase/config', () => ({
  auth: {},
  firestore: {},
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock('../../../data/firebase/cloudSync', () => ({
  cloudSync: {
    syncUserProfile: (...args: unknown[]) => mockSyncUserProfile(...args),
    enqueueLocalMatchPush: (...args: unknown[]) => mockEnqueueLocalMatchPush(...args),
    pullCloudMatchesToLocal: (...args: unknown[]) => mockPullCloudMatchesToLocal(...args),
  },
}));

vi.mock('../../../data/firebase/syncQueue', () => ({
  resetAwaitingAuthJobs: (...args: unknown[]) => mockResetAwaitingAuthJobs(...args),
}));

vi.mock('../../../data/firebase/syncProcessor', () => ({
  startProcessor: (...args: unknown[]) => mockStartProcessor(...args),
  stopProcessor: (...args: unknown[]) => mockStopProcessor(...args),
  wakeProcessor: (...args: unknown[]) => mockWakeProcessor(...args),
}));

vi.mock('../../../features/achievements/engine/achievementMigration', () => ({
  runAchievementMigration: (...args: unknown[]) => mockRunAchievementMigration(...args),
}));

vi.mock('../../../features/notifications/store/notificationStore', () => ({
  startNotificationListener: (...args: unknown[]) => mockStartNotificationListener(...args),
  stopNotificationListener: (...args: unknown[]) => mockStopNotificationListener(...args),
  cleanupExpiredNotifications: (...args: unknown[]) => mockCleanupExpiredNotifications(...args),
}));

function resetAllMocks() {
  mockOnAuthStateChanged.mockReset();
  mockSignInWithPopup.mockReset();
  mockSignOut.mockReset();
  mockSyncUserProfile.mockReset().mockResolvedValue(undefined);
  mockEnqueueLocalMatchPush.mockReset().mockResolvedValue(undefined);
  mockPullCloudMatchesToLocal.mockReset().mockResolvedValue(undefined);
  mockResetAwaitingAuthJobs.mockReset().mockResolvedValue(undefined);
  mockStartProcessor.mockReset();
  mockStopProcessor.mockReset();
  mockWakeProcessor.mockReset();
  mockRunAchievementMigration.mockReset().mockResolvedValue(undefined);
  mockStartNotificationListener.mockReset();
  mockStopNotificationListener.mockReset();
  mockCleanupExpiredNotifications.mockReset().mockResolvedValue(undefined);
}

describe('useAuth', () => {
  let useAuth: typeof import('../useAuth')['useAuth'];

  beforeEach(async () => {
    vi.resetModules();
    resetAllMocks();

    const mod = await import('../useAuth');
    useAuth = mod.useAuth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export useAuth function', () => {
    expect(useAuth).toBeDefined();
    expect(typeof useAuth).toBe('function');
  });

  it('should provide signIn and signOut functions', () => {
    const authState = useAuth();
    expect(typeof authState.signIn).toBe('function');
    expect(typeof authState.signOut).toBe('function');
  });

  it('should provide user and loading signals', () => {
    const authState = useAuth();
    expect(typeof authState.user).toBe('function');
    expect(typeof authState.loading).toBe('function');
  });

  it('should call signInWithPopup on signIn', async () => {
    const authState = useAuth();
    await authState.signIn();
    expect(mockSignInWithPopup).toHaveBeenCalled();
  });

  it('should call firebase signOut on signOut', async () => {
    const authState = useAuth();
    await authState.signOut();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should provide syncing signal', () => {
    const authState = useAuth();
    expect(typeof authState.syncing).toBe('function');
  });

  it('should provide syncError signal', () => {
    const authState = useAuth();
    expect(typeof authState.syncError).toBe('function');
    expect(authState.syncError()).toBe(false);
  });
});

describe('useAuth — notification lifecycle', () => {
  let useAuth: typeof import('../useAuth')['useAuth'];

  beforeEach(async () => {
    vi.resetModules();
    resetAllMocks();

    const mod = await import('../useAuth');
    useAuth = mod.useAuth;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('startNotificationListener called with uid on sign-in', async () => {
    useAuth();

    expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
    const authCallback = mockOnAuthStateChanged.mock.calls[0][1] as (
      user: unknown,
    ) => Promise<void>;

    // Simulate sign-in
    await authCallback({
      uid: 'test-uid-123',
      getIdToken: vi.fn().mockResolvedValue('token'),
    });

    expect(mockStartNotificationListener).toHaveBeenCalledTimes(1);
    expect(mockStartNotificationListener).toHaveBeenCalledWith('test-uid-123');
  });

  it('cleanupExpiredNotifications called on sign-in', async () => {
    useAuth();

    const authCallback = mockOnAuthStateChanged.mock.calls[0][1] as (
      user: unknown,
    ) => Promise<void>;

    await authCallback({
      uid: 'test-uid-123',
      getIdToken: vi.fn().mockResolvedValue('token'),
    });

    expect(mockCleanupExpiredNotifications).toHaveBeenCalledTimes(1);
    expect(mockCleanupExpiredNotifications).toHaveBeenCalledWith('test-uid-123');
  });

  it('stopNotificationListener called on sign-out', async () => {
    useAuth();

    const authCallback = mockOnAuthStateChanged.mock.calls[0][1] as (
      user: unknown,
    ) => Promise<void>;

    // First simulate sign-in so the user signal transitions from null -> user
    await authCallback({
      uid: 'test-uid-123',
      getIdToken: vi.fn().mockResolvedValue('token'),
    });

    // Then simulate sign-out
    await authCallback(null);

    expect(mockStopNotificationListener).toHaveBeenCalledTimes(1);
  });
});
