import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { PoolStanding, BracketSlot, TournamentFormat } from '../../../data/types';

interface Props {
  format: TournamentFormat;
  poolStandings?: PoolStanding[];
  bracketSlots?: BracketSlot[];
  teamNames: Record<string, string>;
}

const TournamentResults: Component<Props> = (props) => {
  const champion = () => {
    if (props.format === 'round-robin') {
      const standings = props.poolStandings ?? [];
      return standings.length > 0 ? props.teamNames[standings[0].teamId] ?? 'Unknown' : null;
    }
    const slots = props.bracketSlots ?? [];
    if (slots.length === 0) return null;
    const maxRound = Math.max(...slots.map((s) => s.round));
    const finalSlot = slots.find((s) => s.round === maxRound);
    return finalSlot?.winnerId ? (props.teamNames[finalSlot.winnerId] ?? 'Unknown') : null;
  };

  return (
    <div class="bg-surface-light rounded-xl p-6 text-center">
      <div class="text-on-surface-muted text-xs uppercase tracking-wider mb-2">Tournament Complete</div>
      <Show when={champion()}>
        <div class="text-2xl font-bold text-primary mb-1">Champion</div>
        <div class="text-xl font-semibold text-on-surface">{champion()}</div>
      </Show>
      <Show when={props.format === 'round-robin' && props.poolStandings}>
        <div class="mt-4 text-left">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-2">Final Standings</div>
          <div class="space-y-1">
            <For each={props.poolStandings}>
              {(standing, index) => (
                <div class="flex items-center justify-between text-sm px-2 py-1">
                  <span class="text-on-surface">
                    <span class="text-on-surface-muted mr-2">{index() + 1}.</span>
                    {props.teamNames[standing.teamId] ?? standing.teamId}
                  </span>
                  <span class="text-on-surface-muted">
                    {standing.wins}W-{standing.losses}L ({standing.pointDiff > 0 ? '+' : ''}{standing.pointDiff})
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default TournamentResults;
