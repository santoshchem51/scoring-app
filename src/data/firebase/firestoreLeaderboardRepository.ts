import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { firestore } from './config';
import type { LeaderboardEntry } from '../../data/types';

export type LeaderboardTimeframe = 'allTime' | 'last30d';

const COLLECTION = 'leaderboard';

function scoreField(timeframe: LeaderboardTimeframe): string {
  return timeframe === 'allTime' ? 'compositeScore' : 'last30d.compositeScore';
}

export const firestoreLeaderboardRepository = {
  async getGlobalLeaderboard(
    timeframe: LeaderboardTimeframe,
    maxResults: number = 25,
  ): Promise<LeaderboardEntry[]> {
    const q = query(
      collection(firestore, COLLECTION),
      orderBy(scoreField(timeframe), 'desc'),
      limit(maxResults),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ ...d.data(), uid: d.id }) as LeaderboardEntry);
  },

  async getFriendsLeaderboard(
    friendUids: string[],
    timeframe: LeaderboardTimeframe,
  ): Promise<LeaderboardEntry[]> {
    if (friendUids.length === 0) return [];

    const q = query(
      collection(firestore, COLLECTION),
      where('uid', 'in', friendUids),
      orderBy(scoreField(timeframe), 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ ...d.data(), uid: d.id }) as LeaderboardEntry);
  },

  async getUserRank(
    uid: string,
    userScore: number,
    timeframe: LeaderboardTimeframe,
  ): Promise<number> {
    const q = query(
      collection(firestore, COLLECTION),
      where(scoreField(timeframe), '>', userScore),
    );
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count + 1;
  },

  async getUserEntry(uid: string): Promise<LeaderboardEntry | null> {
    const ref = doc(firestore, COLLECTION, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { ...snap.data(), uid: snap.id } as LeaderboardEntry;
  },
};
