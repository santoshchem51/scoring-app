import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import StatsOverview from '../components/StatsOverview';
import type { StatsSummary } from '../../../data/types';

function makeStats(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 10,
    wins: 7,
    losses: 3,
    winRate: 0.7,
    currentStreak: { type: 'W', count: 3 },
    bestWinStreak: 5,
    singles: { matches: 6, wins: 4, losses: 2 },
    doubles: { matches: 4, wins: 3, losses: 1 },
    recentResults: [],
    tier: 'intermediate',
    tierConfidence: 'medium',
    tierUpdatedAt: 2000000,
    lastPlayedAt: 3000000,
    updatedAt: 3000000,
    ...overrides,
  };
}

describe('StatsOverview', () => {
  it('displays win rate as percentage', () => {
    render(() => <StatsOverview stats={makeStats({ winRate: 0.7 })} />);
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('displays 0% win rate', () => {
    render(() => <StatsOverview stats={makeStats({ winRate: 0 })} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('displays total matches count', () => {
    render(() => <StatsOverview stats={makeStats({ totalMatches: 10 })} />);
    expect(screen.getByLabelText('Total matches: 10')).toBeTruthy();
  });

  it('displays current win streak', () => {
    render(() => <StatsOverview stats={makeStats({ currentStreak: { type: 'W', count: 3 } })} />);
    expect(screen.getByText('W3')).toBeTruthy();
  });

  it('displays current loss streak', () => {
    render(() => <StatsOverview stats={makeStats({ currentStreak: { type: 'L', count: 2 } })} />);
    expect(screen.getByText('L2')).toBeTruthy();
  });

  it('displays dash for zero streak', () => {
    render(() => <StatsOverview stats={makeStats({ currentStreak: { type: 'W', count: 0 } })} />);
    expect(screen.getByLabelText(/Current streak/)).toHaveTextContent('—');
  });

  it('displays best win streak', () => {
    render(() => <StatsOverview stats={makeStats({ bestWinStreak: 5 })} />);
    expect(screen.getByText('W5')).toBeTruthy();
  });

  it('displays singles/doubles breakdown', () => {
    render(() => <StatsOverview stats={makeStats()} />);
    expect(screen.getByText(/Singles 4W/)).toBeTruthy();
    expect(screen.getByText(/Doubles 3W/)).toBeTruthy();
  });
});
