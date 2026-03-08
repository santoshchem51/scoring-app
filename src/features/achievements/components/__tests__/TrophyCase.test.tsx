import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import TrophyCase from '../TrophyCase';
import { ACHIEVEMENT_DEFINITIONS } from '../../engine/badgeDefinitions';
import type { StatsSummary, CachedAchievement } from '../../../../data/types';

function makeStats(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: { type: 'W', count: 0 },
    bestWinStreak: 0,
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: [],
    tier: 'beginner',
    tierConfidence: 'low',
    tierUpdatedAt: 0,
    lastPlayedAt: 0,
    updatedAt: 0,
    uniqueOpponentUids: [],
    ...overrides,
  };
}

function makeCachedAchievement(achievementId: string): CachedAchievement {
  return {
    achievementId,
    unlockedAt: Date.now(),
    triggerMatchId: 'match-1',
    triggerContext: { type: 'stats', field: 'totalMatches', value: 1 },
    toastShown: 1,
    syncedAt: Date.now(),
  };
}

describe('TrophyCase', () => {
  it('renders section heading with unlocked count', () => {
    render(() => <TrophyCase unlocked={[]} stats={makeStats()} />);

    const totalCount = ACHIEVEMENT_DEFINITIONS.length;
    expect(screen.getByText(`Achievements (0/${totalCount})`)).toBeInTheDocument();
  });

  it('renders category headers (Milestones, Streaks, etc.)', () => {
    render(() => <TrophyCase unlocked={[]} stats={makeStats()} />);

    expect(screen.getByText('Milestones')).toBeInTheDocument();
    expect(screen.getByText('Streaks')).toBeInTheDocument();
    expect(screen.getByText('Improvement')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Moments')).toBeInTheDocument();
    expect(screen.getByText('Consistency')).toBeInTheDocument();
  });

  it('shows "Show X more locked" button when there are collapsed locked badges', () => {
    render(() => <TrophyCase unlocked={[]} stats={makeStats()} />);

    // Milestones has 5 badges, all locked, so it shows 1 (next achievable) + button for the rest
    // "Show 4 more locked" for milestones (5 total - 1 shown = 4 hidden)
    const buttons = screen.getAllByText(/Show \d+ more locked/);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders unlocked badge when provided', () => {
    const unlocked = [makeCachedAchievement('first_rally')];
    render(() => <TrophyCase unlocked={unlocked} stats={makeStats({ totalMatches: 1 })} />);

    expect(screen.getByText('First Rally')).toBeInTheDocument();
  });

  // Gap #8: Expand/collapse interaction tests
  it('clicking "Show N more locked" reveals all locked badges in category', async () => {
    render(() => <TrophyCase unlocked={[]} stats={makeStats()} />);

    // Find "Show X more locked" button for milestones (5 total, 1 shown = 4 more)
    const expandButton = screen.getAllByText(/Show \d+ more locked/)[0];
    fireEvent.click(expandButton);

    // After expanding, the "Hide locked" button should appear
    expect(screen.getAllByText('Hide locked').length).toBeGreaterThan(0);
  });

  it('clicking "Hide locked" collapses back to default view', async () => {
    render(() => <TrophyCase unlocked={[]} stats={makeStats()} />);

    // Expand first
    const expandButton = screen.getAllByText(/Show \d+ more locked/)[0];
    fireEvent.click(expandButton);

    // Then collapse
    const collapseButton = screen.getAllByText('Hide locked')[0];
    fireEvent.click(collapseButton);

    // "Show X more locked" should reappear
    expect(screen.getAllByText(/Show \d+ more locked/).length).toBeGreaterThan(0);
  });
});
