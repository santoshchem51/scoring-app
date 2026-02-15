import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { TEAM_COLORS } from '../constants/teamColors';

interface Props {
  selected: string;
  onSelect: (hex: string) => void;
  label: string;
}

const ColorPicker: Component<Props> = (props) => {
  return (
    <div class="flex gap-2" role="radiogroup" aria-label={props.label}>
      <For each={TEAM_COLORS}>
        {(color) => (
          <button
            type="button"
            onClick={() => props.onSelect(color.hex)}
            class={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${
              props.selected === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ "background-color": color.hex }}
            role="radio"
            aria-checked={props.selected === color.hex}
            aria-label={color.name}
          >
            <Show when={props.selected === color.hex}>
              <svg class="w-4 h-4 text-white drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </Show>
          </button>
        )}
      </For>
    </div>
  );
};

export default ColorPicker;
