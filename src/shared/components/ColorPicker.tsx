import { For } from 'solid-js';
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
            class={`w-8 h-8 rounded-full transition-transform ${
              props.selected === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ "background-color": color.hex }}
            role="radio"
            aria-checked={props.selected === color.hex}
            aria-label={color.name}
          />
        )}
      </For>
    </div>
  );
};

export default ColorPicker;
