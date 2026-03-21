import { App } from '@capacitor/app';
import { IS_NATIVE } from './platform';

let _initialized = false;

export function initAppLifecycle(): void {
  if (!IS_NATIVE || _initialized) return;
  _initialized = true;

  App.addListener('backButton', ({ canGoBack }) => {
    // Prevent accidental exit during active scoring
    if (window.location.pathname.startsWith('/score/')) {
      if (canGoBack) {
        const leave = window.confirm('Leave this game? Your progress is saved.');
        if (leave) window.history.back();
      }
      return;
    }

    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('app-state-change', { detail: { isActive } }));
  });
}

/** Reset for testing only */
export function _resetForTesting(): void {
  _initialized = false;
}
