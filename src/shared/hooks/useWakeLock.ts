import { onCleanup } from 'solid-js';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { IS_NATIVE } from '../platform/platform';

export function useWakeLock() {
  let wakeLock: WakeLockSentinel | null = null;

  const request = async () => {
    if (IS_NATIVE) {
      await KeepAwake.keepAwake().catch(() => {});
      return;
    }
    if ('wakeLock' in navigator) {
      try { wakeLock = await navigator.wakeLock.request('screen'); }
      catch (err) { console.warn('Wake Lock request failed:', err); }
    }
  };

  const release = async () => {
    if (IS_NATIVE) {
      await KeepAwake.allowSleep().catch(() => {});
      return;
    }
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  };

  onCleanup(() => { release(); });

  return { request, release };
}
