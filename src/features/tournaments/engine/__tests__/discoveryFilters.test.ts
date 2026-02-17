import { describe, it, expect } from 'vitest';
import {
  filterPublicTournaments,
  mergeMyTournaments,
} from '../discoveryFilters';
import type { Tournament } from '../../../../data/types';
import type { MyTournamentEntry } from '../discoveryFilters';

// --- helpers ---

let idCounter = 0;

const makeTournament = (overrides: Partial<Tournament> = {}): Tournament => {
  idCounter++;
  return {
    id: `t${idCounter}`,
    name: `Tournament ${idCounter}`,
    date: Date.now() - idCounter * 86_400_000, // each one a day older
    location: 'Main Courts',
    format: 'round-robin',
    config: {
      gameType: 'doubles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount: 1,
      teamsPerPoolAdvancing: 2,
    },
    organizerId: 'org1',
    scorekeeperIds: [],
    status: 'setup',
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
    shareCode: null,
    ...overrides,
  };
};

// Reset counter before each describe block via fresh calls
beforeEach(() => {
  idCounter = 0;
});

// ================================================================
// filterPublicTournaments
// ================================================================

describe('filterPublicTournaments', () => {
  it('returns all tournaments when no filters are provided', () => {
    const tournaments = [makeTournament(), makeTournament(), makeTournament()];
    const result = filterPublicTournaments(tournaments, {});
    expect(result).toHaveLength(3);
  });

  it('filters by exact status', () => {
    const tournaments = [
      makeTournament({ status: 'setup' }),
      makeTournament({ status: 'registration' }),
      makeTournament({ status: 'pool-play' }),
      makeTournament({ status: 'completed' }),
    ];

    const result = filterPublicTournaments(tournaments, { status: 'completed' });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
  });

  it('filters by "upcoming" status (setup + registration)', () => {
    const tournaments = [
      makeTournament({ status: 'setup' }),
      makeTournament({ status: 'registration' }),
      makeTournament({ status: 'pool-play' }),
      makeTournament({ status: 'bracket' }),
      makeTournament({ status: 'completed' }),
    ];

    const result = filterPublicTournaments(tournaments, { status: 'upcoming' });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.status === 'setup' || t.status === 'registration')).toBe(true);
  });

  it('filters by "active" status (pool-play + bracket)', () => {
    const tournaments = [
      makeTournament({ status: 'setup' }),
      makeTournament({ status: 'registration' }),
      makeTournament({ status: 'pool-play' }),
      makeTournament({ status: 'bracket' }),
      makeTournament({ status: 'completed' }),
    ];

    const result = filterPublicTournaments(tournaments, { status: 'active' });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.status === 'pool-play' || t.status === 'bracket')).toBe(true);
  });

  it('returns all when status is "all"', () => {
    const tournaments = [
      makeTournament({ status: 'setup' }),
      makeTournament({ status: 'completed' }),
      makeTournament({ status: 'pool-play' }),
    ];

    const result = filterPublicTournaments(tournaments, { status: 'all' });
    expect(result).toHaveLength(3);
  });

  it('filters by format (exact match)', () => {
    const tournaments = [
      makeTournament({ format: 'round-robin' }),
      makeTournament({ format: 'single-elimination' }),
      makeTournament({ format: 'pool-bracket' }),
      makeTournament({ format: 'round-robin' }),
    ];

    const result = filterPublicTournaments(tournaments, { format: 'round-robin' });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.format === 'round-robin')).toBe(true);
  });

  it('filters by search text on name (case-insensitive)', () => {
    const tournaments = [
      makeTournament({ name: 'Summer Championship' }),
      makeTournament({ name: 'Winter Classic' }),
      makeTournament({ name: 'SUMMER Open' }),
    ];

    const result = filterPublicTournaments(tournaments, { search: 'summer' });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.name.toLowerCase().includes('summer'))).toBe(true);
  });

  it('filters by search text on location (case-insensitive)', () => {
    const tournaments = [
      makeTournament({ location: 'Central Park Courts' }),
      makeTournament({ location: 'Riverside Gym' }),
      makeTournament({ location: 'CENTRAL Arena' }),
    ];

    const result = filterPublicTournaments(tournaments, { search: 'central' });
    expect(result).toHaveLength(2);
  });

  it('combines multiple filters (status + format + search)', () => {
    const tournaments = [
      makeTournament({ name: 'Summer Slam', status: 'registration', format: 'round-robin' }),
      makeTournament({ name: 'Summer Open', status: 'setup', format: 'single-elimination' }),
      makeTournament({ name: 'Summer Bash', status: 'registration', format: 'round-robin' }),
      makeTournament({ name: 'Winter Cup', status: 'registration', format: 'round-robin' }),
      makeTournament({ name: 'Summer Finals', status: 'pool-play', format: 'round-robin' }),
    ];

    const result = filterPublicTournaments(tournaments, {
      status: 'upcoming',
      format: 'round-robin',
      search: 'summer',
    });

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name).sort()).toEqual(['Summer Bash', 'Summer Slam']);
  });

  it('returns empty array when nothing matches', () => {
    const tournaments = [
      makeTournament({ status: 'completed' }),
      makeTournament({ status: 'completed' }),
    ];

    const result = filterPublicTournaments(tournaments, { status: 'upcoming' });
    expect(result).toHaveLength(0);
  });
});

// ================================================================
// mergeMyTournaments
// ================================================================

describe('mergeMyTournaments', () => {
  it('merges and deduplicates by tournament ID', () => {
    const t1 = makeTournament({ id: 'shared-1' });
    const t2 = makeTournament({ id: 'unique-1' });
    const t3 = makeTournament({ id: 'shared-1' }); // same as t1

    const result = mergeMyTournaments({
      organized: [t1],
      participating: [t3, t2],
      scorekeeping: [],
    });

    const ids = result.map((e) => e.tournament.id);
    expect(ids).toContain('shared-1');
    expect(ids).toContain('unique-1');
    expect(result).toHaveLength(2);
  });

  it('assigns organizer role for organized tournaments', () => {
    const t = makeTournament({ id: 'org-t' });
    const result = mergeMyTournaments({
      organized: [t],
      participating: [],
      scorekeeping: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('organizer');
  });

  it('assigns player role for participating tournaments', () => {
    const t = makeTournament({ id: 'play-t' });
    const result = mergeMyTournaments({
      organized: [],
      participating: [t],
      scorekeeping: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('player');
  });

  it('assigns scorekeeper role for scorekeeping tournaments', () => {
    const t = makeTournament({ id: 'sk-t' });
    const result = mergeMyTournaments({
      organized: [],
      participating: [],
      scorekeeping: [t],
    });

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('scorekeeper');
  });

  it('uses priority organizer > scorekeeper > player when duplicated', () => {
    const t = makeTournament({ id: 'multi-role' });

    // Tournament appears in all three lists
    const result = mergeMyTournaments({
      organized: [t],
      participating: [t],
      scorekeeping: [t],
    });

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('organizer');

    // Scorekeeper > player
    const result2 = mergeMyTournaments({
      organized: [],
      participating: [t],
      scorekeeping: [t],
    });

    expect(result2).toHaveLength(1);
    expect(result2[0].role).toBe('scorekeeper');
  });

  it('sorts by date descending (newest first)', () => {
    const now = Date.now();
    const t1 = makeTournament({ id: 'old', date: now - 100_000 });
    const t2 = makeTournament({ id: 'new', date: now + 100_000 });
    const t3 = makeTournament({ id: 'mid', date: now });

    const result = mergeMyTournaments({
      organized: [t1, t2, t3],
      participating: [],
      scorekeeping: [],
    });

    expect(result.map((e) => e.tournament.id)).toEqual(['new', 'mid', 'old']);
  });

  it('works with all empty inputs', () => {
    const result = mergeMyTournaments({
      organized: [],
      participating: [],
      scorekeeping: [],
    });

    expect(result).toEqual([]);
  });
});
