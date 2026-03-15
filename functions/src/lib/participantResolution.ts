import type { CloudMatch } from '../shared/types';

export interface Participant {
  uid: string;
  playerTeam: 1 | 2;
  result: 'win' | 'loss';
}

interface RegistrationData {
  id: string;
  userId: string;
  teamId: string;
}

export function resolveParticipants(
  match: CloudMatch,
  registrations: RegistrationData[],
): Participant[] {
  if (match.winningSide === null) return [];

  const participants: Participant[] = [];
  const isTournament = !!(match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id));

  if (isTournament) {
    for (const reg of registrations) {
      if (!reg.userId) continue;
      const isTeam1 = reg.teamId === match.tournamentTeam1Id;
      const isTeam2 = reg.teamId === match.tournamentTeam2Id;
      if (!isTeam1 && !isTeam2) continue;
      const playerTeam: 1 | 2 = isTeam1 ? 1 : 2;
      const result: 'win' | 'loss' = match.winningSide === playerTeam ? 'win' : 'loss';
      participants.push({ uid: reg.userId, playerTeam, result });
    }
  }

  const seen = new Set<string>();
  const deduped: Participant[] = [];
  for (const p of participants) {
    if (seen.has(p.uid)) continue;
    seen.add(p.uid);
    deduped.push(p);
  }
  return deduped;
}
