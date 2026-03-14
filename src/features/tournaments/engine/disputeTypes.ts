export type DisputeStatus = 'open' | 'resolved-edited' | 'resolved-dismissed';

export interface MatchDispute {
  id: string;
  matchId: string;
  tournamentId: string;
  flaggedBy: string;
  flaggedByName: string;
  reason: string;
  status: DisputeStatus;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolution: string | null;
  createdAt: unknown;
  resolvedAt: unknown;
}
