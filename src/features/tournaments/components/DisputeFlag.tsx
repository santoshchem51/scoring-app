import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';

interface DisputeFlagProps {
  canFlag: boolean;
  onFlag: (reason: string) => void;
}

const DisputeFlag: Component<DisputeFlagProps> = (props) => {
  const [showForm, setShowForm] = createSignal(false);
  const [reason, setReason] = createSignal('');

  const handleSubmit = () => {
    const r = reason().trim();
    if (!r) return;
    props.onFlag(r);
    setReason('');
    setShowForm(false);
  };

  return (
    <Show when={props.canFlag}>
      <Show when={!showForm()} fallback={
        <div class="space-y-2">
          <textarea
            class="w-full rounded-lg border border-outline bg-surface-container p-2 text-sm text-on-surface"
            placeholder="Describe the issue..."
            value={reason()}
            onInput={(e) => setReason(e.currentTarget.value)}
            rows={3}
          />
          <div class="flex gap-2">
            <button
              class="rounded-lg bg-error px-3 py-1.5 text-sm font-medium text-on-error"
              onClick={handleSubmit}
            >Submit</button>
            <button
              class="rounded-lg bg-surface-container-high px-3 py-1.5 text-sm text-on-surface"
              onClick={() => setShowForm(false)}
            >Cancel</button>
          </div>
        </div>
      }>
        <button
          class="rounded-lg bg-error/10 px-3 py-1.5 text-sm font-medium text-error"
          onClick={() => setShowForm(true)}
        >Flag Dispute</button>
      </Show>
    </Show>
  );
};

export default DisputeFlag;
