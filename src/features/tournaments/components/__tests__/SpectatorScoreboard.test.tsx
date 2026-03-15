import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';
import { createSignal } from 'solid-js';
import SpectatorScoreboard from '../SpectatorScoreboard';

const defaultProps = {
  team1Name: 'Alice',
  team2Name: 'Bob',
  team1Score: 7,
  team2Score: 5,
  team1Wins: 1,
  team2Wins: 0,
  gameNumber: 2,
  status: 'in-progress' as const,
};

describe('SpectatorScoreboard', () => {
  it('renders team names and scores', () => {
    render(() => <SpectatorScoreboard {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows LIVE badge when status is in-progress', () => {
    render(() => <SpectatorScoreboard {...defaultProps} status="in-progress" />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('shows FINAL badge when status is completed', () => {
    render(() => <SpectatorScoreboard {...defaultProps} status="completed" />);
    expect(screen.getByText('FINAL')).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).toBeNull();
  });

  it('shows serving indicator on correct team', () => {
    render(() => <SpectatorScoreboard {...defaultProps} isServing={1} />);
    // The serving dot should be near team 1
    const servingIndicator = screen.getByText('(serving)');
    expect(servingIndicator).toBeInTheDocument();
    // The dot should be within the team 1 row
    const team1Row = screen.getByText('Alice').closest('[data-team]');
    expect(team1Row?.querySelector('[data-serving]')).toBeTruthy();
  });

  it('shows spectator count when > 10', () => {
    render(() => <SpectatorScoreboard {...defaultProps} spectatorCount={42} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('hides spectator count when <= 10', () => {
    render(() => <SpectatorScoreboard {...defaultProps} spectatorCount={5} />);
    // Should not show a spectator count element
    expect(screen.queryByTestId('spectator-count')).toBeNull();
  });

  it('shows skeleton when loading is true', () => {
    render(() => <SpectatorScoreboard {...defaultProps} loading={true} />);
    expect(screen.getByTestId('scoreboard-skeleton')).toBeInTheDocument();
    // Should not show real scores
    expect(screen.queryByText('Alice')).toBeNull();
  });

  it('shows context line when provided', () => {
    render(() => (
      <SpectatorScoreboard {...defaultProps} contextLine="Pool B · R3 · LIVE · 8 min" />
    ));
    expect(screen.getByText('Pool B · R3 · LIVE · 8 min')).toBeInTheDocument();
  });

  it('has role="region" and aria-label', () => {
    render(() => <SpectatorScoreboard {...defaultProps} />);
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-label', 'Live scoreboard');
  });

  it('shows "/" separator in team names when isDoubles', () => {
    render(() => (
      <SpectatorScoreboard
        {...defaultProps}
        team1Name="Alice / Carol"
        team2Name="Bob / Dave"
        isDoubles={true}
      />
    ));
    expect(screen.getByText('Alice / Carol')).toBeInTheDocument();
    expect(screen.getByText('Bob / Dave')).toBeInTheDocument();
  });

  it('shows flash overlay on team 1 when team1Score changes', async () => {
    vi.useFakeTimers();
    const [score, setScore] = createSignal(5);
    render(() => <SpectatorScoreboard {...defaultProps} team1Score={score()} />);

    const team1Row = screen.getByText('Alice').closest('[data-team="1"]')!;
    const flashOverlay = team1Row.querySelector('[data-testid="flash-overlay"]');
    expect(flashOverlay).toBeTruthy();
    // Initially no flash (opacity-0)
    expect(flashOverlay!.className).toContain('opacity-0');

    setScore(6);
    // After reactive update, flash should be active
    await vi.advanceTimersByTimeAsync(0);
    expect(flashOverlay!.className).toContain('opacity-100');

    // After 300ms, flash fades
    await vi.advanceTimersByTimeAsync(300);
    expect(flashOverlay!.className).toContain('opacity-0');

    vi.useRealTimers();
  });

  it('shows flash overlay on team 2 when team2Score changes', async () => {
    vi.useFakeTimers();
    const [score, setScore] = createSignal(3);
    render(() => <SpectatorScoreboard {...defaultProps} team2Score={score()} />);

    const team2Row = screen.getByText('Bob').closest('[data-team="2"]')!;
    const flashOverlay = team2Row.querySelector('[data-testid="flash-overlay"]');
    expect(flashOverlay).toBeTruthy();
    expect(flashOverlay!.className).toContain('opacity-0');

    setScore(4);
    await vi.advanceTimersByTimeAsync(0);
    expect(flashOverlay!.className).toContain('opacity-100');

    await vi.advanceTimersByTimeAsync(300);
    expect(flashOverlay!.className).toContain('opacity-0');

    vi.useRealTimers();
  });

  it('flash overlay has motion-reduce class', () => {
    render(() => <SpectatorScoreboard {...defaultProps} />);
    const team1Row = screen.getByText('Alice').closest('[data-team="1"]')!;
    const flashOverlay = team1Row.querySelector('[data-testid="flash-overlay"]');
    expect(flashOverlay!.className).toContain('motion-reduce:transition-none');
  });
});
