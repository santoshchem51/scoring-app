import { doc, setDoc, getDocs, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { BracketSlot } from '../types';

export const firestoreBracketRepository = {
  async save(slot: BracketSlot): Promise<void> {
    const ref = doc(firestore, 'tournaments', slot.tournamentId, 'bracket', slot.id);
    await setDoc(ref, { ...slot, updatedAt: serverTimestamp() });
  },
  async getByTournament(tournamentId: string): Promise<BracketSlot[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'bracket'));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BracketSlot);
  },
  async updateResult(tournamentId: string, slotId: string, winnerId: string, matchId: string): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'bracket', slotId);
    await updateDoc(ref, { winnerId, matchId, updatedAt: serverTimestamp() });
  },
};
