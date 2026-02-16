import { createSignal, createEffect, onCleanup } from 'solid-js';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { BuddyNotification } from '../../../data/types';

export function useBuddyNotifications(userId: () => string | undefined) {
  const [notifications, setNotifications] = createSignal<BuddyNotification[]>([]);
  const [unreadCount, setUnreadCount] = createSignal(0);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const uid = userId();
    unsubscribe?.();

    if (!uid) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(firestore, 'users', uid, 'buddyNotifications'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    unsubscribe = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuddyNotification);
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });
  });

  onCleanup(() => unsubscribe?.());

  return { notifications, unreadCount };
}
