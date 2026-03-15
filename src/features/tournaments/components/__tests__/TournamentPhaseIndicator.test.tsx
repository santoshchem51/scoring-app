import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import TournamentPhaseIndicator from '../TournamentPhaseIndicator';

describe('TournamentPhaseIndicator', () => {
  it('shows phase label for pool-play', () => {
    render(() => <TournamentPhaseIndicator status="pool-play" liveMatchCount={0} />);
    expect(screen.getByText(/Pool Play/)).toBeTruthy();
  });

  it('shows phase label for bracket', () => {
    render(() => <TournamentPhaseIndicator status="bracket" liveMatchCount={0} />);
    expect(screen.getByText(/Bracket Play/)).toBeTruthy();
  });

  it('shows live match count when > 0', () => {
    render(() => <TournamentPhaseIndicator status="pool-play" liveMatchCount={8} />);
    expect(screen.getByText(/8 matches in progress/)).toBeTruthy();
  });

  it('hides live match count when 0', () => {
    render(() => <TournamentPhaseIndicator status="pool-play" liveMatchCount={0} />);
    expect(screen.queryByText(/matches in progress/)).toBeNull();
  });

  it('shows "Completed" for completed status', () => {
    render(() => <TournamentPhaseIndicator status="completed" liveMatchCount={0} />);
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.queryByText(/matches in progress/)).toBeNull();
  });

  it('shows round info when currentRound and totalRounds provided', () => {
    render(() => (
      <TournamentPhaseIndicator
        status="pool-play"
        liveMatchCount={8}
        currentRound={3}
        totalRounds={4}
      />
    ));
    expect(screen.getByText(/Round 3 of 4/)).toBeTruthy();
    expect(screen.getByText(/8 matches in progress/)).toBeTruthy();
  });

  it('omits round info when currentRound is undefined', () => {
    render(() => (
      <TournamentPhaseIndicator
        status="pool-play"
        liveMatchCount={5}
      />
    ));
    expect(screen.queryByText(/Round/)).toBeNull();
    expect(screen.getByText(/5 matches in progress/)).toBeTruthy();
  });

  it('omits round info when totalRounds is undefined', () => {
    render(() => (
      <TournamentPhaseIndicator
        status="pool-play"
        liveMatchCount={2}
        currentRound={1}
      />
    ));
    expect(screen.queryByText(/Round/)).toBeNull();
  });
});
