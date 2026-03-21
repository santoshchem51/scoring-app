import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { IS_NATIVE } from '../platform/platform';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.picklescore.app&utm_source=picklescore_web&utm_medium=landing_page&utm_campaign=install_cta';

const isAndroid = () => /Android/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAlreadyInstalled = () =>
  (navigator as { standalone?: boolean }).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

export const AppInstallCTA: Component = () => {
  if (IS_NATIVE || isAlreadyInstalled()) return null;

  return (
    <>
      <Show when={isAndroid()}>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-5 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform"
        >
          Get it on Google Play
        </a>
      </Show>
      <Show when={isIOS()}>
        <button
          class="inline-flex items-center gap-2 px-5 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform"
        >
          Install PickleScore
        </button>
      </Show>
    </>
  );
};
