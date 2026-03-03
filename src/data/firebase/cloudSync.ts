import { auth } from './config';
import { firestoreMatchRepository } from './firestoreMatchRepository';
import { firestoreTournamentRepository } from './firestoreTournamentRepository';
import { firestoreUserRepository } from './firestoreUserRepository';
import { matchRepository } from '../repositories/matchRepository';
import { enqueueJob } from './syncQueue';
import { db } from '../db';
import type { Match, Tournament } from '../types';

export const cloudSync = {
  /**
   * Enqueue a match for cloud sync.
   * Fire-and-forget — enqueue is fast, actual sync happens via the queue processor.
   */
  syncMatchToCloud(match: Match, sharedWith: string[] = []): void {
    const user = auth.currentUser;
    if (!user) return;
    enqueueJob('match', match.id, {
      type: 'match',
      ownerId: user.uid,
      sharedWith,
    }).catch((err) => {
      console.warn('Failed to enqueue match sync:', match.id, err);
    });
  },

  /**
   * Pull all cloud matches into local Dexie.
   * Called on sign-in to hydrate local DB with cloud data.
   *
   * Recency guard: never overwrite in-progress local matches or matches
   * with pending sync jobs.
   */
  async pullCloudMatchesToLocal(): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    const [ownedMatches, sharedMatches] = await Promise.all([
      firestoreMatchRepository.getByOwner(user.uid),
      firestoreMatchRepository.getBySharedWith(user.uid),
    ]);

    // Deduplicate by match ID — owned takes precedence
    const matchMap = new Map<string, typeof ownedMatches[number]>();
    for (const m of ownedMatches) {
      matchMap.set(m.id, m);
    }
    for (const m of sharedMatches) {
      if (!matchMap.has(m.id)) {
        matchMap.set(m.id, m);
      }
    }

    const cloudMatches = Array.from(matchMap.values());
    let synced = 0;

    // Batched transaction: single liveQuery notification for all writes
    await db.transaction('rw', db.matches, db.syncQueue, async () => {
      for (const cloudMatch of cloudMatches) {
        // Recency guard: check local state before writing
        const existing = await matchRepository.getById(cloudMatch.id);

        if (existing) {
          // Never overwrite active scoring
          if (existing.status === 'in-progress') continue;

          // Skip if there's a pending/processing/awaitingAuth sync job for this match
          const syncJob = await db.syncQueue.get(`match:${cloudMatch.id}`);
          if (
            syncJob &&
            (syncJob.status === 'pending' ||
              syncJob.status === 'processing' ||
              syncJob.status === 'awaitingAuth')
          ) {
            continue;
          }
        }

        const localMatch: Match = {
          id: cloudMatch.id,
          config: cloudMatch.config,
          team1PlayerIds: cloudMatch.team1PlayerIds,
          team2PlayerIds: cloudMatch.team2PlayerIds,
          team1Name: cloudMatch.team1Name,
          team2Name: cloudMatch.team2Name,
          team1Color: cloudMatch.team1Color,
          team2Color: cloudMatch.team2Color,
          games: cloudMatch.games,
          winningSide: cloudMatch.winningSide,
          status: cloudMatch.status,
          startedAt: cloudMatch.startedAt,
          completedAt: cloudMatch.completedAt,
          lastSnapshot: cloudMatch.lastSnapshot,
          tournamentId: cloudMatch.tournamentId,
          tournamentTeam1Id: cloudMatch.tournamentTeam1Id,
          tournamentTeam2Id: cloudMatch.tournamentTeam2Id,
          poolId: cloudMatch.poolId,
          bracketSlotId: cloudMatch.bracketSlotId,
          court: cloudMatch.court,
          scorerRole: cloudMatch.scorerRole,
          scorerTeam: cloudMatch.scorerTeam,
          ownerUid: cloudMatch.ownerId,
        };
        await matchRepository.save(localMatch);
        synced++;
      }
    });
    return synced;
  },

  /**
   * Save user profile to Firestore on sign-in.
   */
  async syncUserProfile(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await firestoreUserRepository.saveProfile(user);
    } catch (err) {
      console.warn('Failed to sync user profile:', err);
    }
  },

  /**
   * Enqueue all local matches for cloud sync.
   * Called on first sign-in to backup existing local matches.
   * Only enqueues matches owned by the current user (or with no ownerUid).
   */
  async enqueueLocalMatchPush(): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    const localMatches = await matchRepository.getAll();
    let enqueued = 0;

    for (const match of localMatches) {
      // Only push matches owned by this user or pre-cloud matches (no ownerUid)
      if (match.ownerUid && match.ownerUid !== user.uid) continue;

      await enqueueJob('match', match.id, {
        type: 'match',
        ownerId: user.uid,
        sharedWith: [],
      });
      enqueued++;
    }

    return enqueued;
  },

  /**
   * Enqueue a tournament for cloud sync. Fire-and-forget.
   */
  syncTournamentToCloud(tournament: Tournament): void {
    const user = auth.currentUser;
    if (!user) return;
    enqueueJob('tournament', tournament.id, {
      type: 'tournament',
    }).catch((err) => {
      console.warn('Failed to enqueue tournament sync:', tournament.id, err);
    });
  },

  /**
   * Pull organizer's tournaments from Firestore.
   */
  async pullTournamentsFromCloud(): Promise<Tournament[]> {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      return await firestoreTournamentRepository.getByOrganizer(user.uid);
    } catch (err) {
      console.warn('Failed to pull tournaments:', err);
      return [];
    }
  },

  /**
   * Enqueue player stats computation after match completion.
   * Depends on the match sync job completing first.
   */
  syncPlayerStatsAfterMatch(match: Match): void {
    const user = auth.currentUser;
    if (!user) return;
    enqueueJob(
      'playerStats',
      match.id,
      { type: 'playerStats', scorerUid: user.uid },
      [`match:${match.id}`],
    ).catch((err) => {
      console.warn('Failed to enqueue stats sync:', match.id, err);
    });
  },
};
