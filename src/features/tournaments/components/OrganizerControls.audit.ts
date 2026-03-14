import { setDoc } from 'firebase/firestore';
import { buildAuditEntry } from '../../../data/firebase/firestoreAuditRepository';
import { getTournamentRole } from '../engine/roleHelpers';
import type { Tournament, TournamentStatus } from '../../../data/types';

interface AuditUser {
  uid: string;
  displayName: string | null;
}

/**
 * Writes a status_change audit entry for a tournament.
 * Extracted for testability — called from OrganizerControls after status updates.
 */
export function writeStatusAudit(
  tournament: Tournament,
  currentUser: AuditUser | null,
  oldStatus: TournamentStatus,
  newStatus: TournamentStatus,
  reason?: string,
): void {
  if (!currentUser) return;
  const audit = buildAuditEntry(tournament.id, {
    action: 'status_change',
    actorId: currentUser.uid,
    actorName: currentUser.displayName ?? '',
    actorRole: getTournamentRole(tournament, currentUser.uid) ?? 'owner',
    targetType: 'tournament',
    targetId: tournament.id,
    details: { action: 'status_change', oldStatus, newStatus, reason },
  });
  const { ref: auditRef, id: _auditId, ...auditData } = audit;
  setDoc(auditRef, auditData).catch(() => {});
}
