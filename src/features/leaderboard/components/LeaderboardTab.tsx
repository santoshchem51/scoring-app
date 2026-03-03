import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { Trophy } from 'lucide-solid';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import type { LeaderboardScope } from '../hooks/useLeaderboard';
import type { LeaderboardTimeframe } from '../../../data/firebase/firestoreLeaderboardRepository';
import Podium from './Podium';
import RankingsList from './RankingsList';
import UserRankCard from './UserRankCard';
import EmptyState from '../../../shared/components/EmptyState';

/* ── Local helper: TogglePill ────────────────────────────── */

interface TogglePillProps {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const TogglePill: Component<TogglePillProps> = (props) => {
  return (
    <button
      type="button"
      role="radio"
      aria-pressed={props.active}
      aria-checked={props.active}
      disabled={props.disabled}
      onClick={() => props.onClick()}
      class={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        props.active
          ? 'bg-primary text-surface'
          : 'bg-surface-light text-on-surface-muted hover:text-on-surface'
      } ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {props.label}
    </button>
  );
};

/* ── Local helper: LoadingSkeleton ───────────────────────── */

const LoadingSkeleton: Component = () => {
  return (
    <div class="space-y-3 px-4 animate-pulse" aria-label="Loading leaderboard">
      {/* Podium skeleton */}
      <div class="grid grid-cols-3 gap-2">
        <div class="h-28 rounded-xl bg-surface-light" />
        <div class="h-32 rounded-xl bg-surface-light" />
        <div class="h-28 rounded-xl bg-surface-light" />
      </div>
      {/* Rank card skeleton */}
      <div class="h-20 rounded-xl bg-surface-light" />
      {/* List skeleton */}
      <div class="h-14 rounded-xl bg-surface-light" />
      <div class="h-14 rounded-xl bg-surface-light" />
      <div class="h-14 rounded-xl bg-surface-light" />
    </div>
  );
};

/* ── Main component ──────────────────────────────────────── */

const LeaderboardTab: Component = () => {
  const { user } = useAuth();
  const leaderboard = useLeaderboard();

  const topThree = () => leaderboard.entries().slice(0, 3);
  const rest = () => leaderboard.entries().slice(3);

  return (
    <div class="space-y-4 py-4">
      {/* Toggle controls */}
      <div class="flex flex-wrap items-center gap-3 px-4">
        <div role="group" aria-label="Leaderboard scope">
          <div class="flex gap-1">
            <TogglePill
              label="Global"
              active={leaderboard.scope() === 'global'}
              onClick={() => leaderboard.setScope('global' as LeaderboardScope)}
            />
            <TogglePill
              label="Friends"
              active={leaderboard.scope() === 'friends'}
              disabled={!user()}
              onClick={() => {
                if (user()) leaderboard.setScope('friends' as LeaderboardScope);
              }}
            />
          </div>
        </div>

        <div role="group" aria-label="Leaderboard timeframe">
          <div class="flex gap-1">
            <TogglePill
              label="All Time"
              active={leaderboard.timeframe() === 'allTime'}
              onClick={() => leaderboard.setTimeframe('allTime' as LeaderboardTimeframe)}
            />
            <TogglePill
              label="Last 30 Days"
              active={leaderboard.timeframe() === 'last30d'}
              onClick={() => leaderboard.setTimeframe('last30d' as LeaderboardTimeframe)}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <Show when={!leaderboard.loading()} fallback={<LoadingSkeleton />}>
        <Show
          when={leaderboard.entries().length > 0}
          fallback={
            <EmptyState
              icon={<Trophy size={32} />}
              title="No rankings yet"
              description="Play some matches to see where you stand on the leaderboard."
            />
          }
        >
          <div class="space-y-4">
            <Show when={topThree().length > 0}>
              <Podium entries={topThree()} />
            </Show>

            <Show when={user()}>
              <UserRankCard
                entry={leaderboard.userEntry()}
                rank={leaderboard.userRank()}
                totalMatches={leaderboard.userEntry()?.totalMatches ?? 0}
              />
            </Show>

            <Show when={rest().length > 0}>
              <RankingsList entries={rest()} startRank={4} currentUserUid={user()?.uid} />
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default LeaderboardTab;
