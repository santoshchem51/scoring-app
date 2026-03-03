import { createSignal, createResource } from 'solid-js';
import { useAuth } from '../../../shared/hooks/useAuth';
import { firestoreLeaderboardRepository } from '../../../data/firebase/firestoreLeaderboardRepository';
import type { LeaderboardEntry } from '../../../data/types';
import type { LeaderboardTimeframe } from '../../../data/firebase/firestoreLeaderboardRepository';

export type LeaderboardScope = 'global' | 'friends';
export type { LeaderboardTimeframe };

interface LeaderboardState {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userRank: number | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, {
  data: LeaderboardState;
  fetchedAt: number;
  fetching?: Promise<LeaderboardState>;
}>();

function cacheKey(scope: LeaderboardScope, timeframe: LeaderboardTimeframe): string {
  return `leaderboard:${scope}:${timeframe}`;
}

export function invalidateLeaderboardCache(
  scope?: LeaderboardScope,
  timeframe?: LeaderboardTimeframe,
): void {
  if (scope && timeframe) {
    cache.delete(cacheKey(scope, timeframe));
  } else {
    cache.clear();
  }
}

async function fetchLeaderboardData(
  scope: LeaderboardScope,
  timeframe: LeaderboardTimeframe,
  uid: string | undefined,
  friendUids: string[],
): Promise<LeaderboardState> {
  const key = cacheKey(scope, timeframe);
  const entry = cache.get(key);

  // Return in-flight request if one exists
  if (entry?.fetching) return entry.fetching;

  // Return cached if still valid
  if (entry && Date.now() - entry.fetchedAt <= CACHE_TTL_MS) return entry.data;

  // Start new fetch
  const promise = (async () => {
    let entries: LeaderboardEntry[];
    if (scope === 'friends') {
      entries = await firestoreLeaderboardRepository.getFriendsLeaderboard(friendUids, timeframe);
    } else {
      entries = await firestoreLeaderboardRepository.getGlobalLeaderboard(timeframe, 25);
    }

    let userEntry: LeaderboardEntry | null = null;
    let userRank: number | null = null;

    if (uid) {
      userEntry = await firestoreLeaderboardRepository.getUserEntry(uid);
      if (userEntry) {
        const score = timeframe === 'allTime'
          ? userEntry.compositeScore
          : userEntry.last30d.compositeScore;
        userRank = await firestoreLeaderboardRepository.getUserRank(uid, score, timeframe);
      }
    }

    const state: LeaderboardState = { entries, userEntry, userRank };
    cache.set(key, { data: state, fetchedAt: Date.now() });
    return state;
  })();

  // Store the fetching promise to prevent concurrent requests
  cache.set(key, {
    data: entry?.data ?? { entries: [], userEntry: null, userRank: null },
    fetchedAt: entry?.fetchedAt ?? 0,
    fetching: promise,
  });

  try {
    return await promise;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

export function useLeaderboard() {
  const { user } = useAuth();
  const [scope, setScope] = createSignal<LeaderboardScope>('global');
  const [timeframe, setTimeframe] = createSignal<LeaderboardTimeframe>('allTime');

  // friendUids fetched from user's stats (uniqueOpponentUids), capped at 30
  const [friendUids] = createResource(
    () => user()?.uid,
    async (uid) => {
      if (!uid) return [];
      const { firestorePlayerStatsRepository } = await import(
        '../../../data/firebase/firestorePlayerStatsRepository'
      );
      const stats = await firestorePlayerStatsRepository.getStatsSummary(uid);
      if (!stats) return [];
      return stats.uniqueOpponentUids.slice(0, 30);
    },
  );

  const [data] = createResource(
    () => {
      const uids = friendUids() ?? [];
      return `${scope()}:${timeframe()}:${user()?.uid ?? 'anon'}:${uids.length}`;
    },
    async (key) => {
      const parts = key.split(':');
      const s = parts[0] as LeaderboardScope;
      const tf = parts[1] as LeaderboardTimeframe;
      const uid = parts[2] === 'anon' ? undefined : parts[2];

      // Skip Firestore query for unauthenticated users (security rules require auth for reads)
      if (!uid) return { entries: [], userEntry: null, userRank: null };

      const uids = s === 'friends' ? (friendUids() ?? []) : [];
      return fetchLeaderboardData(s, tf, uid, uids);
    },
  );

  return {
    entries: () => data()?.entries ?? [],
    userEntry: () => data()?.userEntry ?? null,
    userRank: () => data()?.userRank ?? null,
    loading: () => data.loading,
    scope,
    setScope,
    timeframe,
    setTimeframe,
  };
}
