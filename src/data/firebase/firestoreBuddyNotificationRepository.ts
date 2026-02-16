import { doc, setDoc, getDocs, updateDoc, collection, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
import { firestore } from './config';
import type { BuddyNotification } from '../types';

export const firestoreBuddyNotificationRepository = {
  async create(notification: BuddyNotification): Promise<void> {
    const ref = doc(firestore, 'users', notification.userId, 'buddyNotifications', notification.id);
    await setDoc(ref, notification);
  },

  async getUnread(userId: string): Promise<BuddyNotification[]> {
    const q = query(
      collection(firestore, 'users', userId, 'buddyNotifications'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuddyNotification);
  },

  async getAll(userId: string): Promise<BuddyNotification[]> {
    const q = query(
      collection(firestore, 'users', userId, 'buddyNotifications'),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuddyNotification);
  },

  async markRead(userId: string, notificationId: string): Promise<void> {
    const ref = doc(firestore, 'users', userId, 'buddyNotifications', notificationId);
    await updateDoc(ref, { read: true });
  },

  async markAllRead(userId: string): Promise<void> {
    const unread = await this.getUnread(userId);
    if (unread.length === 0) return;
    const batch = writeBatch(firestore);
    for (const n of unread) {
      const ref = doc(firestore, 'users', userId, 'buddyNotifications', n.id);
      batch.update(ref, { read: true });
    }
    await batch.commit();
  },
};
