import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../firebase/config', () => ({
  auth: { currentUser: null },
  firestore: {},
}));

vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {
    save: vi.fn(),
    getAll: vi.fn(() => []),
  },
}));

vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: {
    save: vi.fn(),
    getByOwner: vi.fn(() => []),
  },
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
});
