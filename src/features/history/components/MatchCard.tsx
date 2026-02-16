import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import type { Match } from '../../../data/types';
import { Share2 } from 'lucide-solid';
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
    <article class="bg-surface-light rounded-xl p-4 space-y-2 hover-lift transition-all duration-200" aria-label={`${m().team1Name} vs ${m().team2Name}`}>
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
            <Share2 size={16} aria-hidden="true" />
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
    </article>
  );
};

export default MatchCard;
