import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CloudMatch } from '../../types';

// Mock all Firebase modules
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(() => ({ exists: () => false })),
  getDocs: vi.fn(() => ({ docs: [] })),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => null),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

const mockAuth = { currentUser: null as { uid: string } | null };
vi.mock('../../firebase/config', () => ({
  auth: mockAuth,
  firestore: {},
}));

const mockMatchRepository = {
  save: vi.fn(),
  getAll: vi.fn(() => []),
};
vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: mockMatchRepository,
}));

const mockFirestoreMatchRepository = {
  save: vi.fn(),
  getByOwner: vi.fn(() => []),
};
vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: mockFirestoreMatchRepository,
}));

vi.mock('../../firebase/firestoreScoreEventRepository', () => ({
  firestoreScoreEventRepository: { save: vi.fn() },
}));

vi.mock('../../firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: { save: vi.fn(), getByOrganizer: vi.fn(() => []) },
}));

vi.mock('../../firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: { saveProfile: vi.fn() },
}));

vi.mock('../../firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: { processMatchCompletion: vi.fn() },
}));

describe('cloudSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export cloudSync object', async () => {
    const mod = await import('../cloudSync');
    expect(mod.cloudSync).toBeDefined();
  });

  it('should have syncMatchToCloud method', async () => {
    const mod = await import('../cloudSync');
    expect(typeof mod.cloudSync.syncMatchToCloud).toBe('function');
  });

  it('should have syncScoreEventToCloud method', async () => {
    const mod = await import('../cloudSync');
    expect(typeof mod.cloudSync.syncScoreEventToCloud).toBe('function');
  });

  it('should have pullCloudMatchesToLocal method', async () => {
    const mod = await import('../cloudSync');
    expect(typeof mod.cloudSync.pullCloudMatchesToLocal).toBe('function');
  });

  it('should preserve scorerRole and scorerTeam during pull', async () => {
    mockAuth.currentUser = { uid: 'user-1' };

    const cloudMatch: CloudMatch = {
      id: 'match-1',
      config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: ['p1', 'p2'],
      team2PlayerIds: ['p3', 'p4'],
      team1Name: 'Team A',
      team2Name: 'Team B',
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: 1000,
      completedAt: null,
      scorerRole: 'spectator',
      scorerTeam: 2,
      ownerId: 'user-1',
      sharedWith: [],
      visibility: 'private',
      syncedAt: 2000,
    };

    mockFirestoreMatchRepository.getByOwner.mockResolvedValue([cloudMatch]);

    const mod = await import('../cloudSync');
    const synced = await mod.cloudSync.pullCloudMatchesToLocal();

    expect(synced).toBe(1);
    expect(mockMatchRepository.save).toHaveBeenCalledOnce();
    const savedMatch = mockMatchRepository.save.mock.calls[0][0];
    expect(savedMatch.scorerRole).toBe('spectator');
    expect(savedMatch.scorerTeam).toBe(2);
  });
});
