import { createSignal, createMemo } from 'solid-js';
import { Show } from 'solid-js/web';

interface QuickAddPlayersProps {
  onSubmit: (names: string[]) => void;
  existingNames?: string[];
}

export default function QuickAddPlayers(props: QuickAddPlayersProps) {
  const [text, setText] = createSignal('');

  const parsedNames = createMemo(() => {
    return text()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  });

  const tooLongNames = createMemo(() => {
    return parsedNames().filter((name) => name.length > 100);
  });

  const tooManyNames = createMemo(() => parsedNames().length > 100);

  const duplicates = createMemo(() => {
    const existing = (props.existingNames ?? []).map((n) => n.toLowerCase());
    return parsedNames().filter((name) => existing.includes(name.toLowerCase()));
  });

  const hasErrors = createMemo(
    () => tooLongNames().length > 0 || tooManyNames()
  );

  const validNames = createMemo(() => {
    if (hasErrors()) return [];
    return parsedNames();
  });

  const handleSubmit = () => {
    if (validNames().length === 0) return;
    props.onSubmit(validNames());
  };

  return (
    <div class="space-y-3">
      <textarea
        class="w-full rounded-lg border border-surface-border bg-surface-card p-3 text-on-surface placeholder-on-surface-muted focus:border-primary focus:outline-none"
        rows={6}
        placeholder="Enter one name per line"
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
      />

      <Show when={parsedNames().length > 0}>
        <p class="text-sm text-on-surface-muted">
          {parsedNames().length} name{parsedNames().length !== 1 ? 's' : ''} entered
        </p>
      </Show>

      <Show when={tooLongNames().length > 0}>
        <p class="text-sm text-red-400">
          {tooLongNames().length} name{tooLongNames().length !== 1 ? 's' : ''} exceeds 100 characters
        </p>
      </Show>

      <Show when={tooManyNames()}>
        <p class="text-sm text-red-400">
          Maximum 100 names allowed
        </p>
      </Show>

      <Show when={duplicates().length > 0}>
        <p class="text-sm text-yellow-400">
          Duplicate names: {duplicates().join(', ')}
        </p>
      </Show>

      <button
        type="button"
        class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
        disabled={validNames().length === 0}
        onClick={handleSubmit}
      >
        Add {validNames().length || ''} Player{validNames().length !== 1 ? 's' : ''}
      </button>
    </div>
  );
}
