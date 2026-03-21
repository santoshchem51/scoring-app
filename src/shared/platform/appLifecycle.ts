import { App } from '@capacitor/app';
import { IS_NATIVE } from './platform';

export function initAppLifecycle(): void {
  if (!IS_NATIVE) return;

  App.addListener('backButton', ({ canGoBack }) => {
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
