import {
  doc, setDoc, getDoc, getDocs, updateDoc, collection, serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentPool, PoolStanding, PoolScheduleEntry } from '../types';

export const firestorePoolRepository = {
  async save(pool: TournamentPool): Promise<void> {
    const ref = doc(firestore, 'tournaments', pool.tournamentId, 'pools', pool.id);
    await setDoc(ref, { ...pool, updatedAt: serverTimestamp() });
  },
  async getByTournament(tournamentId: string): Promise<TournamentPool[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'pools'));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentPool);
  },
  async updateStandings(tournamentId: string, poolId: string, standings: PoolStanding[]): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'pools', poolId);
    await updateDoc(ref, { standings, updatedAt: serverTimestamp() });
  },
  async getById(tournamentId: string, poolId: string): Promise<TournamentPool | undefined> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'pools', poolId);
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as TournamentPool) : undefined;
  },
  async updateScheduleAndStandings(
    tournamentId: string,
    poolId: string,
    schedule: PoolScheduleEntry[],
    standings: PoolStanding[],
  ): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'pools', poolId);
    await updateDoc(ref, { schedule, standings, updatedAt: serverTimestamp() });
  },
};
