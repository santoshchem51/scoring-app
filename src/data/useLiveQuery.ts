import { createSignal, onCleanup, createEffect } from 'solid-js';
import { liveQuery } from 'dexie';

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps?: () => unknown,
): { data: () => T | undefined; error: () => Error | undefined } {
  const [result, setResult] = createSignal<T | undefined>(undefined);
  const [error, setError] = createSignal<Error | undefined>(undefined);

  createEffect(() => {
    deps?.();
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (value) => { setResult(() => value); setError(undefined); },
      error: (err) => { console.error('liveQuery error:', err); setError(() => err); },
    });
    onCleanup(() => subscription.unsubscribe());
  });

  return { data: result, error };
}
