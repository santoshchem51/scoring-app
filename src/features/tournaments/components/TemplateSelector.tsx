import { createSignal, Show, For } from 'solid-js';
import type { TournamentTemplate } from '../engine/templateTypes';

interface TemplateSelectorProps {
  templates: TournamentTemplate[];
  onSelect: (template: TournamentTemplate) => void;
}

export default function TemplateSelector(props: TemplateSelectorProps) {
  const [open, setOpen] = createSignal(false);

  function handleSelect(template: TournamentTemplate) {
    props.onSelect(template);
    setOpen(false);
  }

  return (
    <div class="relative inline-block">
      <button
        type="button"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
      >
        From Template
      </button>

      <Show when={open()}>
        <div class="absolute z-10 mt-1 w-56 rounded border bg-white shadow-lg">
          <Show
            when={props.templates.length > 0}
            fallback={<p class="px-3 py-2 text-sm text-gray-500">No templates yet</p>}
          >
            <ul role="listbox">
              <For each={props.templates}>
                {(tpl) => (
                  <li>
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => handleSelect(tpl)}
                    >
                      {tpl.name}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>
    </div>
  );
}
