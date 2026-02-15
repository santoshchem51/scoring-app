import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { UserProfile } from '../types';

export const firestoreUserRepository = {
  async saveProfile(user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): Promise<void> {
    const ref = doc(firestore, 'users', user.uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await setDoc(ref, {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(ref, {
        id: user.uid,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
      });
    }
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    const ref = doc(firestore, 'users', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      displayName: data.displayName ?? '',
      email: data.email ?? '',
      photoURL: data.photoURL ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    };
  },
};
