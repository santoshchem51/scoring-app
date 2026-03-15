import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { ScoringMode } from '../../../data/types';
import { useSoundEffects } from '../../../shared/hooks/useSoundEffects';
import { useHaptics } from '../../../shared/hooks/useHaptics';

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
  const sounds = useSoundEffects();
  const haptics = useHaptics();
  const team1Active = () => props.scoringMode === 'rally' || props.servingTeam === 1;
  const team2Active = () => props.scoringMode === 'rally' || props.servingTeam === 2;

  return (
    <div class="flex flex-col gap-3 px-4" role="group" aria-label="Score controls">
      {/* Score buttons row */}
      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { props.onScorePoint(1); sounds.scorePoint(); haptics.medium(); }}
          disabled={!team1Active()}
          aria-label={`Score point for ${props.team1Name}`}
          aria-disabled={!team1Active()}
          class={`font-bold text-lg py-6 rounded-2xl truncate px-3 uppercase tracking-wider ${
            team1Active() ? 'bg-primary text-surface active:scale-95' : 'bg-primary/30 text-surface/50 cursor-not-allowed'
          }`}
          style={{ "font-family": "var(--font-score)", "font-weight": "400", "transition": "transform 0.15s ease" }}
        >
          +1 {props.team1Name}
        </button>
        <button
          type="button"
          onClick={() => { props.onScorePoint(2); sounds.scorePoint(); haptics.medium(); }}
          disabled={!team2Active()}
          aria-label={`Score point for ${props.team2Name}`}
          aria-disabled={!team2Active()}
          class={`font-bold text-lg py-6 rounded-2xl truncate px-3 uppercase tracking-wider ${
            team2Active() ? 'bg-accent text-surface active:scale-95' : 'bg-accent/30 text-surface/50 cursor-not-allowed'
          }`}
          style={{ "font-family": "var(--font-score)", "font-weight": "400", "transition": "transform 0.15s ease" }}
        >
          +1 {props.team2Name}
        </button>
      </div>

      {/* Side Out button (only for side-out scoring) */}
      <Show when={props.scoringMode === 'sideout'}>
        <button
          type="button"
          onClick={() => { props.onSideOut(); sounds.sideOut(); haptics.double(); }}
          aria-label="Side out - change serving team"
          class="w-full text-on-surface font-semibold text-base py-6 rounded-2xl active:scale-95 uppercase tracking-wider border border-court-line-strong"
          style={{ "font-family": "var(--font-score)", "font-weight": "400", "background": "var(--color-surface-overlay)", "transition": "transform 0.15s ease" }}
        >
          Side Out
        </button>
      </Show>

      {/* Undo button */}
      <button
        type="button"
        onClick={() => { props.onUndo(); sounds.undo(); haptics.light(); }}
        aria-label="Undo last action"
        class="w-full text-on-surface-muted font-medium text-sm py-3 rounded-xl active:scale-95"
        style={{ "background": "var(--color-surface-overlay)", "opacity": "0.7", "transition": "transform 0.15s ease" }}
      >
        Undo Last
      </button>
    </div>
  );
};

export default ScoreControls;
