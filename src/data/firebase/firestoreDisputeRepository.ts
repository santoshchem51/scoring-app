import {
  doc, collection, getDocs, query, orderBy, where,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { firestore } from './config';
import type { MatchDispute } from '../../features/tournaments/engine/disputeTypes';
import { buildAuditEntry } from './firestoreAuditRepository';
import type { EffectiveRole } from '../../features/tournaments/engine/roleHelpers';

interface FlagInput {
  tournamentId: string;
  matchId: string;
  flaggedBy: string;
  flaggedByName: string;
  reason: string;
  actorRole: EffectiveRole;
}

interface ResolveInput {
  tournamentId: string;
  disputeId: string;
  matchId: string;
  resolvedBy: string;
  resolvedByName: string;
  resolution: string;
  type: 'edited' | 'dismissed';
  actorRole: EffectiveRole;
}

export async function flagDispute(input: FlagInput): Promise<string> {
  const batch = writeBatch(firestore);
  const colRef = collection(firestore, 'tournaments', input.tournamentId, 'disputes');
  const disputeRef = doc(colRef);

  const disputeData: Omit<MatchDispute, 'id'> = {
    matchId: input.matchId,
    tournamentId: input.tournamentId,
    flaggedBy: input.flaggedBy,
    flaggedByName: input.flaggedByName,
    reason: input.reason,
    status: 'open',
    resolvedBy: null,
    resolvedByName: null,
    resolution: null,
    createdAt: serverTimestamp(),
    resolvedAt: null,
  };

  batch.set(disputeRef, disputeData);

  const audit = buildAuditEntry(input.tournamentId, {
    action: 'dispute_flag',
    actorId: input.flaggedBy,
    actorName: input.flaggedByName,
    actorRole: input.actorRole,
    targetType: 'match',
    targetId: input.matchId,
    details: { action: 'dispute_flag', matchId: input.matchId, reason: input.reason },
  });
  const { ref: auditRef, id: _auditId, ...auditData } = audit;
  batch.set(auditRef, auditData);

  await batch.commit();
  return disputeRef.id;
}

export async function resolveDispute(input: ResolveInput): Promise<void> {
  const batch = writeBatch(firestore);
  const disputeRef = doc(firestore, 'tournaments', input.tournamentId, 'disputes', input.disputeId);

  batch.update(disputeRef, {
    status: input.type === 'edited' ? 'resolved-edited' : 'resolved-dismissed',
    resolvedBy: input.resolvedBy,
    resolvedByName: input.resolvedByName,
    resolution: input.resolution,
    resolvedAt: serverTimestamp(),
  });

  const audit = buildAuditEntry(input.tournamentId, {
    action: 'dispute_resolve',
    actorId: input.resolvedBy,
    actorName: input.resolvedByName,
    actorRole: input.actorRole,
    targetType: 'match',
    targetId: input.matchId,
    details: {
      action: 'dispute_resolve',
      matchId: input.matchId,
      disputeId: input.disputeId,
      resolution: input.resolution,
      type: input.type,
    },
  });
  const { ref: auditRef, id: _auditId, ...auditData } = audit;
  batch.set(auditRef, auditData);

  await batch.commit();
}

export async function getDisputesByTournament(tournamentId: string): Promise<MatchDispute[]> {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'disputes');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchDispute));
}

export async function getOpenDisputesByMatch(tournamentId: string, matchId: string): Promise<MatchDispute[]> {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'disputes');
  const q = query(colRef, where('matchId', '==', matchId), where('status', '==', 'open'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchDispute));
}
