import type { TournamentRole, TournamentStatus } from '../../../data/types';
import type { EffectiveRole } from './roleHelpers';

export type AuditAction =
  | 'score_edit'
  | 'dispute_flag'
  | 'dispute_resolve'
  | 'role_change'
  | 'player_withdraw'
  | 'registration_approve'
  | 'registration_decline'
  | 'settings_change'
  | 'status_change'
  | 'player_quick_add'
  | 'player_claim';

export type AuditDetails =
  | { action: 'score_edit'; matchId: string; oldScores: number[][]; newScores: number[][]; oldWinner: number | null; newWinner: number | null }
  | { action: 'dispute_flag'; matchId: string; reason: string }
  | { action: 'dispute_resolve'; matchId: string; disputeId: string; resolution: string; type: 'edited' | 'dismissed' }
  | { action: 'role_change'; targetUid: string; targetName: string; oldRole: TournamentRole | null; newRole: TournamentRole | null }
  | { action: 'player_withdraw'; registrationId: string; playerName: string; reason?: string }
  | { action: 'registration_approve'; registrationId: string; playerName: string }
  | { action: 'registration_decline'; registrationId: string; playerName: string; reason?: string }
  | { action: 'settings_change'; changedFields: string[] }
  | { action: 'status_change'; oldStatus: TournamentStatus; newStatus: TournamentStatus; reason?: string }
  | { action: 'player_quick_add'; count: number; names: string[] }
  | { action: 'player_claim'; registrationId: string; placeholderName: string; claimedByUid: string };

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorRole: EffectiveRole;
  targetType: 'match' | 'registration' | 'tournament' | 'staff';
  targetId: string;
  details: AuditDetails;
  timestamp: unknown;
}
