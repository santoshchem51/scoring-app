import { doc, setDoc, getDocs, collection, Timestamp } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import { db } from '../../../data/db';
import type { UnlockedAchievement, CachedAchievement } from '../../../data/types';

export const firestoreAchievementRepository = {
  async getUnlockedIds(uid: string): Promise<Set<string>> {
    const snap = await getDocs(collection(firestore, 'users', uid, 'achievements'));
    return new Set(snap.docs.map(d => d.id));
  },

  async create(uid: string, achievement: UnlockedAchievement): Promise<void> {
    const ref = doc(firestore, 'users', uid, 'achievements', achievement.achievementId);
    await setDoc(ref, {
      achievementId: achievement.achievementId,
      unlockedAt: Timestamp.fromMillis(achievement.unlockedAt),
      triggerMatchId: achievement.triggerMatchId,
      triggerContext: achievement.triggerContext,
    });
  },

  async cacheInDexie(achievement: UnlockedAchievement): Promise<void> {
    await db.achievements.put({
      ...achievement,
      toastShown: 0,
      syncedAt: Date.now(),
    });
  },

  async refreshForUser(uid: string): Promise<void> {
    const snap = await getDocs(collection(firestore, 'users', uid, 'achievements'));
    const firestoreAchievements = snap.docs.map(d => {
      const data = d.data();
      return {
        achievementId: d.id,
        unlockedAt: data.unlockedAt?.toMillis?.() ?? data.unlockedAt,
        triggerMatchId: data.triggerMatchId ?? '',
        triggerContext: data.triggerContext ?? { type: 'stats' as const, field: '', value: 0 },
      };
    });

    // Preserve local toastShown state
    const existing = await db.achievements.toArray();
    const existingMap = new Map(existing.map(a => [a.achievementId, a]));

    const toUpsert: CachedAchievement[] = firestoreAchievements.map(fa => ({
      ...fa,
      toastShown: existingMap.get(fa.achievementId)?.toastShown ?? 0,
      syncedAt: Date.now(),
    }));

    if (toUpsert.length > 0) {
      await db.achievements.bulkPut(toUpsert);
    }
  },
};
