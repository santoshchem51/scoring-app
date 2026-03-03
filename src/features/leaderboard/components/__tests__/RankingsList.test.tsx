import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import RankingsList from '../RankingsList';
import { makeLeaderboardEntry } from '../../../../test/factories';

describe('RankingsList', () => {
  it('renders entries with correct rank numbers starting from startRank', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u4', displayName: 'Player Four' }),
      makeLeaderboardEntry({ uid: 'u5', displayName: 'Player Five' }),
    ];
    render(() => <RankingsList entries={entries} startRank={4} />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Player Four')).toBeTruthy();
    expect(screen.getByText('Player Five')).toBeTruthy();
  });

  it('shows win rate as percentage', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u4', displayName: 'WinnerGal', winRate: 0.65 }),
    ];
    render(() => <RankingsList entries={entries} startRank={4} />);
    expect(screen.getByText('65%')).toBeTruthy();
  });

  it('shows win streak indicator in green', () => {
    const entries = [
      makeLeaderboardEntry({
        uid: 'u4',
        displayName: 'Streaker',
        currentStreak: { type: 'W', count: 3 },
      }),
    ];
    const { container } = render(() => <RankingsList entries={entries} startRank={4} />);
    const streakEl = screen.getByText('W3');
    expect(streakEl).toBeTruthy();
    expect(streakEl.className).toContain('text-green');
  });

  it('shows loss streak indicator in red', () => {
    const entries = [
      makeLeaderboardEntry({
        uid: 'u4',
        displayName: 'Losing',
        currentStreak: { type: 'L', count: 2 },
      }),
    ];
    render(() => <RankingsList entries={entries} startRank={4} />);
    const streakEl = screen.getByText('L2');
    expect(streakEl).toBeTruthy();
    expect(streakEl.className).toContain('text-red');
  });

  it('handles empty entries list', () => {
    const { container } = render(() => <RankingsList entries={[]} startRank={4} />);
    expect(container.textContent).toBe('');
  });

  it('renders composite score for each entry', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u4', displayName: 'Scorer', compositeScore: 72.3 }),
    ];
    const { container } = render(() => <RankingsList entries={entries} startRank={4} />);
    expect(container.textContent).toContain('72.3');
  });

  it('renders avatar initial when no photoURL', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u4', displayName: 'Maria', photoURL: null }),
    ];
    render(() => <RankingsList entries={entries} startRank={4} />);
    expect(screen.getByText('M')).toBeTruthy();
  });

  it('renders tier badge for each entry', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u4', displayName: 'Expert', tier: 'advanced' }),
    ];
    render(() => <RankingsList entries={entries} startRank={4} />);
    expect(screen.getByText('advanced')).toBeTruthy();
  });

  it('highlights current user row with primary border', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u4', displayName: 'Someone' }),
      makeLeaderboardEntry({ uid: 'u5', displayName: 'Me' }),
    ];
    const { container } = render(() => (
      <RankingsList entries={entries} startRank={4} currentUserUid="u5" />
    ));
    const rows = container.querySelectorAll('.rounded-xl');
    // First row (u4) should NOT have primary border
    expect(rows[0].className).toContain('border-border');
    // Second row (u5) should have primary border
    expect(rows[1].className).toContain('border-primary/30');
  });

  it('hides streak when count is zero', () => {
    const entries = [
      makeLeaderboardEntry({
        uid: 'u4',
        displayName: 'NoStreak',
        currentStreak: { type: 'W', count: 0 },
      }),
    ];
    const { container } = render(() => <RankingsList entries={entries} startRank={4} />);
    // Should not render W0 or L0
    expect(container.textContent).not.toContain('W0');
    expect(container.textContent).not.toContain('L0');
  });
});
