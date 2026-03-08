import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { pendingToasts, dismissToast } from '../store/achievementStore';
import type { PendingToast } from '../store/achievementStore';

const APPEAR_DELAY = 1500;
const VISIBLE_DURATION = 5000;
const GAP_BETWEEN = 3000;
const EXIT_ANIMATION = 300;

const TIER_BORDER: Record<string, string> = {
  bronze: 'border-l-amber-600',
  silver: 'border-l-[#c0c0c0]',
  gold: 'border-l-yellow-400',
};

const AchievementToast: Component = () => {
  const [current, setCurrent] = createSignal<PendingToast | null>(null);
  const [visible, setVisible] = createSignal(false);
  const [srText, setSrText] = createSignal('');
  let timers: ReturnType<typeof setTimeout>[] = [];

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function processNext() {
    const toasts = pendingToasts();
    if (toasts.length === 0 || current()) return;

    const next = toasts[0];
    setCurrent(next);
    setSrText('');
    setTimeout(() => setSrText(`Achievement unlocked: ${next.name}. ${next.description}`), 100);

    const appearTimer = setTimeout(() => setVisible(true), APPEAR_DELAY);
    const dismissTimer = setTimeout(() => {
      handleDismiss(next.id);
    }, APPEAR_DELAY + VISIBLE_DURATION);

    timers = [appearTimer, dismissTimer];
  }

  function handleDismiss(id: string) {
    clearTimers();
    setVisible(false);
    const exitTimer = setTimeout(() => {
      dismissToast(id);
      setCurrent(null);
      const gapTimer = setTimeout(processNext, GAP_BETWEEN);
      timers.push(gapTimer);
    }, EXIT_ANIMATION);
    timers = [exitTimer];
  }

  createEffect(() => {
    if (pendingToasts().length > 0 && !current()) {
      processNext();
    }
  });

  onCleanup(clearTimers);

  return (
    <>
      {/* Screen reader live region — always in DOM */}
      <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
        {srText()}
      </div>

      {/* Visual toast */}
      <Show when={current()}>
        {(toast) => (
          <div
            class={`fixed z-50 left-1/2 -translate-x-1/2 max-w-sm w-[90vw] pointer-events-none`}
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px + 8px)' }}
          >
            <div
              class={`pointer-events-auto bg-surface-light border-l-4 ${TIER_BORDER[toast().tier] ?? 'border-l-primary'} rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 motion-safe:transition-all motion-safe:duration-300 ${visible() ? 'opacity-100 motion-safe:translate-y-0' : 'opacity-0 motion-safe:-translate-y-4'}`}
              aria-hidden="true"
            >
              <span class="text-2xl flex-shrink-0" aria-hidden="true">{toast().icon}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-on-surface">{toast().name}</div>
                <div class="text-xs text-on-surface-muted">{toast().description}</div>
              </div>
              <button
                type="button"
                class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-lighter transition-colors text-on-surface-muted"
                aria-label="Dismiss achievement notification"
                onClick={() => handleDismiss(toast().id)}
              >
                <span aria-hidden="true" class="text-lg">&times;</span>
              </button>
            </div>
          </div>
        )}
      </Show>
    </>
  );
};

export default AchievementToast;
