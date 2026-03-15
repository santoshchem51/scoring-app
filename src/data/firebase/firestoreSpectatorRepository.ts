import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './config';
import type { Match } from '../types';
import { extractLiveScore, extractGameCount } from '../../features/tournaments/engine/scoreExtraction';

export interface SpectatorProjection {
  publicTeam1Name: string;
  publicTeam2Name: string;
  team1Score: number;
  team2Score: number;
  gameNumber: number;
  team1Wins: number;
  team2Wins: number;
  status: string;
  visibility: string;
  tournamentId: string;
  spectatorCount: number;
  updatedAt: number;
}

export function buildSpectatorProjection(
  match: Match,
  names: { publicTeam1Name: string; publicTeam2Name: string },
): SpectatorProjection {
  const { team1Score, team2Score } = extractLiveScore(match);
  const { team1Wins, team2Wins } = extractGameCount(match);

  let gameNumber = match.games.length + 1;
  if (match.lastSnapshot) {
    try {
      const snap = typeof match.lastSnapshot === 'string' ? JSON.parse(match.lastSnapshot) : match.lastSnapshot;
      if (snap.gameNumber) gameNumber = snap.gameNumber;
    } catch { /* use default */ }
  }

  return {
    publicTeam1Name: names.publicTeam1Name,
    publicTeam2Name: names.publicTeam2Name,
    team1Score,
    team2Score,
    gameNumber,
    team1Wins,
    team2Wins,
    status: match.status,
    visibility: 'public',
    tournamentId: match.tournamentId ?? '',
    spectatorCount: 0,
    updatedAt: Date.now(),
  };
}

/**
 * Write the spectator projection to Firestore.
 * Security rules allow the match owner or shared users (scorekeepers) to
 * create/update the spectator subdoc at /matches/{id}/public/spectator.
 */
export async function writeSpectatorProjection(matchId: string, projection: SpectatorProjection): Promise<void> {
  const ref = doc(firestore, 'matches', matchId, 'public', 'spectator');
  await setDoc(ref, projection);
}
