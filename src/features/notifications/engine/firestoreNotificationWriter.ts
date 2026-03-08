import { doc, setDoc } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { AppNotification } from '../../../data/types';

export async function writeNotification(notif: AppNotification): Promise<void> {
  const ref = doc(firestore, 'users', notif.userId, 'notifications', notif.id);
  await setDoc(ref, notif);
}
