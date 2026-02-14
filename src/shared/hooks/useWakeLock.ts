import { onCleanup } from 'solid-js';

export function useWakeLock() {
  let wakeLock: WakeLockSentinel | null = null;

  const request = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  };

  const release = async () => {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  };

  onCleanup(() => { release(); });

  return { request, release };
}
