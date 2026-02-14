import type { Component } from 'solid-js';
import type { Match } from '../../../data/types';

interface Props {
  match: Match;
}

const MatchCard: Component<Props> = (props) => {
  const m = () => props.match;
  const date = () => new Date(m().startedAt).toLocaleDateString();
  const time = () => new Date(m().startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs text-on-surface-muted">{date()} {time()}</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
          {m().config.scoringMode === 'sideout' ? 'Side-Out' : 'Rally'}
        </span>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex-1">
          <span class={`font-semibold ${m().winningSide === 1 ? 'text-primary' : 'text-on-surface'}`}>
            {m().team1Name}
          </span>
        </div>
        <div class="px-4 text-2xl font-black text-score tabular-nums">
          {m().games.length > 0 ? m().games.map((g) => g.team1Score).join(' / ') : '-'}
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex-1">
          <span class={`font-semibold ${m().winningSide === 2 ? 'text-primary' : 'text-on-surface'}`}>
            {m().team2Name}
          </span>
        </div>
        <div class="px-4 text-2xl font-black text-score tabular-nums">
          {m().games.length > 0 ? m().games.map((g) => g.team2Score).join(' / ') : '-'}
        </div>
      </div>

      <div class="text-xs text-on-surface-muted">
        {m().config.gameType === 'doubles' ? 'Doubles' : 'Singles'} · To {m().config.pointsToWin}
        {m().config.matchFormat !== 'single' ? ` · ${m().config.matchFormat.replace('-', ' ')}` : ''}
      </div>
    </div>
  );
};

export default MatchCard;
