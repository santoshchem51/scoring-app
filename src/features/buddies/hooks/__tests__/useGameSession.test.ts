import { renderHook } from '@solidjs/testing-library';
import { useGameSession } from '../useGameSession';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock('../../../../data/firebase/config', () => ({ firestore: {} }));

import { doc, collection, onSnapshot } from 'firebase/firestore';

const mockOnSnapshot = vi.mocked(onSnapshot);
const mockDoc = vi.mocked(doc);
const mockCollection = vi.mocked(collection);

describe('useGameSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockDoc.mockReturnValue('docRef' as any);
    mockCollection.mockReturnValue('collectionRef' as any);
  });

  it('returns null session and empty rsvps when sessionId is undefined', () => {
    const { result } = renderHook(useGameSession, [() => undefined]);

    expect(result.session()).toBeNull();
    expect(result.rsvps()).toEqual([]);
    expect(result.loading()).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('creates subscriptions for both session doc and rsvps collection', () => {
    renderHook(useGameSession, [() => 'session-abc']);

    expect(mockDoc).toHaveBeenCalledWith({}, 'gameSessions', 'session-abc');
    expect(mockCollection).toHaveBeenCalledWith({}, 'gameSessions', 'session-abc', 'rsvps');
    // Two onSnapshot calls: one for session doc, one for rsvps collection
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    expect(mockOnSnapshot).toHaveBeenCalledWith('docRef', expect.any(Function));
    expect(mockOnSnapshot).toHaveBeenCalledWith('collectionRef', expect.any(Function));
  });

  it('sets loading to false after first session snapshot', () => {
    const { result } = renderHook(useGameSession, [() => 'session-abc']);

    expect(result.loading()).toBe(true);

    // Invoke the session doc snapshot callback (first onSnapshot call)
    const sessionCallback = mockOnSnapshot.mock.calls[0][1] as Function;
    sessionCallback({
      exists: () => true,
      id: 'session-abc',
      data: () => ({ title: 'Friday Game' }),
    });

    expect(result.loading()).toBe(false);
  });

  it('populates session data from snapshot', () => {
    const sessionData = {
      groupId: 'group-1',
      title: 'Friday Game',
      location: 'City Park',
    };
    const { result } = renderHook(useGameSession, [() => 'session-abc']);

    const sessionCallback = mockOnSnapshot.mock.calls[0][1] as Function;
    sessionCallback({
      exists: () => true,
      id: 'session-abc',
      data: () => sessionData,
    });

    expect(result.session()).toEqual({ id: 'session-abc', ...sessionData });
  });

  it('sets session to null when doc does not exist', () => {
    const { result } = renderHook(useGameSession, [() => 'session-abc']);

    const sessionCallback = mockOnSnapshot.mock.calls[0][1] as Function;
    sessionCallback({
      exists: () => false,
      id: 'session-abc',
      data: () => null,
    });

    expect(result.session()).toBeNull();
  });

  it('populates rsvps from collection snapshot', () => {
    const rsvpData = { userId: 'u1', response: 'in', displayName: 'Alice' };
    const { result } = renderHook(useGameSession, [() => 'session-abc']);

    // rsvps callback is the second onSnapshot call
    const rsvpsCallback = mockOnSnapshot.mock.calls[1][1] as Function;
    rsvpsCallback({
      docs: [{ data: () => rsvpData }],
    });

    expect(result.rsvps()).toEqual([rsvpData]);
  });

  it('cleans up both subscriptions on unmount', () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    const { cleanup } = renderHook(useGameSession, [() => 'session-abc']);

    expect(unsub1).not.toHaveBeenCalled();
    expect(unsub2).not.toHaveBeenCalled();
    cleanup();
    expect(unsub1).toHaveBeenCalledOnce();
    expect(unsub2).toHaveBeenCalledOnce();
  });
});
