import { renderHook } from '@solidjs/testing-library';
import { useSpectatorProjection } from '../useSpectatorProjection';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock('../../../../data/firebase/config', () => ({ firestore: {} }));

const mockLogger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../../../../shared/observability/logger', () => ({ logger: mockLogger }));

import { doc, onSnapshot } from 'firebase/firestore';

const mockDoc = vi.mocked(doc);
const mockOnSnapshot = vi.mocked(onSnapshot);

describe('useSpectatorProjection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('docRef' as any);
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  it('returns undefined projection when matchId is null', () => {
    const { result } = renderHook(useSpectatorProjection, [() => null]);
    expect(result.projection()).toBeUndefined();
    expect(result.loading()).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('returns undefined projection when matchId is undefined', () => {
    const { result } = renderHook(useSpectatorProjection, [() => undefined]);
    expect(result.projection()).toBeUndefined();
    expect(result.loading()).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('creates onSnapshot subscription when matchId is provided', () => {
    renderHook(useSpectatorProjection, [() => 'match-123']);

    expect(mockDoc).toHaveBeenCalledWith({}, 'matches', 'match-123', 'public', 'spectator');
    expect(mockOnSnapshot).toHaveBeenCalledWith(
      'docRef',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('sets loading to true when matchId is provided and waiting for snapshot', () => {
    const { result } = renderHook(useSpectatorProjection, [() => 'match-123']);
    expect(result.loading()).toBe(true);
  });

  it('populates projection from snapshot data when doc exists', () => {
    const { result } = renderHook(useSpectatorProjection, [() => 'match-123']);

    const snapshotCallback = mockOnSnapshot.mock.calls[0][1] as Function;
    const fakeProjection = {
      publicTeam1Name: 'Team Alpha',
      publicTeam2Name: 'Team Beta',
      team1Score: 5,
      team2Score: 3,
      gameNumber: 1,
      team1Wins: 0,
      team2Wins: 0,
      status: 'in-progress',
      visibility: 'public',
      tournamentId: 'tourney-1',
      tournamentShareCode: 'ABC123',
      spectatorCount: 0,
      updatedAt: 1000,
    };

    snapshotCallback({
      exists: () => true,
      data: () => fakeProjection,
    });

    expect(result.projection()).toEqual(fakeProjection);
    expect(result.loading()).toBe(false);
  });

  it('sets projection to undefined when doc does not exist', () => {
    const { result } = renderHook(useSpectatorProjection, [() => 'match-123']);

    const snapshotCallback = mockOnSnapshot.mock.calls[0][1] as Function;

    snapshotCallback({
      exists: () => false,
      data: () => undefined,
    });

    expect(result.projection()).toBeUndefined();
    expect(result.loading()).toBe(false);
  });

  it('cleans up subscription on unmount', () => {
    const unsubscribeMock = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribeMock);

    const { cleanup } = renderHook(useSpectatorProjection, [() => 'match-123']);

    expect(unsubscribeMock).not.toHaveBeenCalled();
    cleanup();
    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });

  it('handles snapshot error gracefully', () => {
    const { result } = renderHook(useSpectatorProjection, [() => 'match-123']);

    const errorCallback = mockOnSnapshot.mock.calls[0][2] as Function;
    errorCallback(new Error('permission-denied'));

    expect(result.loading()).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Spectator projection listener error',
      expect.any(Error),
    );
  });
});
