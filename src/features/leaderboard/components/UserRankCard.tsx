import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { Trophy } from 'lucide-solid';
import type { LeaderboardEntry } from '../../../data/types';
import TierBadge from '../../profile/components/TierBadge';

interface UserRankCardProps {
  entry: LeaderboardEntry | null;
  rank: number | null;
  totalMatches: number;
}

const MIN_MATCHES_TO_QUALIFY = 5;

const UserRankCard: Component<UserRankCardProps> = (props) => {
  const matchesNeeded = () => Math.max(0, MIN_MATCHES_TO_QUALIFY - props.totalMatches);

  return (
    <div class="mx-4 bg-surface-light rounded-xl p-4 shadow-md border border-primary/30">
      <div class="text-xs font-bold text-primary uppercase tracking-wider mb-3">
        Your Ranking
      </div>

      <Show
        when={props.entry}
        fallback={
          <div class="flex flex-col items-center gap-2 py-2">
            <div class="w-10 h-10 rounded-full bg-surface-lighter flex items-center justify-center text-on-surface-muted">
              <Trophy size={20} />
            </div>
            <Show
              when={props.totalMatches < MIN_MATCHES_TO_QUALIFY}
              fallback={
                <span class="text-on-surface-muted text-sm">No ranking yet</span>
              }
            >
              <span class="text-on-surface-muted text-sm">
                Play {matchesNeeded()} more matches to qualify
              </span>
            </Show>
          </div>
        }
      >
        {(entry) => (
          <div class="flex items-center gap-3">
            {/* Rank */}
            <span class="text-primary font-bold text-lg shrink-0">
              #{props.rank ?? '?'}
            </span>

            {/* Avatar */}
            <Show
              when={entry().photoURL}
              fallback={
                <div class="w-10 h-10 rounded-full bg-surface-lighter flex items-center justify-center text-on-surface-muted font-bold text-sm shrink-0">
                  {entry().displayName.charAt(0).toUpperCase()}
                </div>
              }
            >
              <img
                src={entry().photoURL!}
                alt={entry().displayName}
                class="w-10 h-10 rounded-full object-cover shrink-0"
              />
            </Show>

            {/* Name + tier */}
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-on-surface text-sm font-medium truncate">
                {entry().displayName}
              </span>
              <TierBadge tier={entry().tier} confidence={entry().tierConfidence} />
            </div>

            {/* Score */}
            <span class="text-on-surface font-bold text-lg shrink-0">
              {entry().compositeScore.toFixed(1)}
            </span>
          </div>
        )}
      </Show>
    </div>
  );
};

export default UserRankCard;
