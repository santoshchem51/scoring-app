import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { Trophy, Medal, Award } from 'lucide-solid';
import type { LeaderboardEntry } from '../../../data/types';
import TierBadge from '../../profile/components/TierBadge';

interface PodiumProps {
  entries: LeaderboardEntry[];
}

const RANK_STYLES = [
  { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  { icon: Medal, color: 'text-slate-300', bg: 'bg-slate-300/10', border: 'border-slate-300/30' },
  { icon: Award, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
];

const Podium: Component<PodiumProps> = (props) => {
  return (
    <div class="grid grid-cols-3 gap-2 px-4">
      <For each={props.entries.slice(0, 3)}>
        {(entry, index) => {
          const style = RANK_STYLES[index()];
          const Icon = style.icon;

          return (
            <div
              class={`flex flex-col items-center gap-2 rounded-xl p-3 border ${style.bg} ${style.border} ${
                index() === 0 ? 'scale-105' : ''
              }`}
            >
              <div class={`flex items-center gap-1 ${style.color} font-bold text-sm`}>
                <Icon size={16} />
                <span>#{index() + 1}</span>
              </div>

              <Show
                when={entry.photoURL}
                fallback={
                  <div class="w-10 h-10 rounded-full bg-surface-lighter flex items-center justify-center text-on-surface-muted font-bold text-sm">
                    {entry.displayName.charAt(0).toUpperCase()}
                  </div>
                }
              >
                <img
                  src={entry.photoURL!}
                  alt={entry.displayName}
                  class="w-10 h-10 rounded-full object-cover"
                />
              </Show>

              <span class="text-on-surface text-xs font-medium text-center truncate w-full">
                {entry.displayName}
              </span>

              <TierBadge tier={entry.tier} confidence={entry.tierConfidence} />

              <span class={`text-lg font-bold ${style.color}`}>
                {entry.compositeScore.toFixed(1)}
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export default Podium;
