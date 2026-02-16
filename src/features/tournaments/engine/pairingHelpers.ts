import type { TournamentRegistration } from '../../../data/types';
import { autoPairByRating } from './autoPair';

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

export interface PartnerNameUpdate {
  regId: string;
  partnerName: string | null;
}

export function preparePairUpdate(
  reg1: TournamentRegistration,
  reg2: TournamentRegistration,
): [PartnerNameUpdate, PartnerNameUpdate] {
  return [
    { regId: reg1.id, partnerName: reg2.playerName },
    { regId: reg2.id, partnerName: reg1.playerName },
  ];
}

export function prepareUnpairUpdate(
  reg1: TournamentRegistration,
  reg2: TournamentRegistration,
): [PartnerNameUpdate, PartnerNameUpdate] {
  return [
    { regId: reg1.id, partnerName: null },
    { regId: reg2.id, partnerName: null },
  ];
}

export function prepareAutoPairUpdates(
  unmatched: TournamentRegistration[],
): [PartnerNameUpdate, PartnerNameUpdate][] {
  const players = unmatched.map((r) => ({
    userId: r.userId,
    skillRating: r.skillRating,
  }));

  const pairs = autoPairByRating(players);
  const updates: [PartnerNameUpdate, PartnerNameUpdate][] = [];

  for (const [p1, p2] of pairs) {
    const reg1 = unmatched.find((r) => r.userId === p1.userId)!;
    const reg2 = unmatched.find((r) => r.userId === p2.userId)!;
    updates.push(preparePairUpdate(reg1, reg2));
  }

  return updates;
}
