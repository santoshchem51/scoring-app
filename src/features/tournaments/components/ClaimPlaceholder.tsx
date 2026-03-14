import { For } from 'solid-js';
import type { Component } from 'solid-js';

interface PlaceholderEntry {
  id: string;
  playerName: string | null;
}

interface ClaimPlaceholderProps {
  placeholders: PlaceholderEntry[];
  onClaim: (registrationId: string) => void;
  onSkip: () => void;
}

const ClaimPlaceholder: Component<ClaimPlaceholderProps> = (props) => {
  return (
    <div class="space-y-3 rounded-lg border border-outline bg-surface-container p-4">
      <p class="text-sm font-medium text-on-surface">Are you one of these players?</p>
      <div class="space-y-2">
        <For each={props.placeholders}>
          {(entry) => (
            <button
              class="w-full rounded-lg bg-surface-container-high p-3 text-left text-sm font-medium text-on-surface hover:bg-primary/10 transition-colors"
              onClick={() => props.onClaim(entry.id)}
            >
              {entry.playerName}
            </button>
          )}
        </For>
      </div>
      <button
        class="w-full rounded-lg bg-surface-container-high p-2 text-sm text-on-surface-muted"
        onClick={() => props.onSkip()}
      >
        None of these
      </button>
    </div>
  );
};

export default ClaimPlaceholder;
