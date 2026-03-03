import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import LeaderboardTab from '../LeaderboardTab';

vi.mock('../../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'test-uid', displayName: 'Test User' }),
  }),
}));

vi.mock('../../hooks/useLeaderboard', () => ({
  useLeaderboard: () => ({
    entries: () => [],
    userEntry: () => null,
    userRank: () => null,
    loading: () => false,
    scope: () => 'global',
    setScope: vi.fn(),
    timeframe: () => 'allTime',
    setTimeframe: vi.fn(),
  }),
}));

describe('LeaderboardTab', () => {
  it('renders scope toggle group with Global and Friends', () => {
    const { getByText, getByRole } = render(() => <LeaderboardTab />);
    expect(getByText('Global')).toBeDefined();
    expect(getByText('Friends')).toBeDefined();
    expect(getByRole('group', { name: /scope/i })).toBeDefined();
  });

  it('renders timeframe toggle group with All Time and Last 30 Days', () => {
    const { getByText, getByRole } = render(() => <LeaderboardTab />);
    expect(getByText('All Time')).toBeDefined();
    expect(getByText('Last 30 Days')).toBeDefined();
    expect(getByRole('group', { name: /timeframe/i })).toBeDefined();
  });

  it('shows empty state when no entries', () => {
    const { getByText } = render(() => <LeaderboardTab />);
    expect(getByText(/No rankings yet/)).toBeDefined();
  });
});
