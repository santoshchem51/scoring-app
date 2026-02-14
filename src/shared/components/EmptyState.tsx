import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';

interface EmptyStateProps {
  icon: JSX.Element;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

const EmptyState: Component<EmptyStateProps> = (props) => {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div class="w-16 h-16 rounded-2xl bg-surface-lighter flex items-center justify-center mb-4 text-on-surface-muted">
        {props.icon}
      </div>
      <h2 class="text-lg font-bold text-on-surface mb-2">{props.title}</h2>
      <p class="text-sm text-on-surface-muted mb-6 max-w-xs">{props.description}</p>
      <Show when={props.actionLabel}>
        <Show
          when={props.actionHref}
          fallback={
            <button
              type="button"
              onClick={props.onAction}
              class="bg-primary text-surface font-semibold px-6 py-3 rounded-xl active:scale-95 transition-transform"
            >
              {props.actionLabel}
            </button>
          }
        >
          <a
            href={props.actionHref}
            class="inline-block bg-primary text-surface font-semibold px-6 py-3 rounded-xl active:scale-95 transition-transform"
          >
            {props.actionLabel}
          </a>
        </Show>
      </Show>
    </div>
  );
};

export default EmptyState;
