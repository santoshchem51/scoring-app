import { doc, collection, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { firestore } from './config';
import { buildAuditEntry } from './firestoreAuditRepository';
import type { EffectiveRole } from '../../features/tournaments/engine/roleHelpers';

interface QuickAddInput {
  tournamentId: string;
  names: string[];
  actorId: string;
  actorName: string;
  actorRole: EffectiveRole;
}

export async function quickAddPlayers(input: QuickAddInput): Promise<void> {
  if (input.names.length === 0 || input.names.length > 100) {
    throw new Error('Quick add requires 1-100 names');
  }
  for (const name of input.names) {
    if (name.length === 0 || name.length > 100) {
      throw new Error(`Name must be 1-100 characters: "${name.slice(0, 20)}"`);
    }
  }

  const batch = writeBatch(firestore);
  const regCol = collection(firestore, 'tournaments', input.tournamentId, 'registrations');

  for (const name of input.names) {
    const regRef = doc(regCol);
    batch.set(regRef, {
      id: regRef.id,
      tournamentId: input.tournamentId,
      userId: null,
      playerName: name,
      status: 'placeholder',
      claimedBy: null,
      source: 'quick-add',
      teamId: null,
      paymentStatus: 'unpaid',
      paymentNote: '',
      lateEntry: false,
      skillRating: null,
      partnerId: null,
      partnerName: null,
      profileComplete: false,
      registeredAt: serverTimestamp(),
    });
  }

  // Update registration counter
  const tournamentRef = doc(firestore, 'tournaments', input.tournamentId);
  batch.update(tournamentRef, {
    'registrationCounts.pending': increment(input.names.length),
    updatedAt: serverTimestamp(),
  });

  // Audit entry
  const audit = buildAuditEntry(input.tournamentId, {
    action: 'player_quick_add',
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    targetType: 'registration',
    targetId: input.tournamentId,
    details: { action: 'player_quick_add', count: input.names.length, names: input.names },
  });
  const { ref: auditRef, id: _auditId, ...auditData } = audit;
  batch.set(auditRef, auditData);

  await batch.commit();
}
