import { db } from '../../data/db';
import type { TournamentRegistration } from '../../data/types';

// ── Cache clearing (sign-out) ──

export async function clearTournamentCache(): Promise<void> {
  await db.transaction('rw',
    db.cachedTournaments, db.cachedTeams, db.cachedPools,
    db.cachedBrackets, db.cachedRegistrations,
    async () => {
      await Promise.all([
        db.cachedTournaments.clear(),
        db.cachedTeams.clear(),
        db.cachedPools.clear(),
        db.cachedBrackets.clear(),
        db.cachedRegistrations.clear(),
      ]);
    },
  );
}

// ── TTL-based pruning (startup) ──

const PRUNE_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export async function pruneStaleTournamentCache(): Promise<void> {
  const cutoff = Date.now() - PRUNE_AGE_MS;

  const staleTournaments = await db.cachedTournaments
    .where('cachedAt')
    .below(cutoff)
    .toArray();

  if (staleTournaments.length === 0) return;

  const staleIds = staleTournaments.map(t => t.id);

  await db.transaction('rw',
    db.cachedTournaments, db.cachedTeams, db.cachedPools,
    db.cachedBrackets, db.cachedRegistrations,
    async () => {
      await db.cachedTournaments.where('cachedAt').below(cutoff).delete();
      for (const tid of staleIds) {
        await db.cachedTeams.where('tournamentId').equals(tid).delete();
        await db.cachedPools.where('tournamentId').equals(tid).delete();
        await db.cachedBrackets.where('tournamentId').equals(tid).delete();
        await db.cachedRegistrations.where('tournamentId').equals(tid).delete();
      }
    },
  );
}

// ── Registration PII scrubbing (role-gated caching) ──

type CacheRole = 'organizer' | 'scorekeeper' | 'participant' | 'viewer';

const SAFE_FIELDS: (keyof TournamentRegistration)[] = [
  'id', 'tournamentId', 'userId', 'playerName', 'teamId', 'status',
];

export function scrubRegistrationForCache(
  reg: TournamentRegistration,
  role: CacheRole,
): Partial<TournamentRegistration> {
  // Organizers and scorekeepers get full data
  if (role === 'organizer' || role === 'scorekeeper') {
    return { ...reg };
  }
  // Participants and viewers get scrubbed data
  const scrubbed: Partial<TournamentRegistration> = {};
  for (const field of SAFE_FIELDS) {
    (scrubbed as Record<string, unknown>)[field] = reg[field];
  }
  return scrubbed;
}
