import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import AchievementBadge from '../AchievementBadge';
import type { AchievementDisplayItem } from '../AchievementBadge';

function makeUnlockedItem(overrides: Partial<AchievementDisplayItem> = {}): AchievementDisplayItem {
  return {
    id: 'first_rally',
    name: 'First Rally',
    description: 'Play your first match',
    icon: '\uD83C\uDFD3',
    tier: 'bronze',
    unlocked: true,
    unlockedAt: Date.now(),
    ...overrides,
  };
}

function makeLockedItem(overrides: Partial<AchievementDisplayItem> = {}): AchievementDisplayItem {
  return {
    id: 'century_club',
    name: 'Century Club',
    description: 'Play 100 matches',
    icon: '\uD83D\uDCAF',
    tier: 'gold',
    unlocked: false,
    progress: { current: 42, target: 100 },
    ...overrides,
  };
}

describe('AchievementBadge', () => {
  it('renders unlocked badge with name and tier label', () => {
    render(() => <AchievementBadge item={makeUnlockedItem()} />);

    expect(screen.getByText('First Rally')).toBeInTheDocument();
    expect(screen.getByText('bronze')).toBeInTheDocument();
  });

  it('renders lock icon for locked badges', () => {
    render(() => <AchievementBadge item={makeLockedItem()} />);

    // The lock emoji is rendered instead of the badge icon for locked items
    expect(screen.getByText('\uD83D\uDD12')).toBeInTheDocument();
  });

  it('shows progress bar for locked badge with progress', () => {
    const { container } = render(() => (
      <AchievementBadge item={makeLockedItem({ progress: { current: 42, target: 100 } })} />
    ));

    // Progress bar container has a specific width style based on progress
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).not.toBeNull();
    expect(progressBar!.getAttribute('style')).toContain('42%');
  });

  it('does not show progress bar for unlocked badge', () => {
    const { container } = render(() => (
      <AchievementBadge item={makeUnlockedItem()} />
    ));

    // No progress bar inner element with width style should exist
    const progressBar = container.querySelector('.h-1 [style*="width"]');
    expect(progressBar).toBeNull();
  });

  it('has aria-disabled="true" for locked badges', () => {
    render(() => <AchievementBadge item={makeLockedItem()} />);

    const listitem = screen.getByRole('listitem');
    expect(listitem).toHaveAttribute('aria-disabled', 'true');
  });

  it('has correct aria-label including progress info for locked badges', () => {
    render(() => (
      <AchievementBadge item={makeLockedItem({ progress: { current: 42, target: 100 } })} />
    ));

    const listitem = screen.getByRole('listitem');
    expect(listitem.getAttribute('aria-label')).toContain('Century Club');
    expect(listitem.getAttribute('aria-label')).toContain('locked');
    expect(listitem.getAttribute('aria-label')).toContain('Progress: 42 of 100');
  });

  it('has role="listitem"', () => {
    render(() => <AchievementBadge item={makeUnlockedItem()} />);

    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });
});
