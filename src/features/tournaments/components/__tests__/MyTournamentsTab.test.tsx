import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';
import type { Tournament } from '../../../../data/types';

// Mock @solidjs/router
vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
  useNavigate: () => () => {},
}));

// Mock firestoreTournamentRepository — returns empty by default
vi.mock('../../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    getByOrganizer: vi.fn().mockResolvedValue([]),
    getByParticipant: vi.fn().mockResolvedValue({ tournamentIds: [], registrationStatuses: new Map() }),
    getByScorekeeper: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock firestoreInvitationRepository (used by InvitationInbox)
vi.mock('../../../../data/firebase/firestoreInvitationRepository', () => ({
  firestoreInvitationRepository: {
    getPendingForUser: vi.fn().mockResolvedValue([]),
  },
}));

// Mock firestoreUserRepository (used by InvitationInbox)
vi.mock('../../../../data/firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: {
    getProfile: vi.fn().mockResolvedValue(null),
  },
}));

import MyTournamentsTab from '../MyTournamentsTab';
import { firestoreTournamentRepository } from '../../../../data/firebase/firestoreTournamentRepository';

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

describe('MyTournamentsTab', () => {
  it('renders role filter dropdown with correct aria-label', () => {
    render(() => <MyTournamentsTab userId="user1" />);
    const select = screen.getByLabelText('Filter by role');
    expect(select).toBeInTheDocument();
  });

  it('renders "+ New" button linking to /tournaments/new', () => {
    render(() => <MyTournamentsTab userId="user1" />);
    const link = screen.getByText('+ New');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/tournaments/new');
  });

  it('shows empty state when no tournaments', async () => {
    render(() => <MyTournamentsTab userId="user1" />);
    const emptyTitle = await screen.findByText('No tournaments yet');
    expect(emptyTitle).toBeInTheDocument();
  });

  it('shows tournaments with role badge when data loaded', async () => {
    const tournament = makeTournament({ id: 't1', name: 'Spring Classic' });
    vi.mocked(firestoreTournamentRepository.getByOrganizer).mockResolvedValue([tournament]);

    render(() => <MyTournamentsTab userId="user1" />);

    const name = await screen.findByText('Spring Classic');
    expect(name).toBeInTheDocument();

    const badge = await screen.findByText('Organizer');
    expect(badge).toBeInTheDocument();
  });
});
