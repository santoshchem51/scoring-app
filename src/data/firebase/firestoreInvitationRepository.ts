import { doc, setDoc, getDocs, updateDoc, collection, collectionGroup, query, where, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentInvitation } from '../types';

export const firestoreInvitationRepository = {
  async create(invitation: TournamentInvitation): Promise<void> {
    const ref = doc(firestore, 'tournaments', invitation.tournamentId, 'invitations', invitation.id);
    await setDoc(ref, { ...invitation, updatedAt: serverTimestamp() });
  },

  async getByTournament(tournamentId: string): Promise<TournamentInvitation[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'invitations'));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentInvitation);
  },

  async getPendingForUser(userId: string): Promise<TournamentInvitation[]> {
    const q = query(
      collectionGroup(firestore, 'invitations'),
      where('invitedUserId', '==', userId),
      where('status', '==', 'pending'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentInvitation);
  },

  async updateStatus(tournamentId: string, invitationId: string, status: 'accepted' | 'declined'): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'invitations', invitationId);
    await updateDoc(ref, { status, respondedAt: Date.now(), updatedAt: serverTimestamp() });
  },
};
