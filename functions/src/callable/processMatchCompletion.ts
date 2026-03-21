// functions/src/callable/processMatchCompletion.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import type { CloudMatch, Tier, StatsSummary } from '../shared/types';
import { resolveParticipants } from '../lib/participantResolution';
import { computeUpdatedStats, buildMatchRefFromMatch } from '../lib/statsComputation';
import { buildLeaderboardEntry } from '../shared/utils/leaderboardScoring';
import { nearestTier, TIER_MULTIPLIER } from '../shared/utils/tierEngine';

let isColdStart = true;

export const processMatchCompletion = onCall(
  {
    memory: '256MiB',
    maxInstances: 10,
    concurrency: 16,
  },
  async (request) => {
    const wasColdStart = isColdStart;
    isColdStart = false;
    const startTime = Date.now();

    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    // 2. Input validation
    const { matchId } = request.data;
    if (!matchId || typeof matchId !== 'string') {
      throw new HttpsError('invalid-argument', 'matchId must be a non-empty string');
    }
    if (matchId.includes('/') || matchId.includes('..') || matchId.length > 128) {
      throw new HttpsError('invalid-argument', 'matchId contains invalid characters');
    }

    const db = getFirestore();
    const callerUid = request.auth.uid;

    // 3. Read match doc — use raw Firestore data (CloudMatch type)
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    if (!matchSnap.exists) {
      throw new HttpsError('not-found', 'Match not found');
    }
    const match = { id: matchSnap.id, ...matchSnap.data() } as CloudMatch;

    // 4. Validate match is genuinely completed
    if (match.status !== 'completed') {
      throw new HttpsError('failed-precondition', 'Match is not completed');
    }

    // 5. Validate winningSide is set (prevents assigning all participants a loss)
    if (match.winningSide !== 1 && match.winningSide !== 2) {
      throw new HttpsError(
        'failed-precondition',
        'Match has no winningSide — cannot determine results',
      );
    }

    // 6. Validate document structure (defensive — corrupted docs shouldn't crash)
    if (!match.ownerId || !Array.isArray(match.sharedWith)) {
      throw new HttpsError('data-loss', 'Match document has corrupted structure');
    }

    // 7. Verify caller is owner or shared user
    if (match.ownerId !== callerUid && !match.sharedWith.includes(callerUid)) {
      throw new HttpsError('permission-denied', 'Not authorized for this match');
    }

    // 8. Resolve participants
    const isTournament = !!(match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id));
    let registrations: Array<{ id: string; userId: string; teamId: string }> = [];

    if (isTournament) {
      const regsSnap = await db
        .collection(`tournaments/${match.tournamentId}/registrations`)
        .get();
      registrations = regsSnap.docs.map((d) => ({
        id: d.id,
        userId: d.data().userId,
        teamId: d.data().teamId,
      }));
    }

    const participants = resolveParticipants(match, registrations);
    if (participants.length === 0) {
      return { status: 'skipped', reason: 'No participants resolved' };
    }

    // 9. Fetch public tiers for opponent resolution
    const allUids = participants.map((p) => p.uid);
    const tierMap: Record<string, Tier> = {};
    const tierSnaps = await Promise.allSettled(
      allUids.map((uid) => db.doc(`users/${uid}/public/tier`).get()),
    );
    for (let i = 0; i < allUids.length; i++) {
      const r = tierSnaps[i];
      if (r.status === 'fulfilled' && r.value.exists) {
        tierMap[allUids[i]] = r.value.data()!.tier as Tier;
      }
    }

    // Resolve fallback tier from tournament config
    let fallbackTier: Tier = 'beginner';
    if (isTournament && match.tournamentId) {
      try {
        const tSnap = await db.doc(`tournaments/${match.tournamentId}`).get();
        if (tSnap.exists) {
          fallbackTier = tSnap.data()?.config?.defaultTier ?? 'beginner';
        }
      } catch { /* use default */ }
    }

    // Fetch user profiles for leaderboard denormalization
    const profileMap = new Map<string, { displayName: string; photoURL: string | null }>();
    const profileSnaps = await Promise.allSettled(
      allUids.map((uid) => db.doc(`users/${uid}`).get()),
    );
    for (let i = 0; i < allUids.length; i++) {
      const r = profileSnaps[i];
      if (r.status === 'fulfilled' && r.value.exists) {
        const data = r.value.data()!;
        profileMap.set(allUids[i], {
          displayName: data.displayName ?? 'Unknown Player',
          photoURL: data.photoURL ?? null,
        });
      }
    }

    // 10. Process each participant in a transaction
    const results: Array<{ uid: string; status: string }> = [];

    for (const participant of participants) {
      try {
        const opponentUids = participants
          .filter((p) => p.playerTeam !== participant.playerTeam)
          .map((p) => p.uid);

        // Resolve opponent tier (same logic as client)
        let opponentTier: Tier = fallbackTier;
        if (isTournament && opponentUids.length > 0) {
          const tiers = opponentUids.map((uid) => tierMap[uid] ?? fallbackTier);
          if (tiers.length === 1) {
            opponentTier = tiers[0];
          } else {
            const avgMul = tiers.reduce((sum, t) => sum + TIER_MULTIPLIER[t], 0) / tiers.length;
            opponentTier = nearestTier(avgMul);
          }
        }

        const computedTier = await db.runTransaction(async (transaction) => {
          const matchRefDoc = db.doc(`users/${participant.uid}/matchRefs/${matchId}`);
          const statsDoc = db.doc(`users/${participant.uid}/stats/summary`);
          const leaderboardDoc = db.doc(`leaderboard/${participant.uid}`);

          // Reads first (Firestore requirement)
          const [existingRef, existingStats, existingLeaderboard] = await Promise.all([
            transaction.get(matchRefDoc),
            transaction.get(statsDoc),
            transaction.get(leaderboardDoc),
          ]);

          // Idempotency: skip if already processed
          if (existingRef.exists) {
            return null;
          }

          const stats = existingStats.exists
            ? (existingStats.data() as StatsSummary)
            : {
                schemaVersion: 1, totalMatches: 0, wins: 0, losses: 0, winRate: 0,
                currentStreak: { type: 'W' as const, count: 0 }, bestWinStreak: 0,
                singles: { matches: 0, wins: 0, losses: 0 },
                doubles: { matches: 0, wins: 0, losses: 0 },
                recentResults: [], tier: 'beginner' as Tier, tierConfidence: 'low' as const,
                tierUpdatedAt: 0, lastPlayedAt: 0, updatedAt: 0, uniqueOpponentUids: [],
              };

          // SERVER-SIDE computation (no stats laundering)
          const updatedStats = computeUpdatedStats(
            stats, match, participant.playerTeam, participant.result,
            opponentTier, opponentUids,
          );

          const matchRef = buildMatchRefFromMatch(
            match, participant.playerTeam, participant.result, match.ownerId,
          );

          // Enrich for tournament
          if (isTournament) {
            matchRef.opponentIds = opponentUids;
            const partnerUid = match.config.gameType === 'doubles'
              ? participants.find((p) => p.playerTeam === participant.playerTeam && p.uid !== participant.uid)?.uid ?? null
              : null;
            matchRef.partnerId = partnerUid;
          }

          // Atomic writes
          transaction.set(matchRefDoc, matchRef);
          transaction.set(statsDoc, updatedStats, { merge: true });

          // Leaderboard
          const profile = profileMap.get(participant.uid);
          const now = updatedStats.updatedAt;
          const leaderboardEntry = buildLeaderboardEntry(
            participant.uid,
            profile?.displayName ?? 'Unknown Player',
            profile?.photoURL ?? null,
            updatedStats,
            now,
          );
          if (leaderboardEntry) {
            if (existingLeaderboard.exists) {
              leaderboardEntry.createdAt = existingLeaderboard.data()!.createdAt as number;
            }
            transaction.set(leaderboardDoc, leaderboardEntry);
          }

          return updatedStats.tier;
        });

        // Write public tier (outside transaction, non-critical)
        if (computedTier !== null) {
          const profile = profileMap.get(participant.uid);
          await db.doc(`users/${participant.uid}/public/tier`).set(
            { tier: computedTier, displayName: profile?.displayName },
            { merge: true },
          ).catch((err: unknown) => {
            logger.warn('Failed to write public tier', { matchId, userId: participant.uid, error: (err as Error).message });
          });
        }

        results.push({ uid: participant.uid, status: 'processed' });
      } catch (err) {
        logger.error('Error processing participant', { matchId, userId: participant.uid, error: (err as Error).message });
        results.push({ uid: participant.uid, status: 'error' });
      }
    }

    // 11. Update spectator projection status to 'completed'
    try {
      await db.doc(`matches/${matchId}/public/spectator`).set(
        { status: 'completed', updatedAt: Date.now() },
        { merge: true },
      );
    } catch (err) {
      logger.warn('Failed to update spectator projection status', { matchId, error: (err as Error).message });
    }

    logger.info('Match processed', {
      matchId,
      executionTimeMs: Date.now() - startTime,
      coldStart: wasColdStart,
      playerCount: participants.length,
      processed: results.length,
    });

    return { status: 'ok', processed: results };
  },
);
