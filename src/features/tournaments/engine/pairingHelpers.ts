import type { TournamentRegistration } from '../../../data/types';

export interface PairedTeam {
  player1: TournamentRegistration;
  player2: TournamentRegistration;
}

export interface ClassifyResult {
  paired: PairedTeam[];
  unmatched: TournamentRegistration[];
}

export function classifyRegistrations(
  registrations: TournamentRegistration[],
  userNames: Record<string, string>,
): ClassifyResult {
  const paired: PairedTeam[] = [];
  const pairedIds = new Set<string>();

  for (const reg of registrations) {
    if (pairedIds.has(reg.userId) || !reg.partnerName) continue;

    const partner = registrations.find(
      (r) =>
        !pairedIds.has(r.userId) &&
        r.userId !== reg.userId &&
        userNames[r.userId]?.toLowerCase() === reg.partnerName?.toLowerCase() &&
        r.partnerName?.toLowerCase() === userNames[reg.userId]?.toLowerCase(),
    );

    if (partner) {
      pairedIds.add(reg.userId);
      pairedIds.add(partner.userId);
      paired.push({ player1: reg, player2: partner });
    }
  }

  const unmatched = registrations.filter((r) => !pairedIds.has(r.userId));
  return { paired, unmatched };
}
