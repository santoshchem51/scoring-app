import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { PlayerStats } from '../engine/playerStats';

interface Props {
  stats: PlayerStats;
  playerTeamName: string;
}

const MyStatsCard: Component<Props> = (props) => {
  const hasPoolStats = () => props.stats.pointsFor > 0 || props.stats.pointsAgainst > 0;

  return (
    <div class="space-y-4">
      <h2 class="font-bold text-on-surface text-lg">My Stats</h2>
      <div class="bg-surface-light rounded-xl p-4 space-y-3">
        <div class="text-sm font-semibold text-on-surface">{props.playerTeamName}</div>

        {/* W/L Record */}
        <div class="flex items-center gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-green-400">{props.stats.wins}</div>
            <div class="text-xs text-on-surface-muted uppercase">Wins</div>
          </div>
          <div class="text-on-surface-muted text-lg">-</div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-400">{props.stats.losses}</div>
            <div class="text-xs text-on-surface-muted uppercase">Losses</div>
          </div>
        </div>

        {/* Points (only show if pool data available) */}
        <Show when={hasPoolStats()}>
          <div class="border-t border-surface-lighter pt-3">
            <div class="grid grid-cols-3 gap-2 text-center">
              <div>
                <div class="text-lg font-bold text-on-surface">{props.stats.pointsFor}</div>
                <div class="text-xs text-on-surface-muted">Points For</div>
              </div>
              <div>
                <div class="text-lg font-bold text-on-surface">{props.stats.pointsAgainst}</div>
                <div class="text-xs text-on-surface-muted">Points Against</div>
              </div>
              <div>
                <div class={`text-lg font-bold ${props.stats.pointDiff > 0 ? 'text-green-400' : props.stats.pointDiff < 0 ? 'text-red-400' : 'text-on-surface-muted'}`}>
                  {props.stats.pointDiff > 0 ? '+' : ''}{props.stats.pointDiff}
                </div>
                <div class="text-xs text-on-surface-muted">Diff</div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default MyStatsCard;
