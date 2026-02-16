// src/features/buddies/hooks/useGameSession.ts
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { GameSession, SessionRsvp } from '../../../data/types';

export function useGameSession(sessionId: () => string | undefined) {
  const [session, setSession] = createSignal<GameSession | null>(null);
  const [rsvps, setRsvps] = createSignal<SessionRsvp[]>([]);
  const [loading, setLoading] = createSignal(true);

  const unsubs: (() => void)[] = [];

  createEffect(() => {
    const sid = sessionId();
    unsubs.forEach((u) => u());
    unsubs.length = 0;

    if (!sid) {
      setSession(null);
      setRsvps([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to session doc
    unsubs.push(
      onSnapshot(doc(firestore, 'gameSessions', sid), (snap) => {
        if (snap.exists()) {
          setSession({ id: snap.id, ...snap.data() } as GameSession);
        } else {
          setSession(null);
        }
        setLoading(false);
      }),
    );

    // Listen to RSVPs sub-collection
    unsubs.push(
      onSnapshot(collection(firestore, 'gameSessions', sid, 'rsvps'), (snap) => {
        setRsvps(snap.docs.map((d) => d.data() as SessionRsvp));
      }),
    );
  });

  onCleanup(() => unsubs.forEach((u) => u()));

  return { session, rsvps, loading };
}
