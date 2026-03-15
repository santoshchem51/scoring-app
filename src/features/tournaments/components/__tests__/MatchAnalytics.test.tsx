import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import MatchAnalytics from '../MatchAnalytics';
import type { ScoreEvent } from '../../../../data/types';

const makeEvent = (overrides: Partial<ScoreEvent> = {}): ScoreEvent => ({
  id: 'evt-1',
  matchId: 'match-1',
  gameNumber: 1,
  timestamp: Date.now(),
  type: 'POINT_SCORED',
  team: 1,
  team1Score: 1,
  team2Score: 0,
  ...overrides,
});

const defaultProps = {
  events: [] as ScoreEvent[],
  team1Name: 'Alpha',
  team2Name: 'Bravo',
};

describe('MatchAnalytics', () => {
  it('renders momentum bar with correct percentages', () => {
    // 3 points team 1, 1 point team 2 → 75% / 25%
    const events = [
      makeEvent({ id: 'e1', team: 1, team1Score: 1, team2Score: 0 }),
      makeEvent({ id: 'e2', team: 1, team1Score: 2, team2Score: 0 }),
      makeEvent({ id: 'e3', team: 1, team1Score: 3, team2Score: 0 }),
      makeEvent({ id: 'e4', team: 2, team1Score: 3, team2Score: 1 }),
    ];
    render(() => <MatchAnalytics {...defaultProps} events={events} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('shows "50% / 50%" when no events', () => {
    render(() => <MatchAnalytics {...defaultProps} />);
    const fiftyTexts = screen.getAllByText('50%');
    expect(fiftyTexts.length).toBe(2);
  });

  it('renders run-of-play indicators with correct shapes', () => {
    const events = [
      makeEvent({ id: 'e1', team: 1, team1Score: 1, team2Score: 0 }),
      makeEvent({ id: 'e2', team: 2, team1Score: 1, team2Score: 1 }),
      makeEvent({ id: 'e3', team: 1, team1Score: 2, team2Score: 1 }),
    ];
    render(() => <MatchAnalytics {...defaultProps} events={events} />);
    const runOfPlay = screen.getByLabelText('Run of play');
    const text = runOfPlay.textContent!;
    // Team 1 → ●, Team 2 → ■
    expect(text).toContain('●');
    expect(text).toContain('■');
  });

  it('shows streak text when streak >= 3', () => {
    const events = [
      makeEvent({ id: 'e1', team: 1, team1Score: 1, team2Score: 0 }),
      makeEvent({ id: 'e2', team: 1, team1Score: 2, team2Score: 0 }),
      makeEvent({ id: 'e3', team: 1, team1Score: 3, team2Score: 0 }),
    ];
    render(() => <MatchAnalytics {...defaultProps} events={events} />);
    expect(screen.getByText(/Alpha on a 3-0 run/)).toBeInTheDocument();
  });

  it('hides streak text when no streak', () => {
    const events = [
      makeEvent({ id: 'e1', team: 1, team1Score: 1, team2Score: 0 }),
      makeEvent({ id: 'e2', team: 2, team1Score: 1, team2Score: 1 }),
    ];
    render(() => <MatchAnalytics {...defaultProps} events={events} />);
    expect(screen.queryByText(/on a \d+-0 run/)).toBeNull();
  });

  it('renders SVG chart with aria-hidden="true"', () => {
    const events = [
      makeEvent({ id: 'e1', team: 1, team1Score: 1, team2Score: 0 }),
      makeEvent({ id: 'e2', team: 2, team1Score: 1, team2Score: 1 }),
    ];
    render(() => <MatchAnalytics {...defaultProps} events={events} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders hidden data table for screen readers', () => {
    const events = [
      makeEvent({ id: 'e1', team: 1, team1Score: 1, team2Score: 0 }),
      makeEvent({ id: 'e2', team: 2, team1Score: 1, team2Score: 1 }),
    ];
    render(() => <MatchAnalytics {...defaultProps} events={events} />);
    const table = document.querySelector('table.sr-only');
    expect(table).toBeTruthy();
    expect(table!.textContent).toContain('Alpha');
    expect(table!.textContent).toContain('Bravo');
    expect(table!.textContent).toContain('1');
  });

  it('shows defaults gracefully with empty events', () => {
    render(() => <MatchAnalytics {...defaultProps} />);
    // Should render without errors, momentum at 50/50
    const fiftyTexts = screen.getAllByText('50%');
    expect(fiftyTexts.length).toBe(2);
    // No streak text
    expect(screen.queryByText(/on a \d+-0 run/)).toBeNull();
    // SVG chart still present
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
