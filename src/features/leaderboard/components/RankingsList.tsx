import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { LeaderboardEntry } from '../../../data/types';
import TierBadge from '../../profile/components/TierBadge';

interface RankingsListProps {
  entries: LeaderboardEntry[];
  startRank: number;
}

const RankingsList: Component<RankingsListProps> = (props) => {
  return (
    <div class="flex flex-col gap-1 px-4">
      <For each={props.entries}>
        {(entry, index) => {
          const rank = () => props.startRank + index();

          return (
            <div class="flex items-center gap-3 bg-surface-light rounded-xl p-3 border border-border">
              {/* Rank number */}
              <span class="text-on-surface-muted font-bold text-sm w-6 text-center shrink-0">
                {rank()}
              </span>

              {/* Avatar */}
              <Show
                when={entry.photoURL}
                fallback={
                  <div class="w-8 h-8 rounded-full bg-surface-lighter flex items-center justify-center text-on-surface-muted font-bold text-xs shrink-0">
                    {entry.displayName.charAt(0).toUpperCase()}
                  </div>
                }
              >
                <img
                  src={entry.photoURL!}
                  alt={entry.displayName}
                  class="w-8 h-8 rounded-full object-cover shrink-0"
                />
              </Show>

              {/* Name + tier */}
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-on-surface text-sm font-medium truncate">
                  {entry.displayName}
                </span>
                <TierBadge tier={entry.tier} confidence={entry.tierConfidence} />
              </div>

              {/* Stats: score, win rate, streak */}
              <div class="flex items-center gap-3 shrink-0">
                <span class="text-on-surface font-bold text-sm">
                  {entry.compositeScore.toFixed(1)}
                </span>

                <span class="text-on-surface-muted text-xs w-8 text-right">
                  {Math.round(entry.winRate * 100)}%
                </span>

                <Show when={entry.currentStreak.count > 0}>
                  <span
                    class={`text-xs font-bold w-6 text-center ${
                      entry.currentStreak.type === 'W' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {entry.currentStreak.type}{entry.currentStreak.count}
                  </span>
                </Show>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export default RankingsList;
