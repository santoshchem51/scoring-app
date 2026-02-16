import { createSignal, createEffect, onCleanup } from 'solid-js';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { Match } from '../../../data/types';

export interface LiveMatchData {
  match: () => Match | undefined;
  loading: () => boolean;
}

export function useLiveMatch(matchId: () => string | null | undefined): LiveMatchData {
  const [match, setMatch] = createSignal<Match | undefined>(undefined);
  const [loading, setLoading] = createSignal(false);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const id = matchId();

    // Cleanup previous listener
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!id) {
      setMatch(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    const matchRef = doc(firestore, 'matches', id);
    unsubscribe = onSnapshot(
      matchRef,
      (snap) => {
        if (snap.exists()) {
          setMatch({ id: snap.id, ...snap.data() } as Match);
        } else {
          setMatch(undefined);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Match listener error:', err);
        setLoading(false);
      },
    );
  });

  onCleanup(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  return { match, loading };
}
