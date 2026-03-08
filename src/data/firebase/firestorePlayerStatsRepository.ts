import { doc, getDoc, getDocs, setDoc, collection, query, orderBy, limit as fbLimit, startAfter, runTransaction } from 'firebase/firestore';
import { firestore, auth } from './config';
import type { Match, MatchRef, StatsSummary, RecentResult, Tier } from '../types';
import { computeTierScore, computeTier, computeTierConfidence, nearestTier, TIER_MULTIPLIER } from '../../shared/utils/tierEngine';
import { buildLeaderboardEntry } from '../../shared/utils/leaderboardScoring';
import { evaluate } from '../../features/achievements/engine/badgeEngine';
import { firestoreAchievementRepository } from '../../features/achievements/repository/firestoreAchievementRepository';
import { enqueueToast } from '../../features/achievements/store/achievementStore';
import { getDefinition } from '../../features/achievements/engine/badgeDefinitions';

const RING_BUFFER_SIZE = 50;

function buildMatchRef(
  match: Match,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
): MatchRef {
  const opponentTeam = playerTeam === 1 ? 2 : 1;
  const opponentNames = opponentTeam === 1 ? [match.team1Name] : [match.team2Name];
  const partnerName = match.config.gameType === 'doubles'
    ? (playerTeam === 1 ? match.team1Name : match.team2Name)
    : null;

  const scores = match.games
    .map((g) => `${g.team1Score}-${g.team2Score}`)
    .join(', ');
  const gameScores = match.games.map((g) => [g.team1Score, g.team2Score]);

  return {
    matchId: match.id,
    startedAt: match.startedAt,
    completedAt: match.completedAt ?? Date.now(),
    gameType: match.config.gameType,
    scoringMode: match.config.scoringMode,
    result,
    scores,
    gameScores,
    playerTeam,
    opponentNames,
    opponentIds: [],
    partnerName,
    partnerId: null,
    ownerId: '',
    tournamentId: match.tournamentId ?? null,
    tournamentName: null,
  };
}

function createEmptyStats(): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: { type: 'W', count: 0 },
    bestWinStreak: 0,
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: [],
    tier: 'beginner',
    tierConfidence: 'low',
    tierUpdatedAt: 0,
    lastPlayedAt: 0,
    updatedAt: 0,
    uniqueOpponentUids: [],
  };
}

function updateStreak(
  current: { type: 'W' | 'L'; count: number },
  result: 'win' | 'loss',
): { type: 'W' | 'L'; count: number } {
  const streakType = result === 'win' ? 'W' : 'L';
  if (current.type === streakType) {
    return { type: streakType, count: current.count + 1 };
  }
  return { type: streakType, count: 1 };
}

// v1 approximation: unique opponent count is estimated as ~70% of match count
function estimateUniqueOpponents(matchCount: number): number {
  return Math.ceil(matchCount * 0.7);
}

async function fetchPublicTiers(uids: string[]): Promise<Record<string, Tier>> {
  if (uids.length === 0) return {};
  const results = await Promise.allSettled(
    uids.map((uid) => getDoc(doc(firestore, 'users', uid, 'public', 'tier'))),
  );
  const tiers: Record<string, Tier> = {};
  for (let i = 0; i < uids.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value.exists()) {
      tiers[uids[i]] = (r.value.data() as { tier: Tier }).tier;
    }
  }
  return tiers;
}

function resolveOpponentTier(
  opponentUids: string[],
  tierMap: Record<string, Tier>,
  fallbackTier: Tier,
  gameType: 'singles' | 'doubles',
): Tier {
  const tiers = opponentUids.map((uid) => tierMap[uid] ?? fallbackTier);
  if (tiers.length === 0) return fallbackTier;
  if (gameType === 'singles' || tiers.length === 1) return tiers[0];
  // Doubles: average multipliers, map to nearest tier
  const avgMultiplier = tiers.reduce((sum, t) => sum + TIER_MULTIPLIER[t], 0) / tiers.length;
  return nearestTier(avgMultiplier);
}

async function writePublicTier(uid: string, tier: Tier): Promise<void> {
  await setDoc(doc(firestore, 'users', uid, 'public', 'tier'), { tier });
}

async function resolveParticipantUids(
  match: Match,
  scorerUid: string,
): Promise<Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }>> {
  const participants: Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }> = [];

  // Early guard: no stats for abandoned matches (winningSide is null)
  if (match.winningSide === null) return [];

  const isTournamentMatch = !!(match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id));

  if (isTournamentMatch) {
    // Tournament match: look up registrations to find UIDs
    try {
      const regsSnapshot = await getDocs(
        collection(firestore, 'tournaments', match.tournamentId!, 'registrations'),
      );
      const registrations = regsSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<{ id: string; userId: string; teamId: string }>;

      for (const reg of registrations) {
        if (!reg.userId) continue;
        const isTeam1 = reg.teamId === match.tournamentTeam1Id;
        const isTeam2 = reg.teamId === match.tournamentTeam2Id;
        if (!isTeam1 && !isTeam2) continue;

        const playerTeam: 1 | 2 = isTeam1 ? 1 : 2;
        const result: 'win' | 'loss' = match.winningSide === playerTeam ? 'win' : 'loss';
        participants.push({ uid: reg.userId, playerTeam, result });
      }

      // Fall through to shared dedup guard below
    } catch (err) {
      // Return empty — don't fall through to casual path and give scorer phantom stats
      console.warn('Failed to resolve tournament participant UIDs, skipping stats:', err);
      return participants;
    }
  }

  // Casual match: give stats to linked players, fallback to scorer
  if (!isTournamentMatch) {
    const team1Uids = match.team1PlayerIds ?? [];
    const team2Uids = match.team2PlayerIds ?? [];

    // Capacity guard: reject invalid team sizes
    const maxPerTeam = match.config.gameType === 'singles' ? 1 : 2;
    if (team1Uids.length > maxPerTeam || team2Uids.length > maxPerTeam) {
      console.warn('Invalid team size for casual match, skipping stats:', {
        matchId: match.id,
        gameType: match.config.gameType,
        team1Count: team1Uids.length,
        team2Count: team2Uids.length,
        maxPerTeam,
      });
      return [];
    }

    // Phase 2+: if player IDs populated, give all linked players stats
    for (const uid of team1Uids) {
      const result: 'win' | 'loss' = match.winningSide === 1 ? 'win' : 'loss';
      participants.push({ uid, playerTeam: 1, result });
    }
    for (const uid of team2Uids) {
      const result: 'win' | 'loss' = match.winningSide === 2 ? 'win' : 'loss';
      participants.push({ uid, playerTeam: 2, result });
    }

    // Fallback: scorer gets stats if no playerIds and not spectating
    if (participants.length === 0 && match.scorerRole !== 'spectator') {
      const team: 1 | 2 = match.scorerTeam ?? 1;
      const result: 'win' | 'loss' = match.winningSide === team ? 'win' : 'loss';
      participants.push({ uid: scorerUid, playerTeam: team, result });
    }
  }

  // Shared dedup guard: remove duplicate UIDs (first occurrence wins)
  const seen = new Set<string>();
  const deduped: typeof participants = [];
  for (const p of participants) {
    if (seen.has(p.uid)) {
      console.warn('Duplicate UID across teams, skipping:', p.uid);
      continue;
    }
    seen.add(p.uid);
    deduped.push(p);
  }
  return deduped;
}

interface StatsEnrichment {
  isTournamentMatch: boolean;
  participants: Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }>;
  tierMap: Record<string, Tier>;
  fallbackTier: Tier;
}

export const firestorePlayerStatsRepository = {
  async updatePlayerStats(
    uid: string,
    match: Match,
    playerTeam: 1 | 2,
    result: 'win' | 'loss',
    scorerUid: string,
    displayName: string,
    photoURL: string | null,
    enrichment?: StatsEnrichment,
    currentUserUid?: string | null,
  ): Promise<void> {
    const matchRefDoc = doc(firestore, 'users', uid, 'matchRefs', match.id);
    const statsDoc = doc(firestore, 'users', uid, 'stats', 'summary');

    let newTier: Tier = 'beginner';
    let tierUpdated = false;
    let previousTier: Tier = 'beginner';
    let committedStats: StatsSummary | null = null;

    await runTransaction(firestore, async (transaction) => {
      // 1. Idempotency check: skip if matchRef already exists
      const existingRef = await transaction.get(matchRefDoc);
      if (existingRef.exists()) return;

      // Compute once for all enrichment blocks
      const opponentUids = enrichment?.isTournamentMatch
        ? enrichment.participants.filter((p) => p.playerTeam !== playerTeam).map((p) => p.uid)
        : [];

      // 2. Read existing stats
      const existingStatsSnap = await transaction.get(statsDoc);
      const stats: StatsSummary = existingStatsSnap.exists()
        ? (existingStatsSnap.data() as StatsSummary)
        : createEmptyStats();

      previousTier = stats.tier;

      // 3. Pre-read leaderboard doc (needed for createdAt preservation)
      // Firestore requires ALL reads before ANY writes in a transaction
      const leaderboardDocRef = doc(firestore, 'leaderboard', uid);
      const existingLeaderboard = await transaction.get(leaderboardDocRef);

      // 4. Build matchRef
      const matchRef = buildMatchRef(match, playerTeam, result);
      matchRef.ownerId = scorerUid;

      // Enrich matchRef for tournament matches
      if (enrichment?.isTournamentMatch) {
        const partnerUid = match.config.gameType === 'doubles'
          ? enrichment.participants.find((p) => p.playerTeam === playerTeam && p.uid !== uid)?.uid ?? null
          : null;
        matchRef.opponentIds = opponentUids;
        matchRef.partnerId = partnerUid;
      }

      // 5. Update stats
      const isWin = result === 'win';
      const gameType = match.config.gameType;

      stats.totalMatches += 1;
      stats.wins += isWin ? 1 : 0;
      stats.losses += isWin ? 0 : 1;
      stats.winRate = stats.totalMatches > 0 ? stats.wins / stats.totalMatches : 0;

      // Format-specific stats
      const formatStats = gameType === 'singles' ? stats.singles : stats.doubles;
      formatStats.matches += 1;
      formatStats.wins += isWin ? 1 : 0;
      formatStats.losses += isWin ? 0 : 1;

      // Streak
      const newStreak = updateStreak(stats.currentStreak, result);
      stats.currentStreak = newStreak;
      if (newStreak.type === 'W' && newStreak.count > stats.bestWinStreak) {
        stats.bestWinStreak = newStreak.count;
      }

      // Resolve opponent tier
      let opponentTier: Tier = 'beginner';
      if (enrichment?.isTournamentMatch) {
        opponentTier = resolveOpponentTier(opponentUids, enrichment.tierMap, enrichment.fallbackTier, match.config.gameType);
      }

      // Ring buffer
      const newResult: RecentResult = {
        result,
        opponentTier,
        completedAt: match.completedAt ?? Date.now(),
        gameType,
      };
      stats.recentResults = [...stats.recentResults, newResult].slice(-RING_BUFFER_SIZE);

      // Tier computation
      const score = computeTierScore(stats.recentResults);
      stats.tier = computeTier(score, stats.tier);

      // Unique opponents: merge new opponent UIDs for tournament matches
      if (enrichment?.isTournamentMatch) {
        const existingUids = new Set(stats.uniqueOpponentUids ?? []);
        for (const oid of opponentUids) {
          existingUids.add(oid);
        }
        stats.uniqueOpponentUids = [...existingUids];
      }
      const uniqueOpponents = (stats.uniqueOpponentUids ?? []).length || estimateUniqueOpponents(stats.totalMatches);
      stats.tierConfidence = computeTierConfidence(stats.totalMatches, uniqueOpponents);
      stats.tierUpdatedAt = Date.now();

      stats.lastPlayedAt = match.completedAt ?? Date.now();
      stats.updatedAt = Date.now();

      committedStats = { ...stats };

      // 6. Write both docs atomically
      transaction.set(matchRefDoc, matchRef);
      transaction.set(statsDoc, stats, { merge: true });

      // 7. Write leaderboard entry if player qualifies (>= 5 matches)
      const now = stats.updatedAt;
      const leaderboardEntry = buildLeaderboardEntry(uid, displayName, photoURL, stats, now);
      if (leaderboardEntry) {
        if (existingLeaderboard.exists()) {
          leaderboardEntry.createdAt = existingLeaderboard.data()!.createdAt as number;
        }
        transaction.set(leaderboardDocRef, leaderboardEntry);
      }

      newTier = stats.tier;
      tierUpdated = true;
    });

    // Only write public tier if we actually processed the match
    if (tierUpdated) {
      await writePublicTier(uid, newTier).catch((err) => {
        console.warn('Failed to write public tier for', uid, err);
      });
    }

    // Achievement evaluation — outside the transaction, gated on tierUpdated
    if (tierUpdated && committedStats) {
      try {
        const existingIds = await firestoreAchievementRepository.getUnlockedIds(uid);
        const unlocked = evaluate({
          stats: committedStats,
          match,
          playerTeam,
          result,
          existingIds,
          previousTier,
        });

        if (unlocked.length > 0) {
          const written: typeof unlocked = [];
          for (const a of unlocked) {
            try {
              await firestoreAchievementRepository.create(uid, a);
              await firestoreAchievementRepository.cacheInDexie(a);
              written.push(a);
            } catch (writeErr) {
              console.warn('Failed to write achievement:', a.achievementId, writeErr);
            }
          }

          // Only toast successfully written achievements
          if (uid === currentUserUid) {
            for (const a of written) {
              const def = getDefinition(a.achievementId);
              if (def) {
                enqueueToast({
                  achievementId: a.achievementId,
                  name: def.name,
                  description: def.description,
                  icon: def.icon,
                  tier: def.tier,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Achievement evaluation failed for user:', uid, err);
      }
    }
  },

  async processMatchCompletion(
    match: Match,
    scorerUid: string,
  ): Promise<void> {
    const currentUserUid = auth.currentUser?.uid ?? null;
    const participants = await resolveParticipantUids(match, scorerUid);
    if (participants.length === 0) return;

    const isTournamentMatch = !!(match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id));

    let tierMap: Record<string, Tier> = {};
    let fallbackTier: Tier = 'beginner';

    if (isTournamentMatch) {
      const allUids = participants.map((p) => p.uid);
      tierMap = await fetchPublicTiers(allUids);

      try {
        const tournamentSnap = await getDoc(doc(firestore, 'tournaments', match.tournamentId!));
        if (tournamentSnap.exists()) {
          const config = tournamentSnap.data()?.config;
          fallbackTier = config?.defaultTier ?? 'beginner';
        }
      } catch {
        // Fallback silently
      }
    }

    // Fetch user profiles for leaderboard denormalization
    const { firestoreUserRepository } = await import('./firestoreUserRepository');
    const profileMap = new Map<string, { displayName: string; photoURL: string | null }>();
    await Promise.allSettled(
      participants.map(async ({ uid }) => {
        const profile = await firestoreUserRepository.getProfile(uid);
        if (profile) {
          profileMap.set(uid, { displayName: profile.displayName, photoURL: profile.photoURL });
        }
      }),
    );

    await Promise.all(
      participants.map(({ uid, playerTeam, result }) => {
        const profile = profileMap.get(uid);
        return this.updatePlayerStats(
          uid, match, playerTeam, result, scorerUid,
          profile?.displayName ?? 'Unknown Player',
          profile?.photoURL ?? null,
          {
            isTournamentMatch,
            participants,
            tierMap,
            fallbackTier,
          },
          currentUserUid,
        ).catch((err) => {
          console.warn('Stats update failed for user:', uid, err);
        });
      }),
    );
  },

  async getStatsSummary(uid: string): Promise<StatsSummary | null> {
    const ref = doc(firestore, 'users', uid, 'stats', 'summary');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as StatsSummary) : null;
  },

  async getRecentMatchRefs(
    uid: string,
    maxResults: number = 10,
    startAfterTimestamp?: number,
  ): Promise<MatchRef[]> {
    const q = query(
      collection(firestore, 'users', uid, 'matchRefs'),
      orderBy('completedAt', 'desc'),
      ...(startAfterTimestamp !== undefined ? [startAfter(startAfterTimestamp)] : []),
      fbLimit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as MatchRef);
  },
};
