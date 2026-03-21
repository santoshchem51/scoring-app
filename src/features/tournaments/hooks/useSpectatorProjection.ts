import { logger } from '../../../shared/observability/logger';
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { SpectatorProjection } from '../../../data/firebase/firestoreSpectatorRepository';

export interface SpectatorProjectionData {
  projection: () => SpectatorProjection | undefined;
  loading: () => boolean;
}

export function useSpectatorProjection(matchId: () => string | null | undefined): SpectatorProjectionData {
  const [projection, setProjection] = createSignal<SpectatorProjection | undefined>(undefined);
  const [loading, setLoading] = createSignal(false);
  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const id = matchId();
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (!id) { setProjection(undefined); setLoading(false); return; }

    setLoading(true);
    const ref = doc(firestore, 'matches', id, 'public', 'spectator');
    unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProjection(snap.data() as SpectatorProjection);
        } else {
          setProjection(undefined);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Spectator projection listener error', err);
        setLoading(false);
      },
    );
  });

  onCleanup(() => { if (unsubscribe) { unsubscribe(); unsubscribe = null; } });
  return { projection, loading };
}
