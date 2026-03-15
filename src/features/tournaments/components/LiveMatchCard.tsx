import { Show } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { useLiveMatch } from '../hooks/useLiveMatch';
import { extractLiveScore, extractGameCount } from '../engine/scoreExtraction';

export interface LiveMatchCardProps {
  matchId: string;
  team1Name: string;
  team2Name: string;
  court?: string;
  status: 'in-progress' | 'completed';
  tournamentCode: string;
}

const LiveMatchCard: Component<LiveMatchCardProps> = (props): JSX.Element => {
  // Only subscribe for in-progress matches (max 3 listeners from LiveNowSection)
  const { match, loading } = useLiveMatch(
    () => props.status === 'in-progress' ? props.matchId : null,
  );

  const score = () => {
    const m = match();
    if (!m) return null;
    return extractLiveScore(m);
  };

  const gameCount = () => {
    const m = match();
    if (!m) return null;
    return extractGameCount(m);
  };

  const borderClass = () =>
    props.status === 'in-progress' ? 'border-l-amber-500' : 'border-l-green-500';

  const ariaLabel = () => {
    const courtPart = props.court ? `Court ${props.court}: ` : '';
    const statusPart = props.status === 'in-progress' ? 'live' : 'final';
    const s = score();
    const scorePart = s ? ` ${s.team1Score} to ${s.team2Score}` : '';
    return `${courtPart}${props.team1Name} versus ${props.team2Name}${scorePart}, ${statusPart}`;
  };

  return (
    <li>
      <a
        href={`/t/${props.tournamentCode}/match/${props.matchId}`}
        aria-label={ariaLabel()}
        class={`block rounded-lg border border-surface-lighter bg-surface-light px-3 py-2 hover:bg-surface-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors border-l-4 ${borderClass()}`}
      >
        {/* Compact score layout */}
        <div class="flex items-center justify-between gap-2" aria-hidden="true">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <Show when={props.court}>
              <span class="text-xs text-on-surface-muted shrink-0">Ct {props.court}</span>
            </Show>
            <span class="text-sm text-on-surface truncate">{props.team1Name}</span>
            <Show when={!loading() && score()} fallback={
              <span class="text-sm text-on-surface-muted font-mono w-12 text-center">
                {/* Score skeleton */}
                <span class="inline-block w-3 h-4 bg-surface-lighter rounded animate-pulse" />
                <span class="mx-0.5">-</span>
                <span class="inline-block w-3 h-4 bg-surface-lighter rounded animate-pulse" />
              </span>
            }>
              <span class="text-sm font-bold text-on-surface font-mono whitespace-nowrap">
                {score()!.team1Score} - {score()!.team2Score}
              </span>
            </Show>
            <span class="text-sm text-on-surface truncate">{props.team2Name}</span>
          </div>
          <div class="shrink-0">
            <Show when={props.status === 'in-progress'}>
              <span class="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            </Show>
            <Show when={props.status === 'completed'}>
              <span class="text-xs font-semibold text-green-400">FINAL</span>
            </Show>
          </div>
        </div>
      </a>
    </li>
  );
};

export default LiveMatchCard;
