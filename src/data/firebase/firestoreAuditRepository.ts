import { doc, collection, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
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

export function createAuditEntry(
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

export async function getAuditLog(tournamentId: string): Promise<AuditLogEntry[]> {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'auditLog');
  const q = query(colRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry));
}
