import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';

// Mock @solidjs/router
vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

// Mock firestoreTournamentRepository — returns empty by default
vi.mock('../../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    getPublicTournaments: vi.fn(() =>
      Promise.resolve({ tournaments: [], lastDoc: null }),
    ),
  },
}));

// Mock discoveryFilters — pass-through by default
vi.mock('../../engine/discoveryFilters', () => ({
  filterPublicTournaments: vi.fn((tournaments: any[]) => tournaments),
}));

// Import component after mocks
import BrowseTab from '../BrowseTab';

describe('BrowseTab', () => {
  it('renders search input with correct placeholder', () => {
    render(() => <BrowseTab />);
    const input = screen.getByPlaceholderText('Search name or location...');
    expect(input).toBeInTheDocument();
  });

  it('renders status filter dropdown', () => {
    render(() => <BrowseTab />);
    const select = screen.getByLabelText('Filter by status');
    expect(select).toBeInTheDocument();
  });

  it('renders format filter dropdown', () => {
    render(() => <BrowseTab />);
    const select = screen.getByLabelText('Filter by format');
    expect(select).toBeInTheDocument();
  });

  it('shows empty state when no tournaments', async () => {
    render(() => <BrowseTab />);
    // Wait for the resource to resolve (empty array)
    const emptyTitle = await screen.findByText('No tournaments found');
    expect(emptyTitle).toBeInTheDocument();
  });
});
