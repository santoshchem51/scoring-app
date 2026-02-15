import { Show, onMount, onCleanup, createEffect, createUniqueId } from 'solid-js';
import type { Component } from 'solid-js';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined;
  let confirmBtnRef: HTMLButtonElement | undefined;
  const titleId = `confirm-title-${createUniqueId()}`;
  const messageId = `confirm-message-${createUniqueId()}`;

  // Focus management: focus confirm button when opened
  createEffect(() => {
    if (props.open && confirmBtnRef) {
      confirmBtnRef.focus();
    }
  });

  // Body scroll lock
  createEffect(() => {
    if (props.open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  // Keyboard: Escape to cancel, Tab trap
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      props.onCancel();
      return;
    }

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

  onMount(() => document.addEventListener('keydown', handleKeyDown));
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.body.style.overflow = '';
  });

  const confirmColor = () =>
    props.variant === 'danger'
      ? 'bg-error text-white'
      : 'bg-primary text-surface';

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50 flex items-end md:items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) props.onCancel(); }}
      >
        <div class="fixed inset-0 bg-black/60" aria-hidden="true" />

        {/* Dialog */}
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          class="relative z-10 w-full md:max-w-sm bg-surface-light rounded-t-2xl md:rounded-2xl p-6 space-y-4"
        >
          <h2 id={titleId} class="text-lg font-bold text-on-surface">
            {props.title}
          </h2>
          <p id={messageId} class="text-on-surface-muted">
            {props.message}
          </p>
          <div class="flex gap-3 pt-2">
            <button
              type="button"
              onClick={props.onCancel}
              class="flex-1 py-3 rounded-xl bg-surface-lighter text-on-surface font-semibold active:scale-95 transition-transform"
            >
              {props.cancelLabel ?? 'Cancel'}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={props.onConfirm}
              class={`flex-1 py-3 rounded-xl font-semibold active:scale-95 transition-transform ${confirmColor()}`}
            >
              {props.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ConfirmDialog;
