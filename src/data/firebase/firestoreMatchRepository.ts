import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { Match, CloudMatch, MatchVisibility } from '../types';

function toCloudMatch(match: Match, ownerId: string, visibility: MatchVisibility = 'private'): CloudMatch {
  return {
    ...match,
    ownerId,
    sharedWith: [],
    visibility,
    syncedAt: Date.now(),
  };
}

export const firestoreMatchRepository = {
  async save(match: Match, ownerId: string): Promise<void> {
    const ref = doc(firestore, 'matches', match.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      // Update — preserve ownerId, sharedWith, visibility from existing
      const data = existing.data();
      await setDoc(ref, {
        ...match,
        ownerId: data.ownerId,
        sharedWith: data.sharedWith ?? [],
        visibility: data.visibility ?? 'private',
        syncedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new
      const cloudMatch = toCloudMatch(match, ownerId);
      await setDoc(ref, {
        ...cloudMatch,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },

  async getById(id: string): Promise<CloudMatch | undefined> {
    const ref = doc(firestore, 'matches', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return undefined;
    return { id: snap.id, ...snap.data() } as CloudMatch;
  },

  async getByOwner(ownerId: string): Promise<CloudMatch[]> {
    const q = query(
      collection(firestore, 'matches'),
      where('ownerId', '==', ownerId),
      orderBy('startedAt', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CloudMatch);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'matches', id));
  },
};
