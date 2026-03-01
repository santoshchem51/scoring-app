import { doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, collection, collectionGroup, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentInvitation } from '../types';

export const firestoreInvitationRepository = {
  async create(invitation: TournamentInvitation): Promise<void> {
    const ref = doc(firestore, 'tournaments', invitation.tournamentId, 'invitations', invitation.invitedUserId);
    await setDoc(ref, { ...invitation, id: invitation.invitedUserId, updatedAt: serverTimestamp() });
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

  async updateStatus(tournamentId: string, userId: string, status: 'accepted' | 'declined'): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'invitations', userId);
    await updateDoc(ref, { status, respondedAt: Date.now(), updatedAt: serverTimestamp() });
  },

  async backfillToUserIdKeys(tournamentId: string): Promise<number> {
    const invitations = await this.getByTournament(tournamentId);
    let migrated = 0;

    for (const inv of invitations) {
      // If doc ID already equals invitedUserId, skip
      if (inv.id === inv.invitedUserId) continue;

      const batch = writeBatch(firestore);
      // Create new doc keyed by userId
      const newRef = doc(firestore, 'tournaments', tournamentId, 'invitations', inv.invitedUserId);
      batch.set(newRef, { ...inv, id: inv.invitedUserId, updatedAt: serverTimestamp() });
      // Delete old UUID-keyed doc
      const oldRef = doc(firestore, 'tournaments', tournamentId, 'invitations', inv.id);
      batch.delete(oldRef);
      await batch.commit();
      migrated++;
    }
    return migrated;
  },
};
