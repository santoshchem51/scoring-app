import { Show } from 'solid-js';
import { statusLabels } from '../constants';

interface TournamentPhaseIndicatorProps {
  status: string;
  liveMatchCount: number;
}

export default function TournamentPhaseIndicator(props: TournamentPhaseIndicatorProps) {
  const label = () => statusLabels[props.status] ?? props.status;
  const isCompleted = () => props.status === 'completed';

  return (
    <p class="text-sm" style={{ color: '#4B5563' }}>
      <span>{label()}</span>
      <Show when={!isCompleted() && props.liveMatchCount > 0}>
        <span> · {props.liveMatchCount} matches in progress</span>
      </Show>
    </p>
  );
}
