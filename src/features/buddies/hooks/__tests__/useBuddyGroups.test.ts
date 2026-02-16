import { createSignal } from 'solid-js';
import { renderHook } from '@solidjs/testing-library';
import { useBuddyGroups } from '../useBuddyGroups';

vi.mock('firebase/firestore', () => ({
  collectionGroup: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn(),
}));
vi.mock('../../../../data/firebase/config', () => ({ firestore: {} }));

import {
  collectionGroup,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
} from 'firebase/firestore';

const mockOnSnapshot = vi.mocked(onSnapshot);
const mockCollectionGroup = vi.mocked(collectionGroup);
const mockQuery = vi.mocked(query);
const mockWhere = vi.mocked(where);
const mockGetDoc = vi.mocked(getDoc);
const mockDoc = vi.mocked(doc);

describe('useBuddyGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockCollectionGroup.mockReturnValue('collectionGroupRef' as any);
    mockQuery.mockReturnValue('queryRef' as any);
    mockWhere.mockReturnValue('whereClause' as any);
  });

  it('returns empty array when userId is undefined', () => {
    const { result } = renderHook(useBuddyGroups, [() => undefined]);
    expect(result.groups()).toEqual([]);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('calls onSnapshot with collectionGroup("members") when userId provided', () => {
    renderHook(useBuddyGroups, [() => 'user-123']);

    expect(mockCollectionGroup).toHaveBeenCalledWith({}, 'members');
    expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user-123');
    expect(mockQuery).toHaveBeenCalledWith('collectionGroupRef', 'whereClause');
    expect(mockOnSnapshot).toHaveBeenCalledWith('queryRef', expect.any(Function));
  });

  it('cleans up subscription on unmount', () => {
    const unsubscribeMock = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribeMock);

    const { cleanup } = renderHook(useBuddyGroups, [() => 'user-123']);

    expect(unsubscribeMock).not.toHaveBeenCalled();
    cleanup();
    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });

  it('populates groups from snapshot data', async () => {
    const fakeGroupData = { name: 'Test Group', memberCount: 3 };
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'group-1',
      data: () => fakeGroupData,
    } as any);
    mockDoc.mockReturnValue('docRef' as any);

    const { result } = renderHook(useBuddyGroups, [() => 'user-123']);

    // Grab the snapshot callback that onSnapshot was called with
    const snapshotCallback = mockOnSnapshot.mock.calls[0][1] as Function;
    const fakeSnapshot = {
      docs: [
        { ref: { parent: { parent: { id: 'group-1' } } } },
      ],
    };

    await snapshotCallback(fakeSnapshot);

    expect(mockDoc).toHaveBeenCalledWith({}, 'buddyGroups', 'group-1');
    expect(result.groups()).toEqual([{ id: 'group-1', ...fakeGroupData }]);
  });

  it('sets groups to empty when snapshot returns no docs', async () => {
    const { result } = renderHook(useBuddyGroups, [() => 'user-123']);

    const snapshotCallback = mockOnSnapshot.mock.calls[0][1] as Function;
    await snapshotCallback({ docs: [] });

    expect(result.groups()).toEqual([]);
    expect(result.loading()).toBe(false);
  });
});
