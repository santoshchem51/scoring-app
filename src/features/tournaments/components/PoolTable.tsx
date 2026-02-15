import { For } from 'solid-js';
import type { Component } from 'solid-js';
import type { PoolStanding } from '../../../data/types';

interface Props {
  poolName: string;
  standings: PoolStanding[];
  teamNames: Record<string, string>;
  advancingCount: number;
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
    </div>
  );
};

export default PoolTable;
