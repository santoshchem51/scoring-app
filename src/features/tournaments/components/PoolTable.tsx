import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { PoolStanding, PoolScheduleEntry } from '../../../data/types';

interface Props {
  poolId: string;
  poolName: string;
  standings: PoolStanding[];
  teamNames: Record<string, string>;
  advancingCount: number;
  schedule?: PoolScheduleEntry[];
  onScoreMatch?: (poolId: string, team1Id: string, team2Id: string) => void;
}

const PoolTable: Component<Props> = (props) => {
  return (
    <div class="bg-surface-light rounded-xl overflow-hidden">
      <div class="px-4 py-2 bg-surface-lighter">
        <h3 class="font-bold text-on-surface text-sm">{props.poolName}</h3>
      </div>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-on-surface-muted text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-2">#</th>
            <th class="text-left px-4 py-2">Team</th>
            <th class="text-center px-2 py-2">W</th>
            <th class="text-center px-2 py-2">L</th>
            <th class="text-center px-2 py-2">PF</th>
            <th class="text-center px-2 py-2">PA</th>
            <th class="text-center px-2 py-2">+/-</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.standings}>
            {(standing, index) => (
              <tr class={`border-t border-surface-lighter ${index() < props.advancingCount ? 'bg-primary/5' : ''}`}>
                <td class="px-4 py-2 text-on-surface-muted">{index() + 1}</td>
                <td class="px-4 py-2 font-semibold text-on-surface">{props.teamNames[standing.teamId] ?? standing.teamId}</td>
                <td class="text-center px-2 py-2 text-on-surface">{standing.wins}</td>
                <td class="text-center px-2 py-2 text-on-surface">{standing.losses}</td>
                <td class="text-center px-2 py-2 text-on-surface-muted">{standing.pointsFor}</td>
                <td class="text-center px-2 py-2 text-on-surface-muted">{standing.pointsAgainst}</td>
                <td class={`text-center px-2 py-2 font-semibold ${standing.pointDiff > 0 ? 'text-green-400' : standing.pointDiff < 0 ? 'text-red-400' : 'text-on-surface-muted'}`}>
                  {standing.pointDiff > 0 ? '+' : ''}{standing.pointDiff}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <Show when={props.schedule && props.onScoreMatch}>
        <div class="px-4 py-3 border-t border-surface-lighter">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-2">Schedule</div>
          <div class="space-y-2">
            <For each={props.schedule}>
              {(entry) => (
                <div class="flex items-center justify-between text-sm">
                  <span class="text-on-surface">
                    {props.teamNames[entry.team1Id] ?? entry.team1Id} vs {props.teamNames[entry.team2Id] ?? entry.team2Id}
                  </span>
                  <Show when={!entry.matchId && props.onScoreMatch}
                    fallback={
                      <Show when={entry.matchId}>
                        <span class="text-xs text-green-400 font-semibold">Completed</span>
                      </Show>
                    }>
                    <button type="button"
                      onClick={() => props.onScoreMatch!(props.poolId, entry.team1Id, entry.team2Id)}
                      class="text-xs font-semibold px-3 py-1 rounded-lg bg-primary/20 text-primary active:scale-95 transition-transform">
                      Score
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default PoolTable;
