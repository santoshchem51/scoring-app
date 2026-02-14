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
      class={`w-full p-4 rounded-xl text-left transition-all active:scale-95 ${
        props.selected
          ? 'bg-primary/20 border-2 border-primary text-on-surface'
          : 'bg-surface-light border-2 border-surface-lighter text-on-surface-muted hover:border-on-surface-muted'
      }`}
    >
      <div class="font-semibold">{props.label}</div>
      {props.description && (
        <div class="text-sm text-on-surface-muted mt-0.5">{props.description}</div>
      )}
    </button>
  );
};

export default OptionCard;
