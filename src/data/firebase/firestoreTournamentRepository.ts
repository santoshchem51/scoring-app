import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc,
  collection, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { Tournament, TournamentStatus } from '../types';

export const firestoreTournamentRepository = {
  async save(tournament: Tournament): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournament.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await setDoc(ref, { ...tournament, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...tournament, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  },

  async getById(id: string): Promise<Tournament | undefined> {
    const ref = doc(firestore, 'tournaments', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return undefined;
    return { id: snap.id, ...snap.data() } as Tournament;
  },

  async getByOrganizer(organizerId: string): Promise<Tournament[]> {
    const q = query(
      collection(firestore, 'tournaments'),
      where('organizerId', '==', organizerId),
      orderBy('date', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament);
  },

  async updateStatus(id: string, status: TournamentStatus, options?: { reason?: string; pausedFrom?: TournamentStatus | null }): Promise<void> {
    const ref = doc(firestore, 'tournaments', id);
    const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (options?.reason !== undefined) updates.cancellationReason = options.reason;
    if (options?.pausedFrom !== undefined) updates.pausedFrom = options.pausedFrom;
    await updateDoc(ref, updates);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'tournaments', id));
  },
};
