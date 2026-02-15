import {
  doc, setDoc, getDocs, deleteDoc, updateDoc, collection, serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentTeam } from '../types';

export const firestoreTeamRepository = {
  async save(team: TournamentTeam): Promise<void> {
    const ref = doc(firestore, 'tournaments', team.tournamentId, 'teams', team.id);
    await setDoc(ref, { ...team, updatedAt: serverTimestamp() });
  },
  async getByTournament(tournamentId: string): Promise<TournamentTeam[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'teams'));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentTeam);
  },
  async updatePool(tournamentId: string, teamId: string, poolId: string): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'teams', teamId);
    await updateDoc(ref, { poolId, updatedAt: serverTimestamp() });
  },
  async delete(tournamentId: string, teamId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'tournaments', tournamentId, 'teams', teamId));
  },
};
