import { createEffect } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useLiveQuery } from '../../../data/useLiveQuery';
import { db } from '../../../data/db';
import { firestoreAchievementRepository } from '../repository/firestoreAchievementRepository';
import type { CachedAchievement } from '../../../data/types';
import { logger } from '../../../shared/observability/logger';

export function useAchievements(userId: Accessor<string | undefined>) {
  const { data: unlocked, error } = useLiveQuery<CachedAchievement[]>(
    () => db.achievements.toArray(),
    userId,
  );

  createEffect(() => {
    const uid = userId();
    if (!uid) return;
    firestoreAchievementRepository.refreshForUser(uid).catch((err) => {
      logger.warn('Achievement refresh failed', err);
    });
  });

  return { unlocked, error };
}
