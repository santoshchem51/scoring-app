import type { Tournament, TournamentRegistration } from '../types';

export function normalizeTournament(raw: Record<string, unknown>): Tournament {
  const t = raw as Partial<Tournament> & { id: string };
  const rawCounts = t.registrationCounts as { confirmed?: number; pending?: number } | undefined;
  return {
    ...t,
    accessMode: t.accessMode ?? 'open',
    listed: t.listed ?? (t.visibility === 'public'),
    buddyGroupId: t.buddyGroupId ?? null,
    buddyGroupName: t.buddyGroupName ?? null,
    registrationCounts: {
      confirmed: rawCounts?.confirmed ?? 0,
      pending: rawCounts?.pending ?? 0,
    },
  } as Tournament;
}

export function normalizeRegistration(raw: Record<string, unknown>): TournamentRegistration {
  const r = raw as Partial<TournamentRegistration> & { id: string };
  return {
    ...r,
    status: r.status ?? 'confirmed',
    declineReason: r.declineReason ?? null,
    statusUpdatedAt: r.statusUpdatedAt ?? null,
  } as TournamentRegistration;
}
