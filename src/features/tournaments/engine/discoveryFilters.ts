import type { Tournament, TournamentFormat, TournamentStatus } from '../../../data/types';

// --- Exported types ---

export type BrowseStatusFilter = 'all' | 'upcoming' | 'active' | 'completed' | TournamentStatus;

export interface BrowseFilters {
  status?: BrowseStatusFilter;
  format?: TournamentFormat;
  search?: string;
}

export type UserRole = 'organizer' | 'scorekeeper' | 'player';

export interface MyTournamentEntry {
  tournament: Tournament;
  role: UserRole;
}

// --- Status groups ---

const UPCOMING_STATUSES: ReadonlySet<TournamentStatus> = new Set(['setup', 'registration']);
const ACTIVE_STATUSES: ReadonlySet<TournamentStatus> = new Set(['pool-play', 'bracket']);

// --- Public API ---

/**
 * Filter a list of tournaments by status, format, and/or search text.
 * All filters are optional; when omitted they don't restrict results.
 */
export function filterPublicTournaments(
  tournaments: Tournament[],
  filters: BrowseFilters,
): Tournament[] {
  const { status, format, search } = filters;
  const searchLower = search?.toLowerCase();

  return tournaments.filter((t) => {
    // Status filter
    if (status !== undefined && status !== 'all') {
      if (status === 'upcoming') {
        if (!UPCOMING_STATUSES.has(t.status)) return false;
      } else if (status === 'active') {
        if (!ACTIVE_STATUSES.has(t.status)) return false;
      } else {
        if (t.status !== status) return false;
      }
    }

    // Format filter
    if (format !== undefined && t.format !== format) {
      return false;
    }

    // Search filter (case-insensitive on name and location)
    if (searchLower !== undefined && searchLower !== '') {
      const nameMatch = t.name.toLowerCase().includes(searchLower);
      const locationMatch = t.location.toLowerCase().includes(searchLower);
      if (!nameMatch && !locationMatch) return false;
    }

    return true;
  });
}

/**
 * Merge three lists of tournaments the user is involved in,
 * deduplicate by ID, assign the highest-priority role, and
 * sort by date descending (newest first).
 *
 * Priority: organizer > scorekeeper > player
 */
export function mergeMyTournaments(lists: {
  organized: Tournament[];
  participating: Tournament[];
  scorekeeping: Tournament[];
}): MyTournamentEntry[] {
  const map = new Map<string, MyTournamentEntry>();

  // Process in priority order (lowest first so higher priority overwrites)
  for (const t of lists.participating) {
    map.set(t.id, { tournament: t, role: 'player' });
  }
  for (const t of lists.scorekeeping) {
    map.set(t.id, { tournament: t, role: 'scorekeeper' });
  }
  for (const t of lists.organized) {
    map.set(t.id, { tournament: t, role: 'organizer' });
  }

  const entries = Array.from(map.values());

  // Sort by date descending (newest first)
  entries.sort((a, b) => b.tournament.date - a.tournament.date);

  return entries;
}
