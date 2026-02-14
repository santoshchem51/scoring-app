import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import AddPlayerForm from './components/AddPlayerForm';
import PlayerCard from './components/PlayerCard';
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
            <div class="text-center text-on-surface-muted py-8">
              <p>No players yet</p>
              <p class="text-sm mt-1">Add players to track their stats</p>
            </div>
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
