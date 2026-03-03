import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';

const mockGetGroupsForUser = vi.fn();
const mockGetMembers = vi.fn();

vi.mock('../../../../data/firebase/firestoreBuddyGroupRepository', () => ({
  firestoreBuddyGroupRepository: {
    getGroupsForUser: (...args: unknown[]) => mockGetGroupsForUser(...args),
    getMembers: (...args: unknown[]) => mockGetMembers(...args),
  },
}));

import { useBuddyPickerData } from '../useBuddyPickerData';

describe('useBuddyPickerData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty list initially (before load)', () => {
    createRoot((dispose) => {
      const { buddies, loading } = useBuddyPickerData(() => undefined);
      expect(buddies()).toEqual([]);
      expect(loading()).toBe(false);
      dispose();
    });
  });

  it('fetches and deduplicates members across groups', async () => {
    mockGetGroupsForUser.mockResolvedValue(['group-1', 'group-2']);
    mockGetMembers
      .mockResolvedValueOnce([
        { userId: 'u1', displayName: 'Alice', photoURL: null, role: 'member', joinedAt: 1 },
        { userId: 'u2', displayName: 'Bob', photoURL: null, role: 'member', joinedAt: 1 },
      ])
      .mockResolvedValueOnce([
        { userId: 'u1', displayName: 'Alice', photoURL: null, role: 'member', joinedAt: 1 },
        { userId: 'u3', displayName: 'Charlie', photoURL: null, role: 'member', joinedAt: 1 },
      ]);

    // createRoot is synchronous — extract signals, then await load() outside
    let buddies!: ReturnType<typeof useBuddyPickerData>['buddies'];
    let load!: ReturnType<typeof useBuddyPickerData>['load'];
    const dispose = createRoot((d) => {
      const data = useBuddyPickerData(() => 'current-user');
      buddies = data.buddies;
      load = data.load;
      return d;
    });

    await load();

    expect(buddies()).toHaveLength(3);
    expect(buddies().map((b) => b.userId)).toEqual(['u1', 'u2', 'u3']);
    dispose();
  });

  it('excludes current user from results', async () => {
    mockGetGroupsForUser.mockResolvedValue(['group-1']);
    mockGetMembers.mockResolvedValue([
      { userId: 'current-user', displayName: 'Me', photoURL: null, role: 'admin', joinedAt: 1 },
      { userId: 'u1', displayName: 'Alice', photoURL: null, role: 'member', joinedAt: 1 },
    ]);

    let buddies!: ReturnType<typeof useBuddyPickerData>['buddies'];
    let load!: ReturnType<typeof useBuddyPickerData>['load'];
    const dispose = createRoot((d) => {
      const data = useBuddyPickerData(() => 'current-user');
      buddies = data.buddies;
      load = data.load;
      return d;
    });

    await load();

    expect(buddies()).toHaveLength(1);
    expect(buddies()[0].userId).toBe('u1');
    dispose();
  });

  it('filters members with empty userId', async () => {
    mockGetGroupsForUser.mockResolvedValue(['group-1']);
    mockGetMembers.mockResolvedValue([
      { userId: '', displayName: 'Ghost', photoURL: null, role: 'member', joinedAt: 1 },
      { userId: 'u1', displayName: 'Alice', photoURL: null, role: 'member', joinedAt: 1 },
    ]);

    let buddies!: ReturnType<typeof useBuddyPickerData>['buddies'];
    let load!: ReturnType<typeof useBuddyPickerData>['load'];
    const dispose = createRoot((d) => {
      const data = useBuddyPickerData(() => 'me');
      buddies = data.buddies;
      load = data.load;
      return d;
    });

    await load();

    expect(buddies()).toHaveLength(1);
    dispose();
  });

  it('handles fetch failure gracefully', async () => {
    mockGetGroupsForUser.mockRejectedValue(new Error('Network error'));

    let buddies!: ReturnType<typeof useBuddyPickerData>['buddies'];
    let error!: ReturnType<typeof useBuddyPickerData>['error'];
    let load!: ReturnType<typeof useBuddyPickerData>['load'];
    const dispose = createRoot((d) => {
      const data = useBuddyPickerData(() => 'me');
      buddies = data.buddies;
      error = data.error;
      load = data.load;
      return d;
    });

    await load();

    expect(buddies()).toEqual([]);
    expect(error()).toBeTruthy();
    dispose();
  });
});
