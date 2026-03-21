import { createResource, createSignal, createMemo, createEffect, on } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { UserProfile, StatsSummary, MatchRef } from '../../../data/types';
import { firestoreUserRepository } from '../../../data/firebase/firestoreUserRepository';
import { firestorePlayerStatsRepository } from '../../../data/firebase/firestorePlayerStatsRepository';
import { logger } from '../../../shared/observability/logger';

export interface ProfileBundle {
  profile: UserProfile | null;
  stats: StatsSummary | null;
  matches: MatchRef[];
  lastCompletedAt: number | null;
  errors: {
    profile: Error | null;
    stats: Error | null;
    matches: Error | null;
  };
}

export async function fetchProfileBundle(userId: string): Promise<ProfileBundle> {
  const [profileResult, statsResult, matchesResult] = await Promise.allSettled([
    firestoreUserRepository.getProfile(userId),
    firestorePlayerStatsRepository.getStatsSummary(userId),
    firestorePlayerStatsRepository.getRecentMatchRefs(userId, 10),
  ]);

  const matches = matchesResult.status === 'fulfilled'
    ? (matchesResult.value ?? [])
    : [];

  return {
    profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
    stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
    matches,
    lastCompletedAt: matches.length > 0
      ? matches[matches.length - 1].completedAt
      : null,
    errors: {
      profile: profileResult.status === 'rejected' ? profileResult.reason : null,
      stats: statsResult.status === 'rejected' ? statsResult.reason : null,
      matches: matchesResult.status === 'rejected' ? matchesResult.reason : null,
    },
  };
}

export function useProfileData(userId: Accessor<string | undefined>) {
  const [data, { refetch }] = createResource(userId, fetchProfileBundle);

  const [extraMatches, setExtraMatches] = createSignal<MatchRef[]>([]);
  const [lastCursor, setLastCursor] = createSignal<number | null>(null);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [hasMorePages, setHasMorePages] = createSignal(true);

  // Sync cursor from initial fetch
  createEffect(on(() => data(), (d) => {
    if (d) {
      setLastCursor(d.lastCompletedAt);
      setHasMorePages(d.matches.length >= 10);
    }
  }));

  // Reset pagination state when userId changes (e.g., sign-out/sign-in as different user)
  createEffect(on(userId, () => {
    setExtraMatches([]);
    setLastCursor(null);
    setHasMorePages(true);
  }, { defer: true }));

  const allMatches = createMemo<MatchRef[]>(() => {
    const initial = data()?.matches ?? [];
    const extra = extraMatches();
    return [...initial, ...extra];
  });

  const hasMore = createMemo(() => hasMorePages() && lastCursor() !== null);

  const loadMore = async () => {
    const cursor = lastCursor();
    const uid = userId();
    if (!cursor || !uid || loadingMore()) return;

    setLoadingMore(true);
    try {
      const nextPage = await firestorePlayerStatsRepository.getRecentMatchRefs(uid, 10, cursor);
      if (nextPage.length > 0) {
        setExtraMatches((prev) => [...prev, ...nextPage]);
        setLastCursor(nextPage[nextPage.length - 1].completedAt);
        if (nextPage.length < 10) setHasMorePages(false);
      } else {
        setHasMorePages(false);
      }
    } catch (err) {
      logger.warn('Failed to load more matches', err);
    } finally {
      setLoadingMore(false);
    }
  };

  return { data, allMatches, hasMore, loadMore, loadingMore, refetch };
}
