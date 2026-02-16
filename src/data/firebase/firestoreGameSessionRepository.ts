import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, orderBy, increment, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { DayOfStatus, GameSession, RsvpResponse, SessionRsvp } from '../types';

export const firestoreGameSessionRepository = {
  async create(session: GameSession): Promise<void> {
    const ref = doc(firestore, 'gameSessions', session.id);
    await setDoc(ref, { ...session, updatedAt: serverTimestamp() });
  },

  async get(sessionId: string): Promise<GameSession | null> {
    const snap = await getDoc(doc(firestore, 'gameSessions', sessionId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as GameSession;
  },

  async update(sessionId: string, data: Partial<GameSession>): Promise<void> {
    const ref = doc(firestore, 'gameSessions', sessionId);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  },

  async delete(sessionId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'gameSessions', sessionId));
  },

  async getByGroup(groupId: string): Promise<GameSession[]> {
    const q = query(
      collection(firestore, 'gameSessions'),
      where('groupId', '==', groupId),
      orderBy('scheduledDate', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GameSession);
  },

  async getOpenSessions(): Promise<GameSession[]> {
    const q = query(
      collection(firestore, 'gameSessions'),
      where('visibility', '==', 'open'),
      where('status', 'in', ['proposed', 'confirmed']),
      orderBy('scheduledDate', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GameSession);
  },

  async getByShareCode(code: string): Promise<GameSession | null> {
    const q = query(
      collection(firestore, 'gameSessions'),
      where('shareCode', '==', code),
      where('visibility', '==', 'open'),
    );
    const snap = await getDocs(q);
    if (snap.docs.length === 0) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as GameSession;
  },

  async submitRsvp(sessionId: string, rsvp: SessionRsvp): Promise<void> {
    const ref = doc(firestore, 'gameSessions', sessionId, 'rsvps', rsvp.userId);
    await setDoc(ref, rsvp);
  },

  async getRsvps(sessionId: string): Promise<SessionRsvp[]> {
    const snap = await getDocs(collection(firestore, 'gameSessions', sessionId, 'rsvps'));
    return snap.docs.map((d) => d.data() as SessionRsvp);
  },

  async updateDayOfStatus(sessionId: string, userId: string, status: DayOfStatus): Promise<void> {
    const ref = doc(firestore, 'gameSessions', sessionId, 'rsvps', userId);
    await updateDoc(ref, { dayOfStatus: status, statusUpdatedAt: Date.now() });
  },

  async updateRsvpResponse(sessionId: string, userId: string, response: RsvpResponse, spotsIncrement: number): Promise<void> {
    const rsvpRef = doc(firestore, 'gameSessions', sessionId, 'rsvps', userId);
    await updateDoc(rsvpRef, { response, respondedAt: Date.now() });
    if (spotsIncrement !== 0) {
      const sessionRef = doc(firestore, 'gameSessions', sessionId);
      await updateDoc(sessionRef, { spotsConfirmed: increment(spotsIncrement), updatedAt: serverTimestamp() });
    }
  },
};
