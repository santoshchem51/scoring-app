import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import AddPlayerForm from './components/AddPlayerForm';
import PlayerCard from './components/PlayerCard';
import EmptyState from '../../shared/components/EmptyState';
import { useLiveQuery } from '../../data/useLiveQuery';
import { playerRepository } from '../../data/repositories/playerRepository';

const PlayersPage: Component = () => {
  const { data: players } = useLiveQuery(() => playerRepository.getAll());

  return (
    <PageLayout title="Players">
      <div class="p-4 space-y-4">
        <AddPlayerForm />

        <Show
          when={players() && players()!.length > 0}
          fallback={
            <EmptyState
              icon={
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              title="No Players Yet"
              description="Add players to track individual stats and win/loss records."
            />
          }
        >
          <div class="space-y-2">
            <For each={players()}>
              {(player) => <PlayerCard player={player} />}
            </For>
          </div>
        </Show>
      </div>
    </PageLayout>
  );
};

export default PlayersPage;
