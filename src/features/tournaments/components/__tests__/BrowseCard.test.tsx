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

describe('BrowseCard', () => {
  it('renders tournament name', () => {
    const tournament = makeTournament({ name: 'Spring Classic' });
    render(() => <BrowseCard tournament={tournament} registrationCount={8} />);
    expect(screen.getByText('Spring Classic')).toBeInTheDocument();
  });

  it('renders date and location', () => {
    const tournament = makeTournament({
      date: new Date('2026-03-15T12:00:00Z').getTime(),
      location: 'Central Park Courts',
    });
    render(() => <BrowseCard tournament={tournament} registrationCount={5} />);
    expect(screen.getByText(/Mar 15, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Central Park Courts/)).toBeInTheDocument();
  });

  it('renders format label', () => {
    const tournament = makeTournament({ format: 'round-robin' });
    render(() => <BrowseCard tournament={tournament} registrationCount={3} />);
    expect(screen.getByText('Round Robin')).toBeInTheDocument();
  });

  it('renders status label', () => {
    const tournament = makeTournament({ status: 'registration' });
    render(() => <BrowseCard tournament={tournament} registrationCount={3} />);
    expect(screen.getByText('Registration Open')).toBeInTheDocument();
  });

  it('renders registration count with maxPlayers', () => {
    const tournament = makeTournament({ maxPlayers: 16 });
    render(() => <BrowseCard tournament={tournament} registrationCount={8} />);
    expect(screen.getByText('8/16 registered')).toBeInTheDocument();
  });

  it('renders registration count without maxPlayers', () => {
    const tournament = makeTournament({ maxPlayers: null });
    render(() => <BrowseCard tournament={tournament} registrationCount={5} />);
    expect(screen.getByText('5 registered')).toBeInTheDocument();
  });

  it('links to /t/:shareCode when shareCode exists', () => {
    const tournament = makeTournament({ shareCode: 'ABC123' });
    render(() => <BrowseCard tournament={tournament} registrationCount={2} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/t/ABC123');
  });

  it('fallback link to /tournaments/:id when no shareCode', () => {
    const tournament = makeTournament({ id: 't42', shareCode: null });
    render(() => <BrowseCard tournament={tournament} registrationCount={2} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/tournaments/t42');
  });
});
