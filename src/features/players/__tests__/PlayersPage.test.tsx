import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

vi.mock('../../../data/useLiveQuery', () => ({
  useLiveQuery: () => ({ data: () => [], error: () => undefined }),
}));

vi.mock('../../../shared/components/PageLayout', () => ({
  default: (props: { children: JSX.Element }) => <div>{props.children}</div>,
}));

vi.mock('../components/AddPlayerForm', () => ({
  default: () => <div data-testid="add-player-form">Add Player Form</div>,
}));

vi.mock('../components/PlayerCard', () => ({
  default: () => <div data-testid="player-card">Player Card</div>,
}));

vi.mock('../../../shared/components/EmptyState', () => ({
  default: (props: { title: string }) => <div>{props.title}</div>,
}));

vi.mock('../../leaderboard/components/LeaderboardTab', () => ({
  default: () => <div data-testid="leaderboard-tab">Leaderboard Content</div>,
}));

import PlayersPage from '../PlayersPage';

describe('PlayersPage tabs', () => {
  it('renders Players and Leaderboard tabs', () => {
    const { getByRole } = render(() => <PlayersPage />);
    expect(getByRole('tab', { name: 'Players' })).toBeDefined();
    expect(getByRole('tab', { name: 'Leaderboard' })).toBeDefined();
  });

  it('shows Players content by default', () => {
    const { getByRole } = render(() => <PlayersPage />);
    const playersTab = getByRole('tab', { name: 'Players' });
    expect(playersTab.getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tabpanel', { name: 'Players' })).toBeDefined();
  });

  it('switches to Leaderboard tab on click', async () => {
    const { getByRole, getByTestId } = render(() => <PlayersPage />);
    const leaderboardTab = getByRole('tab', { name: 'Leaderboard' });
    await fireEvent.click(leaderboardTab);
    expect(leaderboardTab.getAttribute('aria-selected')).toBe('true');
    expect(getByTestId('leaderboard-tab')).toBeDefined();
  });

  it('supports keyboard navigation between tabs', async () => {
    const { getByRole } = render(() => <PlayersPage />);
    const playersTab = getByRole('tab', { name: 'Players' });
    playersTab.focus();
    await fireEvent.keyDown(playersTab, { key: 'ArrowRight' });
    const leaderboardTab = getByRole('tab', { name: 'Leaderboard' });
    expect(leaderboardTab.getAttribute('aria-selected')).toBe('true');
  });

  it('has correct ARIA attributes on tabpanels', async () => {
    const { getByRole } = render(() => <PlayersPage />);
    const panel = getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-players');
    expect(panel.getAttribute('id')).toBe('panel-players');
  });
});
