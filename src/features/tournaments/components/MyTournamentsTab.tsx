import { createSignal, createResource, createMemo, Show, For, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { AlertTriangle, Trophy } from 'lucide-solid';
import type { Tournament } from '../../../data/types';
import { mergeMyTournaments } from '../engine/discoveryFilters';
import type { UserRole, MyTournamentEntry } from '../engine/discoveryFilters';
import TournamentCard from './TournamentCard';
import InvitationInbox from './InvitationInbox';
import EmptyState from '../../../shared/components/EmptyState';
import { firestoreTournamentRepository } from '../../../data/firebase/firestoreTournamentRepository';

const ROLE_LABELS: Record<UserRole, string> = {
  organizer: 'Organizer',
  scorekeeper: 'Scorekeeper',
  player: 'Player',
};

const ROLE_COLORS: Record<UserRole, string> = {
  organizer: 'bg-green-500/20 text-green-400',
  scorekeeper: 'bg-orange-500/20 text-orange-400',
  player: 'bg-blue-500/20 text-blue-400',
};

type RoleFilter = 'all' | 'organizer' | 'scorekeeper' | 'player';

interface Props {
  userId: string;
}

const MyTournamentsTab: Component<Props> = (props) => {
  const [roleFilter, setRoleFilter] = createSignal<RoleFilter>('all');

  const [entries, { refetch }] = createResource(
    () => props.userId,
    async (uid) => {
      // Fire three queries in parallel
      const [organized, participantIds, scorekeeping] = await Promise.all([
        firestoreTournamentRepository.getByOrganizer(uid),
        firestoreTournamentRepository.getByParticipant(uid),
        firestoreTournamentRepository.getByScorekeeper(uid),
      ]);

      // Collect IDs already fetched from organized/scorekeeping
      const knownIds = new Set<string>([
        ...organized.map((t) => t.id),
        ...scorekeeping.map((t) => t.id),
      ]);

      // Fetch tournament docs for participant IDs not already known
      const unknownParticipantIds = participantIds.filter((id) => !knownIds.has(id));
      const participantTournaments: Tournament[] = [];

      if (unknownParticipantIds.length > 0) {
        const fetched = await Promise.all(
          unknownParticipantIds.map((id) => firestoreTournamentRepository.getById(id)),
        );
        for (const t of fetched) {
          if (t) participantTournaments.push(t);
        }
      }

      // Also include tournaments from organized/scorekeeping that appear in participant IDs
      const knownParticipantTournaments = participantIds
        .filter((id) => knownIds.has(id))
        .map((id) => {
          return organized.find((t) => t.id === id) ?? scorekeeping.find((t) => t.id === id);
        })
        .filter((t): t is Tournament => t !== undefined);

      const allParticipating = [...participantTournaments, ...knownParticipantTournaments];

      return mergeMyTournaments({
        organized,
        participating: allParticipating,
        scorekeeping,
      });
    },
  );

  const filtered = createMemo(() => {
    const all = entries() ?? [];
    const current = roleFilter();
    if (current === 'all') return all;
    return all.filter((entry) => entry.role === current);
  });

  return (
    <div class="space-y-4">
      {/* Invitation inbox */}
      <InvitationInbox userId={props.userId} />

      {/* Header row: role filter + new button */}
      <div class="flex items-center gap-3">
        <select
          aria-label="Filter by role"
          value={roleFilter()}
          onChange={(e) => setRoleFilter(e.currentTarget.value as RoleFilter)}
          class="flex-1 bg-surface-light border border-border rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none"
        >
          <option value="all">All Roles</option>
          <option value="organizer">Organizing</option>
          <option value="player">Playing</option>
          <option value="scorekeeper">Scorekeeping</option>
        </select>
        <A
          href="/tournaments/new"
          class="bg-primary text-surface text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition-transform whitespace-nowrap"
        >
          + New
        </A>
      </div>

      {/* Content states */}
      <Switch>
        {/* Loading */}
        <Match when={entries.loading}>
          <div class="flex flex-col items-center justify-center py-16 gap-3">
            <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p class="text-sm text-on-surface-muted">Loading tournaments...</p>
          </div>
        </Match>

        {/* Error */}
        <Match when={entries.error}>
          <div class="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <AlertTriangle size={40} class="text-red-400" />
            <p class="text-sm text-red-400 font-semibold">Failed to load tournaments</p>
            <button
              type="button"
              onClick={() => refetch()}
              class="mt-2 px-4 py-2 bg-primary text-surface text-sm font-semibold rounded-lg active:scale-95 transition-transform"
            >
              Retry
            </button>
          </div>
        </Match>

        {/* Empty: no tournaments at all */}
        <Match when={entries() && entries()!.length === 0}>
          <EmptyState
            icon={<Trophy size={32} />}
            title="No tournaments yet"
            description="Create a tournament or join one to get started."
            actionLabel="Create Tournament"
            actionHref="/tournaments/new"
          />
        </Match>

        {/* Has tournaments */}
        <Match when={entries() && entries()!.length > 0}>
          <Show
            when={filtered().length > 0}
            fallback={
              <p class="text-center text-sm text-on-surface-muted py-8">
                No tournaments match this filter.
              </p>
            }
          >
            <ul role="list" class="space-y-3 list-none p-0 m-0">
              <For each={filtered()}>
                {(entry) => (
                  <li class="relative">
                    <TournamentCard tournament={entry.tournament} />
                    <span
                      class={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[entry.role]}`}
                    >
                      {ROLE_LABELS[entry.role]}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Match>
      </Switch>
    </div>
  );
};

export default MyTournamentsTab;
