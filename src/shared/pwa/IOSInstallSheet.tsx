import type { Component } from 'solid-js';
import { Show, createEffect, onCleanup } from 'solid-js';

interface Props {
  open?: boolean;
  onClose?: () => void;
}

const IOSInstallSheet: Component<Props> = (props) => {
  let dialogRef: HTMLDivElement | undefined;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose?.();
    }
    // Simple focus trap: keep focus within dialog
    if (e.key === 'Tab' && dialogRef) {
      const focusable = dialogRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  createEffect(() => {
    if (props.open) {
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
        onClick={() => props.onClose?.()}
      >
        {/* Sheet */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Install PickleScore on iOS"
          class="bg-surface rounded-t-2xl w-full max-w-lg p-6 pb-8 motion-safe:animate-slide-up"
          style={{ 'padding-bottom': 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="text-lg font-bold text-on-surface mb-4">Install PickleScore</h2>
          <ol class="space-y-4 text-sm text-on-surface-muted">
            <li class="flex items-start gap-3">
              <span class="bg-primary text-surface rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              <span>Tap the <strong class="text-on-surface">Share</strong> button <span aria-hidden="true">⎙</span> in Safari's toolbar</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="bg-primary text-surface rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <span>Scroll down and tap <strong class="text-on-surface">Add to Home Screen</strong> <span aria-hidden="true">+</span></span>
            </li>
            <li class="flex items-start gap-3">
              <span class="bg-primary text-surface rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              <span>Tap <strong class="text-on-surface">Add</strong> in the top-right corner</span>
            </li>
          </ol>
          <button
            type="button"
            class="mt-6 w-full bg-primary text-surface font-semibold py-3 min-h-[44px] rounded-xl hover:bg-primary-dark transition-colors"
            aria-label="Got it"
            onClick={() => props.onClose?.()}
          >
            Got it
          </button>
        </div>
      </div>
    </Show>
  );
};

export default IOSInstallSheet;
