import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import AddPlayerForm from './components/AddPlayerForm';
import PlayerCard from './components/PlayerCard';
import EmptyState from '../../shared/components/EmptyState';
import LeaderboardTab from '../leaderboard/components/LeaderboardTab';
import { Users } from 'lucide-solid';
import { useLiveQuery } from '../../data/useLiveQuery';
import { playerRepository } from '../../data/repositories/playerRepository';

const TABS = [
  { id: 'players', label: 'Players' },
  { id: 'leaderboard', label: 'Leaderboard' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const PlayersPage: Component = () => {
  const { data: players } = useLiveQuery(() => playerRepository.getAll());
  const [activeTab, setActiveTab] = createSignal<TabId>('players');

  const handleKeyDown = (e: KeyboardEvent) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab());
    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);

    // Focus the newly active tab button
    const tabEl = document.getElementById(`tab-${nextTab.id}`);
    tabEl?.focus();
  };

  return (
    <PageLayout title="Players">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Players page sections"
        class="sticky top-0 z-10 flex bg-surface border-b border-border"
        onKeyDown={handleKeyDown}
      >
        <For each={TABS}>
          {(tab) => (
            <button
              id={`tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={activeTab() === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab() === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              class={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${
                activeTab() === tab.id
                  ? 'text-primary'
                  : 'text-on-surface-muted hover:text-on-surface'
              }`}
            >
              {tab.label}
              <Show when={activeTab() === tab.id}>
                <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Tab panels */}
      <Show when={activeTab() === 'players'}>
        <div
          id="panel-players"
          role="tabpanel"
          aria-labelledby="tab-players"
          tabIndex={0}
        >
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
        </div>
      </Show>

      <Show when={activeTab() === 'leaderboard'}>
        <div
          id="panel-leaderboard"
          role="tabpanel"
          aria-labelledby="tab-leaderboard"
          tabIndex={0}
        >
          <LeaderboardTab />
        </div>
      </Show>
    </PageLayout>
  );
};

export default PlayersPage;
