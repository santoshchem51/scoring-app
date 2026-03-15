import { createSignal, createEffect, onCleanup } from 'solid-js';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { Match } from '../../../data/types';

/**
 * Subscribes to in-progress matches for a tournament using a single Firestore query.
 * Returns only matches with status === 'in-progress' (server-side filtered).
 *
 * NOTE: This handles pool matches. Bracket matches are resolved separately
 * from the bracket slot data (bracket slots with matchId set and winnerId null).
 */
export function useTournamentLiveMatches(tournamentId: () => string | undefined) {
  const [liveMatches, setLiveMatches] = createSignal<Match[]>([]);
  const [loading, setLoading] = createSignal(false);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const tid = tournamentId();

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!tid) {
      setLiveMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(firestore, 'matches'),
      where('tournamentId', '==', tid),
      where('status', '==', 'in-progress'),
    );

    unsubscribe = onSnapshot(
      q,
      (snap) => {
        const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
        setLiveMatches(matches);
        setLoading(false);
      },
      (err) => {
        console.error('Tournament live matches listener error:', err);
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

  return { liveMatches, loading };
}
