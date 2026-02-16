import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { TournamentPool, BracketSlot } from '../../../data/types';

interface ScoreableMatch {
  type: 'pool' | 'bracket';
  label: string;
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  poolId?: string;
  slotId?: string;
}

interface Props {
  pools: TournamentPool[];
  bracket: BracketSlot[];
  teamNames: Record<string, string>;
  onScorePoolMatch: (poolId: string, team1Id: string, team2Id: string) => void;
  onScoreBracketMatch: (slotId: string, team1Id: string, team2Id: string) => void;
}

const ScorekeeperMatchList: Component<Props> = (props) => {
  const scoreableMatches = () => {
    const matches: ScoreableMatch[] = [];

    // Pool matches without a matchId (not yet scored)
    for (const pool of props.pools) {
      for (const entry of pool.schedule) {
        if (!entry.matchId) {
          matches.push({
            type: 'pool',
            label: `${pool.name} R${entry.round}`,
            team1Id: entry.team1Id,
            team2Id: entry.team2Id,
            team1Name: props.teamNames[entry.team1Id] ?? entry.team1Id,
            team2Name: props.teamNames[entry.team2Id] ?? entry.team2Id,
            poolId: pool.id,
          });
        }
      }
    }

    // Bracket matches with both teams but no winner
    for (const slot of props.bracket) {
      if (slot.team1Id && slot.team2Id && !slot.winnerId && !slot.matchId) {
        const totalRounds = Math.max(...props.bracket.map((s) => s.round), 0);
        let label: string;
        if (slot.round === totalRounds) label = 'Final';
        else if (slot.round === totalRounds - 1) label = 'Semifinal';
        else label = `Round ${slot.round}`;

        matches.push({
          type: 'bracket',
          label,
          team1Id: slot.team1Id,
          team2Id: slot.team2Id,
          team1Name: props.teamNames[slot.team1Id] ?? slot.team1Id,
          team2Name: props.teamNames[slot.team2Id] ?? slot.team2Id,
          slotId: slot.id,
        });
      }
    }

    return matches;
  };

  return (
    <div class="space-y-4">
      <h2 class="font-bold text-on-surface text-lg">Matches to Score</h2>
      <Show when={scoreableMatches().length > 0} fallback={
        <div class="bg-surface-light rounded-xl p-4 text-center">
          <p class="text-on-surface-muted text-sm">No matches waiting to be scored.</p>
        </div>
      }>
        <div class="space-y-2">
          <For each={scoreableMatches()}>
            {(match) => (
              <button
                type="button"
                onClick={() => {
                  if (match.type === 'pool' && match.poolId) {
                    props.onScorePoolMatch(match.poolId, match.team1Id, match.team2Id);
                  } else if (match.type === 'bracket' && match.slotId) {
                    props.onScoreBracketMatch(match.slotId, match.team1Id, match.team2Id);
                  }
                }}
                class="w-full bg-surface-light rounded-xl p-3 flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div class="text-left">
                  <div class="text-sm font-semibold text-on-surface">
                    {match.team1Name} vs {match.team2Name}
                  </div>
                  <div class="text-xs text-on-surface-muted">{match.label}</div>
                </div>
                <span class="text-xs font-semibold px-3 py-1 rounded-lg bg-primary/20 text-primary">
                  Score
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ScorekeeperMatchList;
