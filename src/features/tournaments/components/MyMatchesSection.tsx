import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { PlayerMatchInfo } from '../engine/playerStats';
import LiveScoreCard from './LiveScoreCard';

interface Props {
  matches: PlayerMatchInfo[];
  teamNames: Record<string, string>;
  playerTeamName: string;
}

const MyMatchesSection: Component<Props> = (props) => {
  const upcoming = () => props.matches.filter((m) => m.status === 'upcoming');
  const inProgress = () => props.matches.filter((m) => m.status === 'in-progress');
  const completed = () => props.matches.filter((m) => m.status === 'completed');

  return (
    <div class="space-y-4">
      <h2 class="font-bold text-on-surface text-lg">My Matches</h2>

      {/* In-progress matches */}
      <Show when={inProgress().length > 0}>
        <div class="space-y-2">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider">Now Playing</div>
          <For each={inProgress()}>
            {(match) => (
              <Show when={match.matchId} fallback={
                <div class="bg-surface-light rounded-xl p-3 text-sm text-on-surface">
                  vs {match.opponentName} — <span class="text-red-400 font-semibold">LIVE</span>
                </div>
              }>
                <LiveScoreCard
                  matchId={match.matchId!}
                  team1Name={props.playerTeamName}
                  team2Name={match.opponentName}
                />
              </Show>
            )}
          </For>
        </div>
      </Show>

      {/* Upcoming matches */}
      <Show when={upcoming().length > 0}>
        <div class="space-y-2">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider">Upcoming</div>
          <For each={upcoming()}>
            {(match) => (
              <div class="bg-surface-light rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm text-on-surface">
                  vs {match.opponentName}
                </span>
                <span class="text-xs text-on-surface-muted">
                  {match.type === 'pool' ? `Pool R${match.round}` : `Bracket R${match.round}`}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Completed matches */}
      <Show when={completed().length > 0}>
        <div class="space-y-2">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider">Completed</div>
          <For each={completed()}>
            {(match) => (
              <div class="bg-surface-light rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm text-on-surface">
                  vs {match.opponentName}
                </span>
                <Show when={match.won !== null}>
                  <span class={`text-xs font-semibold ${match.won ? 'text-green-400' : 'text-red-400'}`}>
                    {match.won ? 'WIN' : 'LOSS'}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.matches.length === 0}>
        <div class="bg-surface-light rounded-xl p-4 text-center">
          <p class="text-on-surface-muted text-sm">No matches scheduled yet.</p>
        </div>
      </Show>
    </div>
  );
};

export default MyMatchesSection;
