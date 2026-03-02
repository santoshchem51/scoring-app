import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import RecentMatches from '../components/RecentMatches';
import type { MatchRef } from '../../../data/types';

function makeMatch(overrides: Partial<MatchRef> = {}): MatchRef {
  return {
    matchId: 'm1',
    startedAt: 1000,
    completedAt: Date.now() - 1000 * 60 * 60,
    gameType: 'singles',
    scoringMode: 'sideout',
    result: 'win',
    scores: '11-7, 11-4',
    gameScores: [[11, 7], [11, 4]],
    playerTeam: 1,
    opponentNames: ['Bob'],
    opponentIds: [],
    partnerName: null,
    partnerId: null,
    ownerId: 'user-1',
    tournamentId: null,
    tournamentName: null,
    ...overrides,
  };
}

describe('RecentMatches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders match rows with W/L badges', () => {
    const matches = [
      makeMatch({ matchId: 'm1', result: 'win', completedAt: Date.now() - 3600000 }),
      makeMatch({ matchId: 'm2', result: 'loss', completedAt: Date.now() - 7200000 }),
    ];
    render(() => <RecentMatches matches={matches} hasMore={false} loadingMore={false} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.getByLabelText(/^Win against/)).toBeTruthy();
    expect(screen.getByLabelText(/^Loss against/)).toBeTruthy();
  });

  it('displays opponent names', () => {
    render(() => (
      <RecentMatches matches={[makeMatch({ opponentNames: ['Bob'] })]} hasMore={false} loadingMore={false} />
    ));
    expect(screen.getByText(/vs Bob/)).toBeTruthy();
  });

  it('displays scores', () => {
    render(() => (
      <RecentMatches matches={[makeMatch({ scores: '11-7, 11-4' })]} hasMore={false} loadingMore={false} />
    ));
    expect(screen.getByText('11-7, 11-4')).toBeTruthy();
  });

  it('joins multiple opponent names with &', () => {
    render(() => (
      <RecentMatches
        matches={[makeMatch({ opponentNames: ['Bob', 'Carol'] })]}
        hasMore={false}
        loadingMore={false}
      />
    ));
    expect(screen.getByText(/vs Bob & Carol/)).toBeTruthy();
  });

  it('shows Load More button when hasMore is true', () => {
    render(() => (
      <RecentMatches matches={[makeMatch()]} hasMore={true} loadingMore={false} />
    ));
    expect(screen.getByLabelText('Load more matches')).toBeTruthy();
  });

  it('hides Load More button when hasMore is false', () => {
    render(() => (
      <RecentMatches matches={[makeMatch()]} hasMore={false} loadingMore={false} />
    ));
    expect(screen.queryByLabelText('Load more matches')).toBeNull();
  });

  it('shows Loading... and disables button when loadingMore', () => {
    render(() => (
      <RecentMatches matches={[makeMatch()]} hasMore={true} loadingMore={true} />
    ));
    const button = screen.getByLabelText('Load more matches');
    expect(button).toHaveTextContent('Loading...');
    expect(button).toBeDisabled();
  });

  it('formats relative dates correctly', async () => {
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;
    const matches = [
      makeMatch({ matchId: 'today', completedAt: now - 1000, opponentNames: ['Today-Opp'] }),
      makeMatch({ matchId: '1d', completedAt: now - DAY, opponentNames: ['Yesterday-Opp'] }),
      makeMatch({ matchId: '3d', completedAt: now - 3 * DAY, opponentNames: ['ThreeDays-Opp'] }),
      makeMatch({ matchId: '7d', completedAt: now - 7 * DAY, opponentNames: ['OneWeek-Opp'] }),
      makeMatch({ matchId: '2w', completedAt: now - 14 * DAY, opponentNames: ['TwoWeeks-Opp'] }),
      makeMatch({ matchId: '30d', completedAt: now - 30 * DAY, opponentNames: ['OneMonth-Opp'] }),
      makeMatch({ matchId: '3mo', completedAt: now - 90 * DAY, opponentNames: ['ThreeMonths-Opp'] }),
      makeMatch({ matchId: '365d', completedAt: now - 365 * DAY, opponentNames: ['OneYear-Opp'] }),
    ];
    render(() => <RecentMatches matches={matches} hasMore={false} loadingMore={false} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Today-Opp/)).toHaveTextContent(/today/);
      expect(screen.getByLabelText(/Yesterday-Opp/)).toHaveTextContent(/1d/);
      expect(screen.getByLabelText(/ThreeDays-Opp/)).toHaveTextContent(/3d/);
      expect(screen.getByLabelText(/OneWeek-Opp/)).toHaveTextContent(/1w/);
      expect(screen.getByLabelText(/TwoWeeks-Opp/)).toHaveTextContent(/2w/);
      expect(screen.getByLabelText(/OneMonth-Opp/)).toHaveTextContent(/1mo/);
      expect(screen.getByLabelText(/ThreeMonths-Opp/)).toHaveTextContent(/3mo/);
      expect(screen.getByLabelText(/OneYear-Opp/)).toHaveTextContent(/1y/);
    });
  });
});
