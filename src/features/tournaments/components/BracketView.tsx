import { For } from 'solid-js';
import type { Component } from 'solid-js';
import type { BracketSlot } from '../../../data/types';

interface Props {
  slots: BracketSlot[];
  teamNames: Record<string, string>;
}

const BracketView: Component<Props> = (props) => {
  const rounds = () => {
    const maxRound = Math.max(...props.slots.map((s) => s.round), 0);
    const result: BracketSlot[][] = [];
    for (let r = 1; r <= maxRound; r++) {
      result.push(
        props.slots.filter((s) => s.round === r).sort((a, b) => a.position - b.position),
      );
    }
    return result;
  };

  const roundLabel = (round: number, total: number) => {
    if (round === total) return 'Final';
    if (round === total - 1) return 'Semifinals';
    if (round === total - 2) return 'Quarterfinals';
    return `Round ${round}`;
  };

  const teamDisplay = (teamId: string | null, winnerId: string | null) => {
    if (!teamId) return { name: 'BYE', isWinner: false };
    const name = props.teamNames[teamId] ?? teamId;
    const isWinner = winnerId === teamId;
    return { name, isWinner };
  };

  return (
    <div class="overflow-x-auto">
      <div class="flex gap-6 min-w-max p-4">
        <For each={rounds()}>
          {(roundSlots, roundIndex) => (
            <div class="flex flex-col gap-4">
              <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider text-center mb-2">
                {roundLabel(roundIndex() + 1, rounds().length)}
              </div>
              <div class="flex flex-col justify-around flex-1 gap-4">
                <For each={roundSlots}>
                  {(slot) => {
                    const team1 = teamDisplay(slot.team1Id, slot.winnerId);
                    const team2 = teamDisplay(slot.team2Id, slot.winnerId);
                    return (
                      <div class="bg-surface-light rounded-lg overflow-hidden w-48 border border-surface-lighter">
                        <div
                          class={`flex items-center justify-between px-3 py-2 text-sm border-b border-surface-lighter ${team1.isWinner ? 'bg-primary/10 font-bold text-on-surface' : 'text-on-surface-muted'}`}
                        >
                          <span class="truncate">{team1.name}</span>
                        </div>
                        <div
                          class={`flex items-center justify-between px-3 py-2 text-sm ${team2.isWinner ? 'bg-primary/10 font-bold text-on-surface' : 'text-on-surface-muted'}`}
                        >
                          <span class="truncate">{team2.name}</span>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default BracketView;
