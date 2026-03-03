import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';

// Mock the repository before importing the hook
const mockSearchByNamePrefix = vi.fn().mockResolvedValue([]);

vi.mock('../../../../data/firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: {
    searchByNamePrefix: (...args: unknown[]) => mockSearchByNamePrefix(...args),
  },
}));

import { useUserSearch } from '../useUserSearch';

// Helper: create a UserProfile-like object
function makeUser(id: string, displayName: string, opts?: {
  profileVisibility?: 'public' | 'private';
  email?: string;
  photoURL?: string | null;
}) {
  return {
    id,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    email: opts?.email ?? `${id}@example.com`,
    photoURL: opts?.photoURL ?? `https://photo.test/${id}.jpg`,
    createdAt: Date.now(),
    profileVisibility: opts?.profileVisibility ?? 'public',
  };
}

describe('useUserSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty results before 2 chars typed', async () => {
    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('a');
      await vi.advanceTimersByTimeAsync(500);

      expect(hook.results()).toEqual([]);
      expect(mockSearchByNamePrefix).not.toHaveBeenCalled();
      dispose();
    });
  });

  it('fires search after 2+ chars with 300ms debounce', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([makeUser('u1', 'Alice')]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('al');

      // Not yet — debounce hasn't fired
      expect(mockSearchByNamePrefix).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);

      expect(mockSearchByNamePrefix).toHaveBeenCalledWith('al', 10);
      dispose();
    });
  });

  it('filters out scorer own UID from results', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([
      makeUser('scorer-1', 'Me'),
      makeUser('u2', 'Alice'),
    ]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('al');
      await vi.advanceTimersByTimeAsync(300);
      // Wait for the async search to resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(hook.results().map((r) => r.id)).toEqual(['u2']);
      dispose();
    });
  });

  it('filters out users already in buddy list', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([
      makeUser('buddy-1', 'Bob'),
      makeUser('u3', 'Charlie'),
    ]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: ['buddy-1', 'buddy-2'],
      });

      hook.search('bo');
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);

      expect(hook.results().map((r) => r.id)).toEqual(['u3']);
      dispose();
    });
  });

  it('sets photoURL to null for private-visibility users', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([
      makeUser('u1', 'PrivatePatty', {
        profileVisibility: 'private',
        photoURL: 'https://photo.test/patty.jpg',
      }),
    ]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('pr');
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);

      expect(hook.results()[0].photoURL).toBeNull();
      expect(hook.results()[0].displayName).toBe('PrivatePatty');
      dispose();
    });
  });

  it('strips email from results', async () => {
    mockSearchByNamePrefix.mockResolvedValueOnce([
      makeUser('u1', 'Alice', { email: 'alice@secret.com' }),
    ]);

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('al');
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);

      const result = hook.results()[0];
      expect(result).not.toHaveProperty('email');
      dispose();
    });
  });

  it('handles search error gracefully', async () => {
    mockSearchByNamePrefix.mockRejectedValueOnce(new Error('Network error'));

    await createRoot(async (dispose) => {
      const hook = useUserSearch({
        scorerUid: 'scorer-1',
        buddyUserIds: [],
      });

      hook.search('al');
      await vi.advanceTimersByTimeAsync(300);
      await vi.advanceTimersByTimeAsync(0);

      expect(hook.results()).toEqual([]);
      expect(hook.loading()).toBe(false);
      dispose();
    });
  });
});
