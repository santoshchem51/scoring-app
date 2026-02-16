import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import type { Tournament } from '../../../data/types';
import { statusColors, statusLabels, formatLabels } from '../constants';

interface Props {
  tournament: Tournament;
}

const TournamentCard: Component<Props> = (props) => {
  const dateStr = () => new Date(props.tournament.date).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <A
      href={`/tournaments/${props.tournament.id}`}
      class="block bg-surface-light rounded-xl p-4 active:scale-[0.98] hover-lift transition-all duration-200"
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
