import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import AddPlayerForm from './components/AddPlayerForm';
import PlayerCard from './components/PlayerCard';
import EmptyState from '../../shared/components/EmptyState';
import { Users } from 'lucide-solid';
import { useLiveQuery } from '../../data/useLiveQuery';
import { playerRepository } from '../../data/repositories/playerRepository';

const PlayersPage: Component = () => {
  const { data: players } = useLiveQuery(() => playerRepository.getAll());

  return (
    <PageLayout title="Players">
      <div class="p-4 space-y-4">
        <Show
          when={players() && players()!.length > 0}
          fallback={
            <>
              <AddPlayerForm />
              <EmptyState
                icon={<Users size={32} />}
                title="No Players Yet"
                description="Add players to track individual stats and win/loss records."
              />
            </>
          }
        >
          <div class="md:grid md:grid-cols-2 md:gap-6 space-y-4 md:space-y-0">
            <div>
              <AddPlayerForm />
            </div>
            <ul role="list" class="space-y-2 list-none p-0 m-0">
              <For each={players()}>
                {(player) => <li><PlayerCard player={player} /></li>}
              </For>
            </ul>
          </div>
        </Show>
      </div>
    </PageLayout>
  );
};

export default PlayersPage;
