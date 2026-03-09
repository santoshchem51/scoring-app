import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { swUpdateVisible, applyUpdate, dismissUpdate } from './swUpdateStore';

const SWUpdateToast: Component = () => {
  return (
    <div role="status" aria-live="polite" class="contents">
      <Show when={swUpdateVisible()}>
        <div
          class="fixed z-40 right-4 max-w-sm w-[90vw] sm:w-auto pointer-events-auto"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div class="bg-surface-light border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 motion-safe:transition-all motion-safe:duration-300">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-on-surface">A new version is available</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                class="text-xs text-on-surface-muted hover:text-on-surface min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Remind me tomorrow"
                onClick={() => dismissUpdate()}
              >
                Remind me tomorrow
              </button>
              <button
                type="button"
                class="bg-primary text-surface text-sm font-semibold px-4 min-h-[44px] rounded-lg hover:bg-primary-dark transition-colors"
                aria-label="Update now"
                onClick={() => applyUpdate()}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default SWUpdateToast;
