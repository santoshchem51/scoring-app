import type { Component } from 'solid-js';
import type { Tournament } from '../../../data/types';
import { A } from '@solidjs/router';
import { Calendar, Activity, Trophy, X } from 'lucide-solid';
import { formatLabels, statusLabels, statusColors } from '../constants';

interface BrowseCardProps {
  tournament: Tournament;
  registrationCount: number;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusIcon(props: { status: string }) {
  const size = 14;
  const iconClass = 'shrink-0';

  if (props.status === 'setup' || props.status === 'registration') {
    return <Calendar size={size} class={iconClass} />;
  }
  if (props.status === 'pool-play' || props.status === 'bracket') {
    return <Activity size={size} class={iconClass} />;
  }
  if (props.status === 'completed') {
    return <Trophy size={size} class={iconClass} />;
  }
  if (props.status === 'cancelled') {
    return <X size={size} class={iconClass} />;
  }
  return null;
}

const BrowseCard: Component<BrowseCardProps> = (props) => {
  const href = () =>
    props.tournament.shareCode
      ? `/t/${props.tournament.shareCode}`
      : `/tournaments/${props.tournament.id}`;

  const registrationText = () =>
    props.tournament.maxPlayers
      ? `${props.registrationCount}/${props.tournament.maxPlayers} registered`
      : `${props.registrationCount} registered`;

  return (
    <A
      href={href()}
      class="block bg-surface-light rounded-xl p-4 border border-border active:scale-[0.98] hover-lift transition-all duration-200"
    >
      {/* Tournament name */}
      <h3 class="font-bold text-on-surface truncate">{props.tournament.name}</h3>

      {/* Date + Location */}
      <p class="text-sm text-on-surface-muted mt-1 truncate">
        {formatDate(props.tournament.date)} &middot; {props.tournament.location}
      </p>

      {/* Badges row */}
      <div class="flex items-center gap-2 mt-3 flex-wrap">
        {/* Format badge */}
        <span class="text-xs font-medium bg-surface-lighter text-on-surface-muted px-2 py-0.5 rounded-full">
          {formatLabels[props.tournament.format] ?? props.tournament.format}
        </span>

        {/* Status badge */}
        <span
          class={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${statusColors[props.tournament.status] ?? ''}`}
        >
          <StatusIcon status={props.tournament.status} />
          {statusLabels[props.tournament.status] ?? props.tournament.status}
        </span>
      </div>

      {/* Registration count */}
      <p class="text-xs text-on-surface-muted mt-2">{registrationText()}</p>
    </A>
  );
};

export default BrowseCard;
