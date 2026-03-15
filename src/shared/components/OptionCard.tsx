import { Show } from 'solid-js';
import type { Component } from 'solid-js';

interface Props {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

const OptionCard: Component<Props> = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      class={`w-full p-4 rounded-xl text-left active:scale-[0.97] hover-lift ${
        props.selected
          ? 'border-2 border-primary text-on-surface'
          : 'border-2 border-surface-lighter text-on-surface-muted hover:border-on-surface-muted'
      }`}
      style={{
        "background": props.selected ? 'var(--color-glass-surface)' : 'var(--color-surface-light)',
        "transition": "transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
      }}
    >
      <div class="font-semibold">{props.label}</div>
      <Show when={props.description}>
        <div class="text-sm text-on-surface-muted mt-0.5">{props.description}</div>
      </Show>
    </button>
  );
};

export default OptionCard;
