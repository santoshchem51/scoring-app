import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import LiveNowSection from '../LiveNowSection';
import type { LiveNowMatch, UpcomingMatch } from '../LiveNowSection';

const makeMatch = (overrides: Partial<LiveNowMatch> & { matchId: string }): LiveNowMatch => ({
  team1Name: 'Team A',
  team2Name: 'Team B',
  status: 'in-progress' as const,
  ...overrides,
});

const defaultMatches: LiveNowMatch[] = [
  makeMatch({ matchId: 'm1', team1Name: 'Sarah', team2Name: 'Mike', court: '1' }),
  makeMatch({ matchId: 'm2', team1Name: 'Alex', team2Name: 'Pat', court: '3' }),
];

describe('LiveNowSection', () => {
  it('returns null when matches is empty', () => {
    const { container } = render(() => (
      <LiveNowSection matches={[]} tournamentCode="ABC" />
    ));
    expect(container.innerHTML).toBe('');
  });

  it('renders section header "LIVE NOW" with red dot', () => {
    render(() => (
      <LiveNowSection matches={defaultMatches} tournamentCode="ABC" />
    ));
    expect(screen.getByText('LIVE NOW')).toBeInTheDocument();
    // Red dot is a visual indicator element
    const header = screen.getByText('LIVE NOW').closest('[data-testid="live-now-header"]');
    expect(header).toBeInTheDocument();
    expect(header!.querySelector('[data-testid="live-dot"]')).toBeInTheDocument();
  });

  it('renders match cards as <a> elements with correct hrefs', () => {
    render(() => (
      <LiveNowSection matches={defaultMatches} tournamentCode="ABC" />
    ));
    const links = screen.getAllByRole('link');
    // Filter to match links only (exclude overflow)
    const matchLinks = links.filter((l) => l.getAttribute('href')?.includes('/match/'));
    expect(matchLinks).toHaveLength(2);
    expect(matchLinks[0].getAttribute('href')).toBe('/t/ABC/match/m1');
    expect(matchLinks[1].getAttribute('href')).toBe('/t/ABC/match/m2');
  });

  it('shows court number when available', () => {
    render(() => (
      <LiveNowSection
        matches={[makeMatch({ matchId: 'm1', court: '1', team1Name: 'Sarah', team2Name: 'Mike' })]}
        tournamentCode="ABC"
      />
    ));
    expect(screen.getByText(/Ct 1/)).toBeInTheDocument();
  });

  it('shows "LIVE" badge for in-progress matches', () => {
    render(() => (
      <LiveNowSection
        matches={[makeMatch({ matchId: 'm1', status: 'in-progress' })]}
        tournamentCode="ABC"
      />
    ));
    // The badge within the card (not the header)
    const list = screen.getByRole('list');
    expect(list.textContent).toContain('LIVE');
  });

  it('shows "FINAL" badge for completed matches', () => {
    render(() => (
      <LiveNowSection
        matches={[makeMatch({ matchId: 'm1', status: 'completed' })]}
        tournamentCode="ABC"
      />
    ));
    const list = screen.getByRole('list');
    expect(list.textContent).toContain('FINAL');
  });

  it('caps at 3 visible cards', () => {
    const matches = [
      makeMatch({ matchId: 'm1', court: '1' }),
      makeMatch({ matchId: 'm2', court: '2' }),
      makeMatch({ matchId: 'm3', court: '3' }),
      makeMatch({ matchId: 'm4', court: '4' }),
      makeMatch({ matchId: 'm5', court: '5' }),
    ];
    render(() => (
      <LiveNowSection matches={matches} tournamentCode="ABC" />
    ));
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
  });

  it('shows overflow indicator "N more live" when > 3 matches', () => {
    const matches = [
      makeMatch({ matchId: 'm1' }),
      makeMatch({ matchId: 'm2' }),
      makeMatch({ matchId: 'm3' }),
      makeMatch({ matchId: 'm4' }),
      makeMatch({ matchId: 'm5' }),
    ];
    render(() => (
      <LiveNowSection matches={matches} tournamentCode="ABC" />
    ));
    expect(screen.getByText(/2 more live/)).toBeInTheDocument();
  });

  it('hides overflow when <= 3 matches', () => {
    render(() => (
      <LiveNowSection matches={defaultMatches} tournamentCode="ABC" />
    ));
    expect(screen.queryByText(/more live/)).toBeNull();
  });

  it('cards have comprehensive aria-label', () => {
    render(() => (
      <LiveNowSection
        matches={[makeMatch({ matchId: 'm1', team1Name: 'Sarah', team2Name: 'Mike', court: '1', status: 'in-progress' })]}
        tournamentCode="ABC"
      />
    ));
    const link = screen.getByRole('link', { name: /Court 1: Sarah versus Mike, live/i });
    expect(link).toBeInTheDocument();
  });

  it('uses <ul> list structure', () => {
    render(() => (
      <LiveNowSection matches={defaultMatches} tournamentCode="ABC" />
    ));
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].tagName).toBe('LI');
  });

  // --- Up Next tests ---

  const upcomingMatches: UpcomingMatch[] = [
    { team1Name: 'Lisa', team2Name: 'Tom', court: '2' },
    { team1Name: 'Jane', team2Name: 'Bob', scheduledTime: 'Starts in ~15 min' },
  ];

  it('shows "UP NEXT" header when no live matches but upcoming matches exist', () => {
    render(() => (
      <LiveNowSection matches={[]} tournamentCode="ABC" upcomingMatches={upcomingMatches} />
    ));
    expect(screen.getByText('UP NEXT')).toBeInTheDocument();
    expect(screen.queryByText('LIVE NOW')).toBeNull();
  });

  it('shows upcoming match cards with team names', () => {
    render(() => (
      <LiveNowSection matches={[]} tournamentCode="ABC" upcomingMatches={upcomingMatches} />
    ));
    expect(screen.getByText(/Lisa vs Tom/)).toBeInTheDocument();
    expect(screen.getByText(/Jane vs Bob/)).toBeInTheDocument();
  });

  it('shows "UPCOMING" badge on upcoming cards', () => {
    render(() => (
      <LiveNowSection matches={[]} tournamentCode="ABC" upcomingMatches={upcomingMatches} />
    ));
    const list = screen.getByRole('list');
    expect(list.textContent).toContain('UPCOMING');
  });

  it('returns null when both live and upcoming are empty', () => {
    const { container } = render(() => (
      <LiveNowSection matches={[]} tournamentCode="ABC" upcomingMatches={[]} />
    ));
    expect(container.innerHTML).toBe('');
  });

  it('prefers live matches over upcoming when both exist', () => {
    render(() => (
      <LiveNowSection
        matches={defaultMatches}
        tournamentCode="ABC"
        upcomingMatches={upcomingMatches}
      />
    ));
    expect(screen.getByText('LIVE NOW')).toBeInTheDocument();
    expect(screen.queryByText('UP NEXT')).toBeNull();
    // Live match cards should be links
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('upcoming cards are not links', () => {
    render(() => (
      <LiveNowSection matches={[]} tournamentCode="ABC" upcomingMatches={upcomingMatches} />
    ));
    const links = screen.queryAllByRole('link');
    expect(links).toHaveLength(0);
  });

  it('caps upcoming matches at 3', () => {
    const manyUpcoming: UpcomingMatch[] = [
      { team1Name: 'A', team2Name: 'B' },
      { team1Name: 'C', team2Name: 'D' },
      { team1Name: 'E', team2Name: 'F' },
      { team1Name: 'G', team2Name: 'H' },
    ];
    render(() => (
      <LiveNowSection matches={[]} tournamentCode="ABC" upcomingMatches={manyUpcoming} />
    ));
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });
});
