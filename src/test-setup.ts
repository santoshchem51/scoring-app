import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('./data/firebase/config', () => ({
  auth: { currentUser: null },
  firestore: {},
}));

vi.mock('./data/firebase/cloudSync', () => ({
  cloudSync: {
    syncMatchToCloud: vi.fn(),
    syncScoreEventToCloud: vi.fn(),
    pullCloudMatchesToLocal: vi.fn(() => Promise.resolve(0)),
    syncUserProfile: vi.fn(() => Promise.resolve()),
    pushLocalMatchesToCloud: vi.fn(() => Promise.resolve(0)),
  },
}));
