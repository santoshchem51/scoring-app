import type { Component } from 'solid-js';
import { createSignal, createResource, createMemo, Show, For } from 'solid-js';
import { Search, Sparkles } from 'lucide-solid';
import type { TournamentFormat } from '../../../data/types';
import { firestoreTournamentRepository } from '../../../data/firebase/firestoreTournamentRepository';
import { filterPublicTournaments } from '../engine/discoveryFilters';
import type { BrowseStatusFilter } from '../engine/discoveryFilters';
import BrowseCard from './BrowseCard';
import EmptyState from '../../../shared/components/EmptyState';

const BrowseTab: Component = () => {
  const [search, setSearch] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<BrowseStatusFilter>('upcoming');
  const [formatFilter, setFormatFilter] = createSignal<TournamentFormat | undefined>(undefined);
  const [cursor, setCursor] = createSignal<unknown>(undefined);
  const [allTournaments, setAllTournaments] = createSignal<
    Array<{ id: string; tournament: any; registrationCount: number }>
  >([]);

  const [data] = createResource(async () => {
    const result = await firestoreTournamentRepository.getPublicTournaments(50);
    setCursor(result.lastDoc);
    return result.tournaments;
  });

  const filtered = createMemo(() => {
    const tournaments = data() ?? [];
    const filters: { status?: BrowseStatusFilter; format?: TournamentFormat; search?: string } = {};

    const currentStatus = statusFilter();
    if (currentStatus !== 'all') {
      filters.status = currentStatus;
    }

    const currentFormat = formatFilter();
    if (currentFormat) {
      filters.format = currentFormat;
    }

    const currentSearch = search();
    if (currentSearch.trim()) {
      filters.search = currentSearch.trim();
    }

    return filterPublicTournaments(tournaments, filters);
  });

  const handleLoadMore = async () => {
    const currentCursor = cursor();
    if (!currentCursor) return;
    const result = await firestoreTournamentRepository.getPublicTournaments(50, currentCursor);
    setCursor(result.lastDoc);
    // Note: In a full implementation, we'd append to existing tournaments
  };

  return (
    <div class="space-y-4">
      {/* Filter bar */}
      <div class="space-y-3">
        {/* Search input - full width */}
        <div class="relative">
          <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" />
          <input
            type="text"
            placeholder="Search name or location..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            class="w-full bg-surface-light border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Dropdowns row */}
        <div class="flex gap-3">
          {/* Status dropdown */}
          <select
            aria-label="Filter by status"
            value={statusFilter()}
            onChange={(e) => setStatusFilter(e.currentTarget.value as BrowseStatusFilter)}
            class="flex-1 bg-surface-light border border-border rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none"
          >
            <option value="all">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          {/* Format dropdown */}
          <select
            aria-label="Filter by format"
            value={formatFilter() ?? ''}
            onChange={(e) => {
              const val = e.currentTarget.value;
              setFormatFilter(val ? (val as TournamentFormat) : undefined);
            }}
            class="flex-1 bg-surface-light border border-border rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none"
          >
            <option value="">All Formats</option>
            <option value="round-robin">Round Robin</option>
            <option value="single-elimination">Single Elim</option>
            <option value="pool-bracket">Pool + Bracket</option>
          </select>
        </div>
      </div>

      {/* Loading spinner */}
      <Show when={data.loading}>
        <div class="flex justify-center py-12">
          <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>

      {/* Feed */}
      <Show when={!data.loading}>
        <Show
          when={filtered().length > 0}
          fallback={
            <EmptyState
              icon={<Sparkles size={32} />}
              title="No tournaments found"
              description="Try adjusting your filters or check back later for new tournaments."
            />
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={filtered()}>
              {(tournament) => (
                <BrowseCard tournament={tournament} registrationCount={0} />
              )}
            </For>
          </div>

          {/* Load More */}
          <Show when={cursor()}>
            <div class="flex justify-center pt-4">
              <button
                type="button"
                onClick={handleLoadMore}
                class="bg-surface-light border border-border text-on-surface font-medium px-6 py-2.5 rounded-xl active:scale-95 transition-transform"
              >
                Load More
              </button>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default BrowseTab;
