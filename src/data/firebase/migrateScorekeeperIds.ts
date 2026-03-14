import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentRole } from '../types';

export function buildStaffFromScorekeeperIds(scorekeeperIds: string[]): {
  staff: Record<string, TournamentRole>;
  staffUids: string[];
} {
  const staff: Record<string, TournamentRole> = {};
  const uniqueUids: string[] = [];
  for (const uid of scorekeeperIds) {
    if (!(uid in staff)) {
      staff[uid] = 'scorekeeper';
      uniqueUids.push(uid);
    }
  }
  return { staff, staffUids: uniqueUids };
}

/**
 * Migrate a single tournament from scorekeeperIds to staff/staffUids.
 * Safe to run multiple times (idempotent).
 */
export async function migrateTournament(tournamentId: string, scorekeeperIds: string[]): Promise<void> {
  const { staff, staffUids } = buildStaffFromScorekeeperIds(scorekeeperIds);
  const ref = doc(firestore, 'tournaments', tournamentId);
  await updateDoc(ref, {
    staff,
    staffUids,
    scorekeeperIds: deleteField(),
  });
}
