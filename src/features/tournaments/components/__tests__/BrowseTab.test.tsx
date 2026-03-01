import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../../../data/types';

// Mock @solidjs/router
vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

const mockGetPublicTournaments = vi.fn((_pageSize?: number, _cursor?: unknown) =>
  Promise.resolve({ tournaments: [] as Tournament[], lastDoc: null }),
);

// Mock firestoreTournamentRepository — returns empty by default
vi.mock('../../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    getPublicTournaments: (pageSize?: number, cursor?: unknown) => mockGetPublicTournaments(pageSize, cursor),
  },
}));

const mockFilterPublicTournaments = vi.fn((tournaments: Tournament[], _filters?: any) => tournaments);

// Mock discoveryFilters — pass-through by default
vi.mock('../../engine/discoveryFilters', () => ({
  filterPublicTournaments: (tournaments: Tournament[], filters: any) =>
    mockFilterPublicTournaments(tournaments, filters),
}));

// Import component after mocks
import BrowseTab from '../BrowseTab';

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'Spring Classic',
    date: new Date('2026-03-15T12:00:00Z').getTime(),
    location: 'Central Park Courts',
    format: 'round-robin',
    config: {
      gameType: 'doubles',
      scoringMode: 'rally',
      matchFormat: 'best-of-3',
      pointsToWin: 11,
      poolCount: 2,
      teamsPerPoolAdvancing: 2,
    },
    organizerId: 'org1',
    scorekeeperIds: [],
    status: 'registration',
    maxPlayers: 16,
    teamFormation: 'byop',
    minPlayers: 4,
    entryFee: null,
    rules: {
      registrationDeadline: null,
      checkInRequired: false,
      checkInOpens: null,
      checkInCloses: null,
      scoringRules: '',
      timeoutRules: '',
      conductRules: '',
      penalties: [],
      additionalNotes: '',
    },
    pausedFrom: null,
    cancellationReason: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    visibility: 'public',
    shareCode: 'ABC123',
    accessMode: 'open',
    listed: true,
    buddyGroupId: null,
    buddyGroupName: null,
    registrationCounts: { confirmed: 0, pending: 0 },
    ...overrides,
  };
}

describe('BrowseTab', () => {
  beforeEach(() => {
    mockGetPublicTournaments.mockReset();
    mockFilterPublicTournaments.mockReset();
    // Default: empty tournaments, pass-through filter
    mockGetPublicTournaments.mockResolvedValue({ tournaments: [], lastDoc: null });
    mockFilterPublicTournaments.mockImplementation((tournaments: Tournament[]) => tournaments);
  });

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

  it('shows "no tournaments yet" empty state when no public tournaments exist', async () => {
    mockGetPublicTournaments.mockResolvedValue({ tournaments: [], lastDoc: null });
    render(() => <BrowseTab />);
    const emptyTitle = await screen.findByText('No tournaments yet');
    expect(emptyTitle).toBeInTheDocument();
    expect(screen.getByText('Be the first to create one!')).toBeInTheDocument();
    expect(screen.getByText('Create Tournament')).toBeInTheDocument();
  });

  it('shows "no tournaments found" empty state when filters yield no results', async () => {
    const tournaments = [makeTournament()];
    mockGetPublicTournaments.mockResolvedValue({ tournaments, lastDoc: null });
    // The filter returns nothing (simulating no match)
    mockFilterPublicTournaments.mockReturnValue([]);
    render(() => <BrowseTab />);
    const emptyTitle = await screen.findByText('No tournaments found');
    expect(emptyTitle).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your filters/)).toBeInTheDocument();
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });
});
