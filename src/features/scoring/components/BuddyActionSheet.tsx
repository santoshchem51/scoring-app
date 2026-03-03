import type { Component } from 'solid-js';
import { Show } from 'solid-js';

interface BuddyActionSheetProps {
  open: boolean;
  buddyName: string;
  team1Name: string;
  team2Name: string;
  team1Color: string;
  team2Color: string;
  team1Full: boolean;
  team2Full: boolean;
  currentTeam: 1 | 2 | null;
  onAssign: (team: 1 | 2) => void;
  onUnassign: () => void;
  onClose: () => void;
}

const BuddyActionSheet: Component<BuddyActionSheetProps> = (props) => {
  const handleTeamClick = (team: 1 | 2) => {
    const isFull = team === 1 ? props.team1Full : props.team2Full;
    if (isFull) return;
    props.onAssign(team);
  };

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-end justify-center">
        <div
          data-testid="sheet-backdrop"
          class="absolute inset-0 bg-black/50"
          onClick={props.onClose}
        />
        <div
          class="relative w-full max-w-lg bg-surface rounded-t-2xl p-6 pb-safe"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="w-12 h-1 bg-surface-lighter rounded-full mx-auto mb-4" />
          <h3 class="text-lg font-bold text-on-surface mb-4">{props.buddyName}</h3>

          <div class="space-y-3">
            <button
              type="button"
              class="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
              classList={{
                'bg-surface-light': !props.team1Full,
                'bg-surface-light/50 opacity-50 cursor-not-allowed': props.team1Full,
              }}
              aria-disabled={props.team1Full ? 'true' : undefined}
              onClick={() => handleTeamClick(1)}
            >
              <span class="w-4 h-4 rounded-full flex-shrink-0" style={{ "background-color": props.team1Color }} />
              <span class="text-on-surface font-medium">
                {props.team1Name}{props.team1Full ? ' (full)' : ''}
              </span>
            </button>

            <button
              type="button"
              class="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
              classList={{
                'bg-surface-light': !props.team2Full,
                'bg-surface-light/50 opacity-50 cursor-not-allowed': props.team2Full,
              }}
              aria-disabled={props.team2Full ? 'true' : undefined}
              onClick={() => handleTeamClick(2)}
            >
              <span class="w-4 h-4 rounded-full flex-shrink-0" style={{ "background-color": props.team2Color }} />
              <span class="text-on-surface font-medium">
                {props.team2Name}{props.team2Full ? ' (full)' : ''}
              </span>
            </button>

            <Show when={props.currentTeam !== null}>
              <button
                type="button"
                class="w-full p-4 rounded-xl bg-surface-light text-red-400 font-medium transition-all active:scale-[0.98]"
                onClick={props.onUnassign}
              >
                Remove
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default BuddyActionSheet;
