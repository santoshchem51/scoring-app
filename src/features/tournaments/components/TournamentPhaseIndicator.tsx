import { Show } from 'solid-js';
import { statusLabels } from '../constants';

interface TournamentPhaseIndicatorProps {
  status: string;
  liveMatchCount: number;
  currentRound?: number;
  totalRounds?: number;
}

export default function TournamentPhaseIndicator(props: TournamentPhaseIndicatorProps) {
  const label = () => statusLabels[props.status] ?? props.status;
  const isCompleted = () => props.status === 'completed';

  const hasRoundInfo = () =>
    props.currentRound != null && props.totalRounds != null;

  return (
    <p class="text-sm text-on-surface-muted">
      <span>{label()}</span>
      <Show when={!isCompleted() && hasRoundInfo()}>
        <span> · Round {props.currentRound} of {props.totalRounds}</span>
      </Show>
      <Show when={!isCompleted() && props.liveMatchCount > 0}>
        <span> · {props.liveMatchCount} matches in progress</span>
      </Show>
    </p>
  );
}
