import {
  doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc,
  collection, collectionGroup, query, where, orderBy, serverTimestamp,
  limit as firestoreLimit, startAfter,
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

  async getByShareCode(shareCode: string): Promise<Tournament | undefined> {
    const q = query(
      collection(firestore, 'tournaments'),
      where('shareCode', '==', shareCode),
      where('visibility', '==', 'public'),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return undefined;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as Tournament;
  },

  async updateStatus(id: string, status: TournamentStatus, options?: { reason?: string; pausedFrom?: TournamentStatus | null }): Promise<void> {
    const ref = doc(firestore, 'tournaments', id);
    const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (options?.reason !== undefined) updates.cancellationReason = options.reason;
    if (options?.pausedFrom !== undefined) updates.pausedFrom = options.pausedFrom;
    await updateDoc(ref, updates);
  },

  async updateVisibility(id: string, visibility: 'private' | 'public', shareCode: string | null): Promise<void> {
    const ref = doc(firestore, 'tournaments', id);
    await updateDoc(ref, { visibility, shareCode, updatedAt: serverTimestamp() });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'tournaments', id));
  },

  async getPublicTournaments(pageSize = 50, cursor?: unknown): Promise<{ tournaments: Tournament[]; lastDoc: unknown }> {
    const constraints = [
      where('visibility', '==', 'public'),
      orderBy('date', 'desc'),
      firestoreLimit(pageSize),
    ];
    if (cursor) {
      constraints.push(startAfter(cursor));
    }
    const q = query(collection(firestore, 'tournaments'), ...constraints);
    const snapshot = await getDocs(q);
    const tournaments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament);
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    return { tournaments, lastDoc };
  },

  async getByParticipant(userId: string): Promise<string[]> {
    const q = query(collectionGroup(firestore, 'registrations'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const ids = snap.docs.map((d) => d.ref.parent.parent!.id);
    return [...new Set(ids)];
  },

  async getByScorekeeper(userId: string): Promise<Tournament[]> {
    const q = query(
      collection(firestore, 'tournaments'),
      where('scorekeeperIds', 'array-contains', userId),
      orderBy('date', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tournament);
  },
};
