import { createSignal } from 'solid-js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../../data/firebase/config';
import { cloudSync } from '../../data/firebase/cloudSync';
import { resetAwaitingAuthJobs } from '../../data/firebase/syncQueue';
import { startProcessor, stopProcessor, wakeProcessor } from '../../data/firebase/syncProcessor';
import { runAchievementMigration } from '../../features/achievements/engine/achievementMigration';
import { startNotificationListener, stopNotificationListener, cleanupExpiredNotifications, notifications, markNotificationRead } from '../../features/notifications/store/notificationStore';
import { onToastDismissed } from '../../features/achievements/store/achievementStore';
import { clearTournamentCache } from '../pwa/tournamentCacheUtils';

const [user, setUser] = createSignal<User | null>(null);
const [loading, setLoading] = createSignal(true);
const [syncing, setSyncing] = createSignal(false);
const [syncError, setSyncError] = createSignal(false);

let listenerInitialized = false;
let _toastCallbackRegistered = false;

function initAuthListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;
  onAuthStateChanged(auth, async (firebaseUser) => {
    const wasSignedOut = user() === null;
    setUser(firebaseUser);
    setLoading(false);

    // Sync on sign-in
    if (firebaseUser && wasSignedOut) {
      setSyncing(true);
      setSyncError(false);

      // Step 1: blocking profile sync (fast, required by security rules)
      await cloudSync.syncUserProfile();

      // Step 2: non-blocking push — enqueue local matches
      cloudSync.enqueueLocalMatchPush().catch((err) => {
        console.warn('Match push enqueue failed:', err);
      });

      // Step 3: non-blocking pull — runs in background
      cloudSync.pullCloudMatchesToLocal()
        .then(() => setSyncing(false))
        .catch(() => {
          setSyncError(true);
          setSyncing(false);
        });

      // Step 4: non-blocking achievement migration — retroactive unlocks
      runAchievementMigration().catch((err) => {
        console.warn('Achievement migration failed:', err);
      });

      // Start the sync processor
      startProcessor();

      // Start notification listener
      startNotificationListener(firebaseUser.uid);

      // Register achievement toast → notification read coordination (once)
      if (!_toastCallbackRegistered) {
        _toastCallbackRegistered = true;
        onToastDismissed((achievementId) => {
          const uid = user()?.uid;
          if (!uid) return;
          const notifs = notifications();
          const match = notifs.find(n => n.type === 'achievement_unlocked' && n.payload?.achievementId === achievementId);
          if (match) {
            markNotificationRead(uid, match.id).catch(() => {});
          }
        });
      }

      // Clean up expired notifications (non-blocking)
      cleanupExpiredNotifications(firebaseUser.uid).catch((err) => {
        console.warn('Notification cleanup failed:', err);
      });

      // Resume awaitingAuth jobs with fresh token
      try {
        await firebaseUser.getIdToken(true);
        await resetAwaitingAuthJobs();
        wakeProcessor();
      } catch {
        // Token refresh failed — processor will handle it
      }
    }

    // Clean up on sign-out
    if (!firebaseUser) {
      stopProcessor();
      stopNotificationListener();
    }
  });
}

export function useAuth() {
  initAuthListener();

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await clearTournamentCache();
    await firebaseSignOut(auth);
  };

  return { user, loading, syncing, syncError, setSyncError, signIn, signOut };
}
