import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { ScoringMode } from '../../../data/types';

interface Props {
  team1Name: string;
  team2Name: string;
  scoringMode: ScoringMode;
  servingTeam: 1 | 2;
  onScorePoint: (team: 1 | 2) => void;
  onSideOut: () => void;
  onUndo: () => void;
}

const ScoreControls: Component<Props> = (props) => {
  const team1Active = () => props.scoringMode === 'rally' || props.servingTeam === 1;
  const team2Active = () => props.scoringMode === 'rally' || props.servingTeam === 2;

  return (
    <div class="flex flex-col gap-3 px-4">
      {/* Score buttons row */}
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => props.onScorePoint(1)}
          class={`font-bold text-lg py-6 rounded-2xl transition-transform truncate px-3 ${
            team1Active() ? 'bg-primary text-surface active:scale-95' : 'bg-primary/30 text-surface/50 cursor-not-allowed'
          }`}
        >
          +1 {props.team1Name}
        </button>
        <button
          type="button"
          onClick={() => props.onScorePoint(2)}
          class={`font-bold text-lg py-6 rounded-2xl transition-transform truncate px-3 ${
            team2Active() ? 'bg-accent text-surface active:scale-95' : 'bg-accent/30 text-surface/50 cursor-not-allowed'
          }`}
        >
          +1 {props.team2Name}
        </button>
      </div>

      {/* Side Out button (only for side-out scoring) */}
      <Show when={props.scoringMode === 'sideout'}>
        <button
          type="button"
          onClick={() => props.onSideOut()}
          class="w-full bg-surface-lighter text-on-surface font-semibold text-base py-6 rounded-2xl active:scale-95 transition-transform"
        >
          Side Out
        </button>
      </Show>

      {/* Undo button */}
      <button
        type="button"
        onClick={() => props.onUndo()}
        class="w-full bg-surface-light text-on-surface-muted font-medium text-sm py-3 rounded-xl active:scale-95 transition-transform"
      >
        Undo Last
      </button>
    </div>
  );
};

export default ScoreControls;
