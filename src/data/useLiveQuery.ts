import { createSignal, onCleanup, createEffect } from 'solid-js';
import { liveQuery } from 'dexie';

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps?: () => unknown,
): () => T | undefined {
  const [result, setResult] = createSignal<T | undefined>(undefined);

  createEffect(() => {
    deps?.();
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (value) => setResult(() => value),
      error: (err) => console.error('liveQuery error:', err),
    });
    onCleanup(() => subscription.unsubscribe());
  });

  return result;
}
