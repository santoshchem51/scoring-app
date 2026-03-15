import { render, screen, waitFor } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';

// --- Mocks (must be before component imports) ---

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ code: 'ABC123', matchId: 'match-1' }),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock('../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    getByShareCode: vi.fn().mockResolvedValue({ id: 'tourney-1', name: 'Test Tourney' }),
  },
}));

vi.mock('../hooks/useLiveMatch', () => ({
  useLiveMatch: () => ({
    match: () => ({
      id: 'match-1',
      tournamentId: 'tourney-1',
      team1Name: 'Team Alpha',
      team2Name: 'Team Beta',
      status: 'in-progress',
      games: [],
      lastSnapshot: null,
      config: { gameType: 'doubles' },
    }),
    loading: () => false,
  }),
}));

vi.mock('../hooks/useScoreEventStream', () => ({
  useScoreEventStream: () => ({
    events: () => [],
    loading: () => false,
  }),
}));

vi.mock('../hooks/useSpectatorProjection', () => ({
  useSpectatorProjection: () => ({
    projection: () => undefined,
    loading: () => false,
  }),
}));

vi.mock('../engine/scoreExtraction', () => ({
  extractLiveScore: () => ({ team1Score: 5, team2Score: 3 }),
  extractGameCount: () => ({ team1Wins: 1, team2Wins: 0 }),
}));

vi.mock('../components/SpectatorScoreboard', () => ({
  default: () => <div data-testid="spectator-scoreboard">Scoreboard</div>,
}));

vi.mock('../components/PlayByPlayFeed', () => ({
  default: () => <div data-testid="play-by-play-feed">Feed</div>,
}));

vi.mock('../components/MatchAnalytics', () => ({
  default: () => <div data-testid="match-analytics">Analytics</div>,
}));

vi.mock('../../../shared/components/SegmentedControl', () => ({
  SegmentedControl: () => <div data-testid="segmented-control">Tabs</div>,
}));

import PublicMatchPage from '../PublicMatchPage';

describe('PublicMatchPage', () => {
  it('renders without crashing', async () => {
    const { container } = render(() => <PublicMatchPage />);

    // Wait for resource to resolve and component to render
    await waitFor(() => {
      expect(screen.getByTestId('spectator-scoreboard')).toBeInTheDocument();
    });
  });

  it('shows back link to tournament page', async () => {
    render(() => <PublicMatchPage />);

    const backLink = await screen.findByText(/Back to Tournament/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/t/ABC123');
  });
});
