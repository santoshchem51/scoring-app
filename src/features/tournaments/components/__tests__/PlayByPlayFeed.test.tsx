import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import PlayByPlayFeed from '../PlayByPlayFeed';
import type { ScoreEvent } from '../../../../data/types';

const makeEvent = (overrides: Partial<ScoreEvent> = {}): ScoreEvent => ({
  id: 'evt-1',
  matchId: 'match-1',
  gameNumber: 1,
  timestamp: Date.now() - 30000,
  type: 'POINT_SCORED',
  team: 1,
  team1Score: 1,
  team2Score: 0,
  ...overrides,
});

const defaultProps = {
  events: [] as ScoreEvent[],
  team1Name: 'Alice',
  team2Name: 'Bob',
};

describe('PlayByPlayFeed', () => {
  it('renders empty state when no events', () => {
    render(() => <PlayByPlayFeed {...defaultProps} />);
    expect(screen.getByText('No events yet')).toBeInTheDocument();
  });

  it('renders event list with correct team names for POINT_SCORED', () => {
    const events = [
      makeEvent({ id: 'e1', team: 1, type: 'POINT_SCORED', team1Score: 1, team2Score: 0 }),
      makeEvent({ id: 'e2', team: 2, type: 'POINT_SCORED', team1Score: 1, team2Score: 1 }),
    ];
    render(() => <PlayByPlayFeed {...defaultProps} events={events} />);
    expect(screen.getByText('Alice scores')).toBeInTheDocument();
    expect(screen.getByText('Bob scores')).toBeInTheDocument();
  });

  it('shows "Side out" text for SIDE_OUT events with muted styling', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'SIDE_OUT', team: 1, team1Score: 3, team2Score: 2 }),
    ];
    render(() => <PlayByPlayFeed {...defaultProps} events={events} />);
    const sideOut = screen.getByText('Side out');
    expect(sideOut).toBeInTheDocument();
    expect(sideOut).toHaveStyle({ color: '#4B5563' });
  });

  it('shows "Undo" text for UNDO events with italic styling', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'UNDO', team: 1, team1Score: 2, team2Score: 1 }),
    ];
    render(() => <PlayByPlayFeed {...defaultProps} events={events} />);
    const undo = screen.getByText('Undo');
    expect(undo).toBeInTheDocument();
    expect(undo).toHaveStyle({ 'font-style': 'italic', color: '#4B5563' });
  });

  it('shows running score right-aligned for each event', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'POINT_SCORED', team: 1, team1Score: 3, team2Score: 2 }),
    ];
    render(() => <PlayByPlayFeed {...defaultProps} events={events} />);
    const score = screen.getByText('3-2');
    expect(score).toBeInTheDocument();
    expect(score).toHaveStyle({ 'text-align': 'right' });
  });

  it('has role="log" and aria-label', () => {
    render(() => <PlayByPlayFeed {...defaultProps} />);
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-label', 'Play-by-play events');
  });

  it('uses ordered list <ol> element', () => {
    const events = [
      makeEvent({ id: 'e1', type: 'POINT_SCORED', team: 1, team1Score: 1, team2Score: 0 }),
    ];
    render(() => <PlayByPlayFeed {...defaultProps} events={events} />);
    const list = screen.getByRole('log').querySelector('ol');
    expect(list).toBeTruthy();
  });
});
