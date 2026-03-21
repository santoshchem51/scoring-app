import { logger } from '../../../shared/observability/logger';
import { auth } from '../../../data/firebase/config';
import { firestorePlayerStatsRepository } from '../../../data/firebase/firestorePlayerStatsRepository';
import { firestoreAchievementRepository } from '../repository/firestoreAchievementRepository';
import { evaluate } from './badgeEngine';
import { getDefinition } from './badgeDefinitions';
import { enqueueToast } from '../store/achievementStore';
import { db } from '../../../data/db';
import type { Match } from '../../../data/types';

const MIGRATION_KEY = 'picklescore_achievement_migration_version';
const MAX_RETROACTIVE_TOASTS = 3;

/**
 * Bump this version whenever achievement definitions change
 * to trigger a re-evaluation on next app startup.
 */
export const MIGRATION_VERSION = '1.0.0';

/**
 * Runs once per version bump on app startup.
 * Reads current stats, evaluates all badge definitions against them,
 * and retroactively unlocks any qualifying achievements.
 *
 * Uses `result: 'loss'` so moment-based badges (shutout, comeback_kid,
 * perfect_match) naturally fail their win-check guard.
 * Omits `previousTier` so improvement badges (moving_up, level_up, elite)
 * also naturally fail.
 */
export async function runAchievementMigration(): Promise<void> {
  const lastVersion = localStorage.getItem(MIGRATION_KEY);
  if (lastVersion === MIGRATION_VERSION) return;

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  try {
    const stats = await firestorePlayerStatsRepository.getStatsSummary(uid);
    if (!stats) {
      localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION);
      return;
    }

    const existingIds = await firestoreAchievementRepository.getUnlockedIds(uid);

    // Synthetic match for evaluation context.
    // Using result: 'loss' ensures all moment-based checks immediately return false
    // (they all guard on `result !== 'win'`).
    const dummyMatch: Match = {
      id: 'migration-check',
      config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: [],
      team2PlayerIds: [],
      team1Name: '',
      team2Name: '',
      games: [{ gameNumber: 1, team1Score: 0, team2Score: 0, winningSide: 1 }],
      winningSide: 1,
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now(),
    };

    const unlocked = evaluate({
      stats,
      match: dummyMatch,
      playerTeam: 1,
      result: 'loss',
      existingIds,
      // no previousTier — improvement badges won't trigger
    });

    if (unlocked.length > 0) {
      // Write to Firestore individually (error-isolated per achievement)
      for (const a of unlocked) {
        try {
          await firestoreAchievementRepository.create(uid, {
            ...a,
            triggerMatchId: 'retroactive-migration',
          });
        } catch (err) {
          logger.warn('Migration: failed to write achievement', { achievementId: a.achievementId, error: err });
        }
      }

      // Cache all in Dexie — cap toasts at MAX_RETROACTIVE_TOASTS
      const cachedRows = unlocked.map((a, i) => ({
        achievementId: a.achievementId,
        unlockedAt: a.unlockedAt,
        triggerMatchId: 'retroactive-migration',
        triggerContext: a.triggerContext,
        toastShown: (i < MAX_RETROACTIVE_TOASTS ? 0 : 1) as 0 | 1,
        syncedAt: Date.now(),
      }));
      await db.achievements.bulkPut(cachedRows);

      // Enqueue toasts for the first MAX_RETROACTIVE_TOASTS
      for (let i = 0; i < Math.min(MAX_RETROACTIVE_TOASTS, unlocked.length); i++) {
        const a = unlocked[i];
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

    localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION);
  } catch (err) {
    logger.warn('Achievement migration failed', err);
    // Don't set version key — retry next time
  }
}
