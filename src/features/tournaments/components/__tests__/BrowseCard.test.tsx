import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';
import type { Tournament } from '../../../../data/types';

// Mock @solidjs/router — A renders as a plain anchor
vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

// Import component after mocks
import BrowseCard from '../BrowseCard';

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
    accessMode: 'open' as const,
    listed: true,
    buddyGroupId: null,
    buddyGroupName: null,
    registrationCounts: { confirmed: 0, pending: 0 },
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
    ...overrides,
  };
}

function renderCard(tournament: Tournament) {
  return render(() => <BrowseCard tournament={tournament} />);
}

describe('BrowseCard', () => {
  it('renders tournament name', () => {
    renderCard(makeTournament({ name: 'Spring Classic' }));
    expect(screen.getByText('Spring Classic')).toBeInTheDocument();
  });

  it('renders date and location', () => {
    renderCard(makeTournament({
      date: new Date('2026-03-15T12:00:00Z').getTime(),
      location: 'Central Park Courts',
    }));
    expect(screen.getByText(/Mar 15, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Central Park Courts/)).toBeInTheDocument();
  });

  it('renders format label', () => {
    renderCard(makeTournament({ format: 'round-robin' }));
    expect(screen.getByText('Round Robin')).toBeInTheDocument();
  });

  it('renders status label', () => {
    renderCard(makeTournament({ status: 'registration' }));
    expect(screen.getByText('Registration Open')).toBeInTheDocument();
  });

  it('renders registration count with maxPlayers', () => {
    renderCard(makeTournament({
      maxPlayers: 16,
      registrationCounts: { confirmed: 8, pending: 0 },
    }));
    expect(screen.getByText('8/16 registered')).toBeInTheDocument();
  });

  it('renders registration count without maxPlayers', () => {
    renderCard(makeTournament({
      maxPlayers: null,
      registrationCounts: { confirmed: 5, pending: 0 },
    }));
    expect(screen.getByText('5 registered')).toBeInTheDocument();
  });

  it('links to /t/:shareCode when shareCode exists', () => {
    renderCard(makeTournament({ shareCode: 'ABC123' }));
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/t/ABC123');
  });

  it('fallback link to /tournaments/:id when no shareCode', () => {
    renderCard(makeTournament({ id: 't42', shareCode: null }));
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/tournaments/t42');
  });

  it('shows 0 registered when counts are zero', () => {
    renderCard(makeTournament({
      maxPlayers: null,
      registrationCounts: { confirmed: 0, pending: 0 },
    }));
    expect(screen.getByText('0 registered')).toBeInTheDocument();
  });

  it('shows access mode badge for approval tournaments', () => {
    renderCard(makeTournament({ accessMode: 'approval', listed: true }));
    expect(screen.getByText('Approval Required')).toBeTruthy();
  });

  it('shows no access mode badge for open tournaments', () => {
    renderCard(makeTournament({ accessMode: 'open', listed: true }));
    expect(screen.queryByText('Approval Required')).toBeNull();
    expect(screen.queryByText('Invite Only')).toBeNull();
  });

  it('shows pending count for approval mode', () => {
    renderCard(makeTournament({
      accessMode: 'approval',
      listed: true,
      registrationCounts: { confirmed: 12, pending: 3 },
    }));
    expect(screen.getByText('12 registered, 3 pending')).toBeTruthy();
  });
});
