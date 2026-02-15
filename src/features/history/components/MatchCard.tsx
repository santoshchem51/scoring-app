import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import type { Match } from '../../../data/types';
import { shareScoreCard } from '../../../shared/utils/shareScoreCard';

interface Props {
  match: Match;
}

const MatchCard: Component<Props> = (props) => {
  const m = () => props.match;
  const date = () => new Date(m().startedAt).toLocaleDateString();
  const time = () => new Date(m().startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const [sharing, setSharing] = createSignal(false);

  const handleShare = async () => {
    setSharing(true);
    await shareScoreCard(props.match);
    setSharing(false);
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs text-on-surface-muted">{date()} {time()}</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing()}
            class="p-1.5 rounded-lg text-on-surface-muted hover:text-primary transition-colors"
            aria-label="Share score card"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <span class="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
            {m().config.scoringMode === 'sideout' ? 'Side-Out' : 'Rally'}
          </span>
        </div>
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
        {m().config.matchFormat !== 'single' ? ` · ${m().config.matchFormat.replaceAll('-', ' ')}` : ''}
      </div>
    </div>
  );
};

export default MatchCard;
