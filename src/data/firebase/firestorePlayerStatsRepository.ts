import { doc, getDoc, getDocs, setDoc, collection } from 'firebase/firestore';
import { firestore } from './config';
import type { Match, MatchRef, StatsSummary, RecentResult } from '../types';
import { computeTierScore, computeTier, computeTierConfidence } from '../../shared/utils/tierEngine';

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

async function resolveParticipantUids(
  match: Match,
  scorerUid: string,
): Promise<Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }>> {
  const participants: Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }> = [];

  if (match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id)) {
    // Tournament match: look up registrations to find UIDs
    try {
      const regsSnapshot = await getDocs(
        collection(firestore, 'tournaments', match.tournamentId, 'registrations'),
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
    } catch (err) {
      console.warn('Failed to resolve tournament participant UIDs:', err);
    }
  }

  // Casual match: only scorer gets stats
  if (participants.length === 0) {
    const result: 'win' | 'loss' = match.winningSide === 1 ? 'win' : 'loss';
    participants.push({ uid: scorerUid, playerTeam: 1, result });
  }

  return participants;
}

export const firestorePlayerStatsRepository = {
  async updatePlayerStats(
    uid: string,
    match: Match,
    playerTeam: 1 | 2,
    result: 'win' | 'loss',
    scorerUid: string,
  ): Promise<void> {
    // 1. Idempotency check: skip if matchRef already exists
    const matchRefDoc = doc(firestore, 'users', uid, 'matchRefs', match.id);
    const existingRef = await getDoc(matchRefDoc);
    if (existingRef.exists()) return;

    // 2. Read existing stats
    const statsDoc = doc(firestore, 'users', uid, 'stats', 'summary');
    const existingStatsSnap = await getDoc(statsDoc);
    const stats: StatsSummary = existingStatsSnap.exists()
      ? (existingStatsSnap.data() as StatsSummary)
      : createEmptyStats();

    // 3. Build and write matchRef
    const matchRef = buildMatchRef(match, playerTeam, result);
    matchRef.ownerId = scorerUid;
    await setDoc(matchRefDoc, matchRef);

    // 4. Update stats
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

    // Ring buffer
    const newResult: RecentResult = {
      result,
      opponentTier: 'beginner', // v1: default opponent tier (circular bootstrap)
      completedAt: match.completedAt ?? Date.now(),
      gameType,
    };
    stats.recentResults = [...stats.recentResults, newResult].slice(-RING_BUFFER_SIZE);

    // Tier computation
    const score = computeTierScore(stats.recentResults);
    stats.tier = computeTier(score, stats.tier);
    const uniqueOpponents = estimateUniqueOpponents(stats.totalMatches);
    stats.tierConfidence = computeTierConfidence(stats.totalMatches, uniqueOpponents);
    stats.tierUpdatedAt = Date.now();

    stats.lastPlayedAt = match.completedAt ?? Date.now();
    stats.updatedAt = Date.now();

    // 5. Write updated stats
    await setDoc(statsDoc, stats, { merge: true });
  },

  async processMatchCompletion(
    match: Match,
    scorerUid: string,
  ): Promise<void> {
    const participants = await resolveParticipantUids(match, scorerUid);

    await Promise.all(
      participants.map(({ uid, playerTeam, result }) =>
        this.updatePlayerStats(uid, match, playerTeam, result, scorerUid).catch((err) => {
          console.warn('Stats update failed for user:', uid, err);
        }),
      ),
    );
  },
};
