import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';

export interface SanitizedNames {
  publicTeam1Name: string;
  publicTeam2Name: string;
}

/**
 * Check player profileVisibility and return sanitized team names.
 * Players with profileVisibility !== 'public' (or missing) get anonymized.
 */
export async function getSanitizedTeamNames(
  team1PlayerIds: string[],
  team2PlayerIds: string[],
  team1Name: string,
  team2Name: string,
): Promise<SanitizedNames> {
  const isTeamPublic = async (playerIds: string[]): Promise<boolean> => {
    if (playerIds.length === 0) return true; // no players = use team name as-is
    try {
      // Check all players' profileVisibility
      const results = await Promise.allSettled(
        playerIds.map(async (uid) => {
          const tierDoc = await getDoc(doc(firestore, 'users', uid, 'public', 'tier'));
          if (!tierDoc.exists()) return false;
          return tierDoc.data()?.profileVisibility === 'public';
        }),
      );
      // All players must consent for the team name to be public
      return results.every(r => r.status === 'fulfilled' && r.value === true);
    } catch {
      return false; // on error, default to anonymized
    }
  };

  const [team1Public, team2Public] = await Promise.all([
    isTeamPublic(team1PlayerIds),
    isTeamPublic(team2PlayerIds),
  ]);

  return {
    publicTeam1Name: team1Public ? team1Name : 'Team A',
    publicTeam2Name: team2Public ? team2Name : 'Team B',
  };
}
