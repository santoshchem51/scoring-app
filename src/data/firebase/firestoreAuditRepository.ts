import { doc, collection, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { firestore } from './config';
import type { AuditLogEntry, AuditAction, AuditDetails } from '../../features/tournaments/engine/auditTypes';
import type { EffectiveRole } from '../../features/tournaments/engine/roleHelpers';

interface AuditInput {
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorRole: EffectiveRole;
  targetType: AuditLogEntry['targetType'];
  targetId: string;
  details: AuditDetails;
}

/**
 * Builds an audit entry with a pre-allocated Firestore doc ref.
 * DOES NOT write to Firestore. Caller must add to a WriteBatch:
 *   const { ref, ...data } = buildAuditEntry(tournamentId, input);
 *   batch.set(ref, data);
 */
export function buildAuditEntry(
  tournamentId: string,
  input: AuditInput,
): AuditLogEntry & { ref: DocumentReference } {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'auditLog');
  const docRef = doc(colRef);
  return {
    id: docRef.id,
    ...input,
    timestamp: serverTimestamp(),
    ref: docRef,
  };
}

/** Fetch recent audit entries for a tournament, ordered by timestamp desc. */
export async function getAuditLog(tournamentId: string, maxEntries = 50): Promise<AuditLogEntry[]> {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'auditLog');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxEntries));
  const snap = await getDocs(q);
  // Firestore data is untyped — trust the schema enforced by buildAuditEntry + security rules
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry));
}
