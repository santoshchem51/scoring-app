import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { GameType, ScoringMode } from '../../../data/types';

interface Props {
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  scoringMode: ScoringMode;
  gameType: GameType;
}

const Scoreboard: Component<Props> = (props) => {
  const isServing = (team: 1 | 2) => props.servingTeam === team;
  const showServerNumber = () =>
    props.scoringMode === 'sideout' && props.gameType === 'doubles';

  return (
    <div class="grid grid-cols-2 gap-4 px-4" role="region" aria-label="Scoreboard">
      {/* Screen reader live announcement */}
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {props.team1Name} {props.team1Score}, {props.team2Name} {props.team2Score}
      </div>

      {/* Team 1 */}
      <div
        class="flex flex-col items-center py-6 rounded-2xl transition-all"
        classList={{
          'bg-primary/15 ring-2 ring-primary': isServing(1),
          'bg-surface-light': !isServing(1),
        }}
        aria-label={`${props.team1Name}: ${props.team1Score}${isServing(1) ? ', serving' : ''}`}
      >
        <span class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2">
          {props.team1Name}
        </span>
        <span class="text-7xl font-black text-score tabular-nums">{props.team1Score}</span>
        <Show when={isServing(1)}>
          <span class="mt-2 text-xs font-bold text-primary uppercase tracking-wider">
            {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
          </span>
        </Show>
      </div>

      {/* Team 2 */}
      <div
        class="flex flex-col items-center py-6 rounded-2xl transition-all"
        classList={{
          'bg-primary/15 ring-2 ring-primary': isServing(2),
          'bg-surface-light': !isServing(2),
        }}
        aria-label={`${props.team2Name}: ${props.team2Score}${isServing(2) ? ', serving' : ''}`}
      >
        <span class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2">
          {props.team2Name}
        </span>
        <span class="text-7xl font-black text-score tabular-nums">{props.team2Score}</span>
        <Show when={isServing(2)}>
          <span class="mt-2 text-xs font-bold text-primary uppercase tracking-wider">
            {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
          </span>
        </Show>
      </div>
    </div>
  );
};

export default Scoreboard;
