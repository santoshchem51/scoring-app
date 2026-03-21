import { logger } from '../../../shared/observability/logger';
import { createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { ScoreEvent } from '../../../data/types';

export interface ScoreEventStreamData {
  events: () => ScoreEvent[];
  loading: () => boolean;
}

export function useScoreEventStream(matchId: () => string | null | undefined): ScoreEventStreamData {
  const [events, setEvents] = createSignal<ScoreEvent[]>([]);
  const [loading, setLoading] = createSignal(false);

  let unsubscribe: (() => void) | null = null;
  let generation = 0;
  let visibilityTimeout: number | undefined;

  function attach() {
    const id = matchId();
    if (!id) return;

    const thisGen = ++generation;
    setLoading(true);

    const q = query(
      collection(firestore, 'matches', id, 'scoreEvents'),
      orderBy('timestamp', 'asc'),
    );

    unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (thisGen !== generation) return;
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ScoreEvent);
        setEvents(data);
        setLoading(false);
      },
      (err) => {
        if (thisGen !== generation) return;
        logger.error('ScoreEvent listener error', err);
        setLoading(false);
      },
    );
  }

  function detach() {
    generation++;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  function handleVisibilityChange() {
    if (visibilityTimeout !== undefined) {
      clearTimeout(visibilityTimeout);
    }
    visibilityTimeout = window.setTimeout(() => {
      if (document.hidden) {
        detach();
      } else {
        attach();
      }
      visibilityTimeout = undefined;
    }, 500);
  }

  createEffect(() => {
    const id = matchId();
    detach();
    if (!id) {
      setEvents([]);
      setLoading(false);
      return;
    }
    attach();
  });

  onMount(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onCleanup(() => {
    detach();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (visibilityTimeout !== undefined) {
      clearTimeout(visibilityTimeout);
    }
  });

  return { events, loading };
}
