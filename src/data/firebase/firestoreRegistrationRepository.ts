import { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { firestore } from './config';
import { normalizeRegistration } from './tournamentNormalizer';
import type { TournamentRegistration, PaymentStatus, RegistrationStatus } from '../types';

export const firestoreRegistrationRepository = {
  async save(reg: TournamentRegistration): Promise<void> {
    const ref = doc(firestore, 'tournaments', reg.tournamentId, 'registrations', reg.id);
    await setDoc(ref, { ...reg, updatedAt: serverTimestamp() });
  },
  async getByTournament(tournamentId: string): Promise<TournamentRegistration[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'registrations'));
    return snapshot.docs.map((d) => normalizeRegistration({ id: d.id, ...d.data() }));
  },
  async getByUser(tournamentId: string, userId: string): Promise<TournamentRegistration | undefined> {
    // Try userId-keyed doc first (new format)
    const directRef = doc(firestore, 'tournaments', tournamentId, 'registrations', userId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      return normalizeRegistration({ id: directSnap.id, ...directSnap.data() });
    }
    // Fallback: query for legacy UUID-keyed doc
    const q = query(
      collection(firestore, 'tournaments', tournamentId, 'registrations'),
      where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return undefined;
    return normalizeRegistration({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
  },
  async updatePayment(tournamentId: string, regId: string, status: PaymentStatus, note?: string): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'registrations', regId);
    const updates: Record<string, unknown> = { paymentStatus: status, updatedAt: serverTimestamp() };
    if (note !== undefined) updates.paymentNote = note;
    await updateDoc(ref, updates);
  },
  async updatePartnerName(tournamentId: string, regId: string, partnerName: string | null): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'registrations', regId);
    await updateDoc(ref, { partnerName, updatedAt: serverTimestamp() });
  },

  async saveWithStatus(reg: TournamentRegistration, tournamentId: string): Promise<void> {
    const batch = writeBatch(firestore);
    const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', reg.userId);
    const tournamentRef = doc(firestore, 'tournaments', tournamentId);

    batch.set(regRef, { ...reg, id: reg.userId, updatedAt: serverTimestamp() });

    if (reg.status === 'confirmed') {
      batch.update(tournamentRef, {
        'registrationCounts.confirmed': increment(1),
        updatedAt: serverTimestamp(),
      });
    } else if (reg.status === 'pending') {
      batch.update(tournamentRef, {
        'registrationCounts.pending': increment(1),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  },

  async updateRegistrationStatus(
    tournamentId: string,
    userId: string,
    fromStatus: RegistrationStatus,
    toStatus: RegistrationStatus,
    declineReason?: string,
  ): Promise<void> {
    const batch = writeBatch(firestore);
    const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', userId);
    const tournamentRef = doc(firestore, 'tournaments', tournamentId);

    const regUpdate: Record<string, unknown> = {
      status: toStatus,
      statusUpdatedAt: Date.now(),
      updatedAt: serverTimestamp(),
    };
    if (declineReason !== undefined) {
      regUpdate.declineReason = declineReason;
    }
    batch.update(regRef, regUpdate);

    // Adjust counters
    const counterUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (fromStatus === 'confirmed') counterUpdates['registrationCounts.confirmed'] = increment(-1);
    if (fromStatus === 'pending') counterUpdates['registrationCounts.pending'] = increment(-1);
    if (toStatus === 'confirmed') counterUpdates['registrationCounts.confirmed'] = increment(1);
    if (toStatus === 'pending') counterUpdates['registrationCounts.pending'] = increment(1);

    batch.update(tournamentRef, counterUpdates);

    await batch.commit();
  },

  async batchUpdateStatus(
    tournamentId: string,
    userIds: string[],
    fromStatus: RegistrationStatus,
    toStatus: RegistrationStatus,
  ): Promise<void> {
    // Firestore batches are limited to 500 ops. Reserve 1 for tournament counter.
    const CHUNK_SIZE = 499;

    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);
      const tournamentRef = doc(firestore, 'tournaments', tournamentId);

      for (const userId of chunk) {
        const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', userId);
        batch.update(regRef, {
          status: toStatus,
          statusUpdatedAt: Date.now(),
          updatedAt: serverTimestamp(),
        });
      }

      const counterUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (fromStatus === 'pending') counterUpdates['registrationCounts.pending'] = increment(-chunk.length);
      if (fromStatus === 'confirmed') counterUpdates['registrationCounts.confirmed'] = increment(-chunk.length);
      if (toStatus === 'confirmed') counterUpdates['registrationCounts.confirmed'] = increment(chunk.length);
      if (toStatus === 'pending') counterUpdates['registrationCounts.pending'] = increment(chunk.length);

      batch.update(tournamentRef, counterUpdates);
      await batch.commit();
    }
  },
};
