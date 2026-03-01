import { doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, limit as fbLimit, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { UserProfile } from '../types';

export const firestoreUserRepository = {
  async saveProfile(user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): Promise<void> {
    const ref = doc(firestore, 'users', user.uid);
    const displayName = user.displayName ?? '';
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await setDoc(ref, {
        displayName,
        displayNameLower: displayName.toLowerCase(),
        email: user.email ?? '',
        photoURL: user.photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(ref, {
        id: user.uid,
        displayName,
        displayNameLower: displayName.toLowerCase(),
        email: user.email ?? '',
        photoURL: user.photoURL,
        createdAt: Date.now(),
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
      displayNameLower: data.displayNameLower ?? (data.displayName ?? '').toLowerCase(),
      email: data.email ?? '',
      photoURL: data.photoURL ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
      bio: data.bio,
      profileVisibility: data.profileVisibility,
      updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt,
    };
  },

  async searchByNamePrefix(prefix: string, maxResults: number = 5): Promise<UserProfile[]> {
    const lower = prefix.toLowerCase();
    const q = query(
      collection(firestore, 'users'),
      where('displayNameLower', '>=', lower),
      where('displayNameLower', '<=', lower + '\uf8ff'),
      orderBy('displayNameLower'),
      fbLimit(maxResults),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        displayName: data.displayName ?? '',
        displayNameLower: data.displayNameLower ?? '',
        email: data.email ?? '',
        photoURL: data.photoURL ?? null,
        createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
        bio: data.bio,
        profileVisibility: data.profileVisibility,
        updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt,
      };
    });
  },

  async searchByEmailPrefix(prefix: string, maxResults: number = 5): Promise<UserProfile[]> {
    const lower = prefix.toLowerCase();
    const q = query(
      collection(firestore, 'users'),
      where('email', '>=', lower),
      where('email', '<=', lower + '\uf8ff'),
      orderBy('email'),
      fbLimit(maxResults),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        displayName: data.displayName ?? '',
        displayNameLower: data.displayNameLower ?? '',
        email: data.email ?? '',
        photoURL: data.photoURL ?? null,
        createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
        bio: data.bio,
        profileVisibility: data.profileVisibility,
        updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt,
      };
    });
  },
};
