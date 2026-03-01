import type { Component } from 'solid-js';
import type { StatsSummary } from '../../../data/types';

interface StatsOverviewProps {
  stats: StatsSummary;
}

function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatStreak(streak: { type: 'W' | 'L'; count: number }): string {
  if (streak.count === 0) return '—';
  return `${streak.type}${streak.count}`;
}

const StatsOverview: Component<StatsOverviewProps> = (props) => {
  return (
    <section aria-labelledby="stats-heading" class="space-y-3">
      <h2 id="stats-heading" class="sr-only">Player Statistics</h2>

      {/* Win Rate — featured card */}
      <div
        class="bg-green-500/10 rounded-xl p-4"
        role="group"
        aria-label={`Win rate: ${Math.round(props.stats.winRate * 100)} percent`}
      >
        <div class="text-sm text-on-surface-muted uppercase tracking-wide font-semibold mb-1">Win Rate</div>
        <div class="text-2xl font-bold text-green-400">{formatWinRate(props.stats.winRate)}</div>
        <div class="text-xs text-on-surface-muted mt-1">
          Singles {props.stats.singles.wins}-{props.stats.singles.losses}
          {' · '}
          Doubles {props.stats.doubles.wins}-{props.stats.doubles.losses}
        </div>
      </div>

      {/* Stat cards row */}
      <div class="grid grid-cols-3 gap-3">
        <div
          class="bg-surface-light rounded-xl p-4"
          role="group"
          aria-label={`Total matches: ${props.stats.totalMatches}`}
        >
          <div class="text-sm text-on-surface-muted uppercase tracking-wide font-semibold mb-1">Matches</div>
          <div class="text-xl font-semibold text-on-surface">{props.stats.totalMatches}</div>
        </div>

        <div
          class="bg-surface-light rounded-xl p-4"
          role="group"
          aria-label={`Current streak: ${props.stats.currentStreak.count} ${props.stats.currentStreak.type === 'W' ? 'wins' : 'losses'}`}
        >
          <div class="text-sm text-on-surface-muted uppercase tracking-wide font-semibold mb-1">Streak</div>
          <div class={`text-xl font-semibold ${props.stats.currentStreak.type === 'W' ? 'text-green-400' : 'text-red-400'}`}>
            {formatStreak(props.stats.currentStreak)}
          </div>
        </div>

        <div
          class="bg-surface-light rounded-xl p-4"
          role="group"
          aria-label={`Best win streak: ${props.stats.bestWinStreak}`}
        >
          <div class="text-sm text-on-surface-muted uppercase tracking-wide font-semibold mb-1">Best</div>
          <div class="text-xl font-semibold text-on-surface">
            {props.stats.bestWinStreak > 0 ? `W${props.stats.bestWinStreak}` : '—'}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsOverview;
