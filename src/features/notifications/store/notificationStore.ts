import { createSignal, createMemo } from 'solid-js';
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, updateDoc, getDocs, where, writeBatch,
} from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { AppNotification, NotificationCategory } from '../../../data/types';
import { settings } from '../../../stores/settingsStore';

// ── Module-level signals ──

const [notifications, setNotifications] = createSignal<AppNotification[]>([]);
const [unreadCount, setUnreadCount] = createSignal(0);
const [notificationsReady, setNotificationsReady] = createSignal(false);

export { notifications, unreadCount, notificationsReady };

// ── Preference-filtered view (createMemo — never mutates raw signal) ──

const CATEGORY_PREF_MAP: Record<NotificationCategory, string> = {
  buddy: 'notifyBuddy',
  tournament: 'notifyTournament',
  achievement: 'notifyAchievement',
  stats: 'notifyStats',
};

export const filteredNotifications = createMemo(() => {
  const prefs = settings() as Record<string, boolean>;
  return notifications().filter((n) => {
    const prefKey = CATEGORY_PREF_MAP[n.category];
    return prefs[prefKey] !== false;
  });
});

// ── Category-specific counts (for BottomNav badges) ──

export const buddyUnreadCount = createMemo(() =>
  notifications().filter((n) => !n.read && n.category === 'buddy').length,
);

// ── Listener lifecycle ──

let _unsubscribe: (() => void) | null = null;

export function startNotificationListener(uid: string): void {
  _unsubscribe?.();

  const q = query(
    collection(firestore, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );

  _unsubscribe = onSnapshot(
    q,
    (snap) => {
      const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification);
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
      setNotificationsReady(true);
    },
    (err) => {
      console.warn('Notification listener error:', err);
      setNotifications([]);
      setUnreadCount(0);
    },
  );
}

export function stopNotificationListener(): void {
  _unsubscribe?.();
  _unsubscribe = null;
  setNotifications([]);
  setUnreadCount(0);
  setNotificationsReady(false);
}

// ── Read operations (fire-and-forget) ──

export async function markNotificationRead(uid: string, notifId: string): Promise<void> {
  try {
    const ref = doc(firestore, 'users', uid, 'notifications', notifId);
    await updateDoc(ref, { read: true });
  } catch {
    // Best-effort. The onSnapshot will eventually reflect truth.
  }
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const q = query(
    collection(firestore, 'users', uid, 'notifications'),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(500),
  );
  const snap = await getDocs(q);
  if (snap.docs.length === 0) return;

  const batch = writeBatch(firestore);
  for (const d of snap.docs) {
    batch.update(d.ref, { read: true });
  }
  await batch.commit();
}

// ── Expired notification cleanup ──

export async function cleanupExpiredNotifications(uid: string): Promise<void> {
  const q = query(
    collection(firestore, 'users', uid, 'notifications'),
    where('expiresAt', '<=', Date.now()),
    limit(100),
  );
  const snap = await getDocs(q);
  if (snap.docs.length === 0) return;

  const batch = writeBatch(firestore);
  for (const d of snap.docs) {
    batch.delete(d.ref);
  }
  await batch.commit();
}
