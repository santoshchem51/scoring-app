import { doc, setDoc, getDocs, updateDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentRegistration, PaymentStatus } from '../types';

export const firestoreRegistrationRepository = {
  async save(reg: TournamentRegistration): Promise<void> {
    const ref = doc(firestore, 'tournaments', reg.tournamentId, 'registrations', reg.id);
    await setDoc(ref, { ...reg, updatedAt: serverTimestamp() });
  },
  async getByTournament(tournamentId: string): Promise<TournamentRegistration[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'registrations'));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentRegistration);
  },
  async getByUser(tournamentId: string, userId: string): Promise<TournamentRegistration | undefined> {
    const q = query(collection(firestore, 'tournaments', tournamentId, 'registrations'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return undefined;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as TournamentRegistration;
  },
  async updatePayment(tournamentId: string, regId: string, status: PaymentStatus, note?: string): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'registrations', regId);
    const updates: Record<string, unknown> = { paymentStatus: status, updatedAt: serverTimestamp() };
    if (note !== undefined) updates.paymentNote = note;
    await updateDoc(ref, updates);
  },
};
