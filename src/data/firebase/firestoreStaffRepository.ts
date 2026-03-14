import { doc, updateDoc, arrayUnion, arrayRemove, deleteField, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentRole } from '../types';

export async function addStaffMember(tournamentId: string, uid: string, role: TournamentRole): Promise<void> {
  const ref = doc(firestore, 'tournaments', tournamentId);
  await updateDoc(ref, {
    [`staff.${uid}`]: role,
    staffUids: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function removeStaffMember(tournamentId: string, uid: string): Promise<void> {
  const ref = doc(firestore, 'tournaments', tournamentId);
  await updateDoc(ref, {
    [`staff.${uid}`]: deleteField(),
    staffUids: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function updateStaffRole(tournamentId: string, uid: string, newRole: TournamentRole): Promise<void> {
  const ref = doc(firestore, 'tournaments', tournamentId);
  await updateDoc(ref, {
    [`staff.${uid}`]: newRole,
    updatedAt: serverTimestamp(),
  });
}
