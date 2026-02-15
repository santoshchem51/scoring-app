import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import type { Tournament } from '../../../data/types';

interface Props {
  tournament: Tournament;
}

const statusColors: Record<string, string> = {
  setup: 'bg-yellow-500/20 text-yellow-400',
  registration: 'bg-blue-500/20 text-blue-400',
  'pool-play': 'bg-green-500/20 text-green-400',
  bracket: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-on-surface-muted/20 text-on-surface-muted',
  cancelled: 'bg-red-500/20 text-red-400',
  paused: 'bg-orange-500/20 text-orange-400',
};

const statusLabels: Record<string, string> = {
  setup: 'Setup',
  registration: 'Registration Open',
  'pool-play': 'Pool Play',
  bracket: 'Bracket',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
};

const formatLabels: Record<string, string> = {
  'round-robin': 'Round Robin',
  'single-elimination': 'Single Elimination',
  'pool-bracket': 'Pool Play + Bracket',
};

const TournamentCard: Component<Props> = (props) => {
  const dateStr = () => new Date(props.tournament.date).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <A
      href={`/tournaments/${props.tournament.id}`}
      class="block bg-surface-light rounded-xl p-4 active:scale-[0.98] transition-transform"
    >
      <div class="flex items-start justify-between gap-2 mb-2">
        <h3 class="font-bold text-on-surface truncate">{props.tournament.name}</h3>
        <span class={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[props.tournament.status] ?? ''}`}>
          {statusLabels[props.tournament.status] ?? props.tournament.status}
        </span>
      </div>
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-muted">
        <span>{dateStr()}</span>
        <span>{props.tournament.location}</span>
        <span>{formatLabels[props.tournament.format] ?? props.tournament.format}</span>
      </div>
    </A>
  );
};

export default TournamentCard;
