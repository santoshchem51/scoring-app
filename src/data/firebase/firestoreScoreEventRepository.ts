import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  orderBy,
} from 'firebase/firestore';
import { firestore } from './config';
import type { ScoreEvent, CloudScoreEvent } from '../types';

export const firestoreScoreEventRepository = {
  async save(event: ScoreEvent, recordedBy: string): Promise<void> {
    const ref = doc(firestore, 'matches', event.matchId, 'scoreEvents', event.id);
    const cloudEvent: CloudScoreEvent = { ...event, recordedBy };
    await setDoc(ref, cloudEvent);
  },

  async getByMatchId(matchId: string): Promise<ScoreEvent[]> {
    const q = query(
      collection(firestore, 'matches', matchId, 'scoreEvents'),
      orderBy('timestamp'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ScoreEvent);
  },
};
