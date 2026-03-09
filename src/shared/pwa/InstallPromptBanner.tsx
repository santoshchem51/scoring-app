import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import {
  showInstallBanner,
  triggerInstallPrompt,
  dismissAndEscalate,
  neverDismiss,
  iosInstallSupported,
  isInstalled,
} from './installPromptStore';

const InstallPromptBanner: Component = () => {
  const handleInstall = () => {
    triggerInstallPrompt();
  };

  return (
    <>
      {/* Chrome/Edge/Samsung install prompt */}
      <Show when={showInstallBanner()}>
        <div
          role="banner"
          aria-label="Install app"
          class="bg-surface-light border border-border rounded-xl p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-on-surface">Install PickleScore</p>
              <p class="text-xs text-on-surface-muted mt-0.5">Add to your home screen for the best experience</p>
            </div>
            <button
              type="button"
              class="bg-primary text-surface text-sm font-semibold px-4 min-h-[44px] rounded-lg hover:bg-primary-dark transition-colors flex-shrink-0"
              aria-label="Install PickleScore"
              onClick={handleInstall}
            >
              Install
            </button>
          </div>
          <div class="flex items-center gap-3 mt-2 pt-2 border-t border-border">
            <button
              type="button"
              class="text-xs text-on-surface-muted hover:text-on-surface min-h-[44px] flex items-center"
              aria-label="Not now"
              onClick={() => dismissAndEscalate()}
            >
              Not now
            </button>
            <button
              type="button"
              class="text-xs text-on-surface-muted hover:text-on-surface min-h-[44px] flex items-center"
              aria-label="Don't ask again"
              onClick={() => neverDismiss()}
            >
              Don't ask again
            </button>
          </div>
        </div>
      </Show>

      {/* iOS Safari instructions */}
      <Show when={!isInstalled() && iosInstallSupported()}>
        <div class="bg-surface-light border border-border rounded-xl p-4">
          <p class="text-sm font-semibold text-on-surface">Install PickleScore</p>
          <p class="text-xs text-on-surface-muted mt-1">
            Tap the share button then "Add to Home Screen" to install
          </p>
        </div>
      </Show>
    </>
  );
};

export default InstallPromptBanner;
