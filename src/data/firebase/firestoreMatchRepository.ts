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

/** Strip undefined values so Firestore doesn't reject the document. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

function toCloudMatch(match: Match, ownerId: string, visibility: MatchVisibility = 'private'): CloudMatch {
  return stripUndefined({
    ...match,
    ownerId,
    sharedWith: [],
    visibility,
    syncedAt: Date.now(),
  } as unknown as Record<string, unknown>) as CloudMatch;
}

export const firestoreMatchRepository = {
  async save(match: Match, ownerId: string): Promise<void> {
    const ref = doc(firestore, 'matches', match.id);
    const cloudMatch = toCloudMatch(match, ownerId);
    await setDoc(ref, {
      ...cloudMatch,
      updatedAt: serverTimestamp(),
    });
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
