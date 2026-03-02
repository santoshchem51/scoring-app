import { Show, For, createEffect, on } from 'solid-js';
import type { Component } from 'solid-js';
import type { MatchRef } from '../../../data/types';

interface RecentMatchesProps {
  matches: MatchRef[];
  onLoadMore?: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

function formatOpponentName(match: MatchRef): string {
  return match.opponentNames.join(' & ');
}

const RecentMatches: Component<RecentMatchesProps> = (props) => {
  let listRef: HTMLUListElement | undefined;
  let prevCount = 0;

  // After matches array grows (from Load More), focus the first new row
  createEffect(on(() => props.matches.length, (count) => {
    if (count > prevCount && prevCount > 0 && listRef) {
      const buttons = listRef.querySelectorAll<HTMLButtonElement>('li button');
      const firstNew = buttons[prevCount];
      if (firstNew) {
        queueMicrotask(() => firstNew.focus());
      }
    }
    prevCount = count;
  }));

  return (
    <section aria-labelledby="matches-heading">
      <h2
        id="matches-heading"
        class="text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-3"
      >
        Recent Matches
      </h2>

      <div class="bg-surface rounded-xl overflow-hidden">
        <ul ref={listRef} role="list" aria-label="Recent match results" class="divide-y divide-surface-lighter">
          <For each={props.matches}>
            {(match) => (
              <li>
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left hover:bg-surface-lighter transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
                  aria-label={`${match.result === 'win' ? 'Win' : 'Loss'} against ${formatOpponentName(match)}, ${match.scores}, ${formatRelativeDate(match.completedAt)}`}
                >
                  {/* W/L badge */}
                  <span
                    class={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      match.result === 'win'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-400/20 text-red-400'
                    }`}
                    aria-hidden="true"
                  >
                    {match.result === 'win' ? 'W' : 'L'}
                  </span>

                  {/* Opponent name */}
                  <span class="text-sm text-on-surface font-medium truncate flex-1">
                    vs {formatOpponentName(match)}
                  </span>

                  {/* Score */}
                  <span class="text-sm text-on-surface-muted flex-shrink-0">
                    {match.scores}
                  </span>

                  {/* Date */}
                  <span class="text-xs text-on-surface-muted w-8 text-right flex-shrink-0">
                    {formatRelativeDate(match.completedAt)}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>

        <Show when={props.hasMore}>
          <div class="border-t border-surface-lighter px-4 py-3">
            <button
              type="button"
              onClick={() => props.onLoadMore?.()}
              disabled={props.loadingMore}
              class="w-full text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 min-h-[48px]"
              aria-label="Load more matches"
            >
              {props.loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        </Show>
      </div>

    </section>
  );
};

export default RecentMatches;
