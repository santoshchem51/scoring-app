import type { Component } from 'solid-js';
import { createSignal, Show, For } from 'solid-js';
import type { GameType } from '../../../data/types';
import type { SearchUserResult } from '../hooks/useUserSearch';
import { useBuddyPickerData } from '../hooks/useBuddyPickerData';
import { useUserSearch } from '../hooks/useUserSearch';
import BuddyAvatar from './BuddyAvatar';
import BuddyActionSheet from './BuddyActionSheet';

interface BuddyPickerProps {
  buddyAssignments: Record<string, 1 | 2>;
  searchUserInfo: Record<string, { displayName: string; photoURL: string | null }>;
  scorerRole: 'player' | 'spectator';
  scorerTeam: 1 | 2;
  scorerUid: string;
  team1Name: string;
  team2Name: string;
  team1Color: string;
  team2Color: string;
  gameType: GameType;
  onAssign: (userId: string, team: 1 | 2) => void;
  onUnassign: (userId: string) => void;
  onSearchAssign: (userId: string, team: 1 | 2, info: { displayName: string; photoURL: string | null }) => void;
  onSearchUnassign: (userId: string) => void;
}

interface AvatarPlayer {
  userId: string;
  displayName: string;
  photoURL: string | null;
  team: 1 | 2 | null;
  source: 'buddy' | 'search';
}

const BuddyPicker: Component<BuddyPickerProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [selectedPlayer, setSelectedPlayer] = createSignal<AvatarPlayer | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const { buddies, loading, error, load } = useBuddyPickerData(() => props.scorerUid);
  const userSearch = useUserSearch({
    scorerUid: props.scorerUid,
    buddyUserIds: () => buddies().map((b) => b.userId),
  });

  const maxPerTeam = () => (props.gameType === 'singles' ? 1 : 2);

  const team1Count = () => {
    let count = Object.values(props.buddyAssignments).filter((t) => t === 1).length;
    if (props.scorerRole === 'player' && props.scorerTeam === 1) count++;
    return count;
  };

  const team2Count = () => {
    let count = Object.values(props.buddyAssignments).filter((t) => t === 2).length;
    if (props.scorerRole === 'player' && props.scorerTeam === 2) count++;
    return count;
  };

  const hasAssignments = () => Object.keys(props.buddyAssignments).length > 0;

  // Unified player list: assigned buddies → assigned search users → unassigned buddies
  const allAssignedPlayers = (): AvatarPlayer[] => {
    const assignedBuddies: AvatarPlayer[] = buddies()
      .filter((b) => b.userId in props.buddyAssignments)
      .map((b) => ({
        userId: b.userId,
        displayName: b.displayName,
        photoURL: b.photoURL,
        team: props.buddyAssignments[b.userId],
        source: 'buddy' as const,
      }));

    const assignedSearch: AvatarPlayer[] = Object.entries(props.searchUserInfo)
      .filter(([uid]) => uid in props.buddyAssignments)
      .map(([uid, info]) => ({
        userId: uid,
        displayName: info.displayName,
        photoURL: info.photoURL,
        team: props.buddyAssignments[uid],
        source: 'search' as const,
      }));

    const unassignedBuddies: AvatarPlayer[] = buddies()
      .filter((b) => !(b.userId in props.buddyAssignments))
      .map((b) => ({
        userId: b.userId,
        displayName: b.displayName,
        photoURL: b.photoURL,
        team: null,
        source: 'buddy' as const,
      }));

    return [...assignedBuddies, ...assignedSearch, ...unassignedBuddies];
  };

  const assignedSummary = () => {
    const entries = Object.entries(props.buddyAssignments);
    if (entries.length === 0) return '';
    const totalPlayers = entries.length + (props.scorerRole === 'player' ? 1 : 0);
    if (totalPlayers >= 4) return 'Teams set: 2v2';

    const nameMap = new Map<string, string>();
    for (const b of buddies()) nameMap.set(b.userId, b.displayName);
    for (const [uid, info] of Object.entries(props.searchUserInfo)) {
      nameMap.set(uid, info.displayName);
    }

    const t1Names = entries
      .filter(([, t]) => t === 1)
      .map(([uid]) => nameMap.get(uid) ?? uid);
    const t2Names = entries
      .filter(([, t]) => t === 2)
      .map(([uid]) => nameMap.get(uid) ?? uid);

    const parts: string[] = [];
    if (t1Names.length > 0) parts.push(`${t1Names.join(', ')} (T1)`);
    if (t2Names.length > 0) parts.push(`${t2Names.join(', ')} (T2)`);
    return parts.join(' vs ');
  };

  const visibleSearchResults = () =>
    userSearch.results().filter((r) => !(r.id in props.buddyAssignments));

  const handleExpand = async () => {
    setExpanded(true);
    await load();
  };

  const handleAvatarClick = (player: AvatarPlayer) => {
    const onlyOneTeamOpen =
      (team1Count() >= maxPerTeam() ? 1 : 0) + (team2Count() >= maxPerTeam() ? 1 : 0) === 1;
    const isUnassigned = player.team === null;

    if (isUnassigned && onlyOneTeamOpen) {
      const openTeam: 1 | 2 = team1Count() < maxPerTeam() ? 1 : 2;
      props.onAssign(player.userId, openTeam);
      return;
    }
    setSelectedPlayer(player);
  };

  const handleSearchResultClick = (result: SearchUserResult) => {
    const onlyOneTeamOpen =
      (team1Count() >= maxPerTeam() ? 1 : 0) + (team2Count() >= maxPerTeam() ? 1 : 0) === 1;

    if (onlyOneTeamOpen) {
      const openTeam: 1 | 2 = team1Count() < maxPerTeam() ? 1 : 2;
      props.onSearchAssign(result.id, openTeam, {
        displayName: result.displayName,
        photoURL: result.photoURL,
      });
      return;
    }

    setSelectedPlayer({
      userId: result.id,
      displayName: result.displayName,
      photoURL: result.photoURL,
      team: null,
      source: 'search',
    });
  };

  const handleSheetAssign = (team: 1 | 2) => {
    const player = selectedPlayer();
    if (!player) return;

    if (player.source === 'search') {
      props.onSearchAssign(player.userId, team, {
        displayName: player.displayName,
        photoURL: player.photoURL,
      });
    } else {
      props.onAssign(player.userId, team);
    }
    setSelectedPlayer(null);
  };

  const handleSheetUnassign = () => {
    const player = selectedPlayer();
    if (!player) return;

    if (player.source === 'search') {
      props.onSearchUnassign(player.userId);
    } else {
      props.onUnassign(player.userId);
    }
    setSelectedPlayer(null);
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    userSearch.search(value);
  };

  const handleCollapse = () => {
    setExpanded(false);
    setSearchQuery('');
    userSearch.clear();
  };

  return (
    <div class="mt-6">
      <Show
        when={expanded()}
        fallback={
          <div
            class="flex items-center justify-between bg-surface-light rounded-xl px-4 py-3 cursor-pointer"
            onClick={handleExpand}
            role="button"
            tabIndex={0}
          >
            <div class="flex items-center gap-2">
              <Show
                when={hasAssignments()}
                fallback={
                  <span class="text-sm text-on-surface-muted">Add Players [optional]</span>
                }
              >
                <span class="text-sm text-on-surface-muted">Players:</span>
                <span class="text-sm font-semibold text-on-surface">{assignedSummary()}</span>
              </Show>
            </div>
            <span class="text-sm text-primary font-semibold">
              {hasAssignments() ? 'Change' : ''}
            </span>
          </div>
        }
      >
        <fieldset>
          <div class="flex items-center justify-between mb-3">
            <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
              Add Players
            </legend>
            <button
              type="button"
              onClick={handleCollapse}
              class="text-sm text-primary font-semibold"
            >
              Done
            </button>
          </div>

          <Show when={error()}>
            <p class="text-sm text-on-surface-muted py-4 text-center">
              Connect to the internet to add players.
            </p>
          </Show>

          <Show when={!error()}>
            {/* Avatar row: buddies + assigned search users */}
            <Show when={allAssignedPlayers().length > 0}>
              <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <For each={allAssignedPlayers()}>
                  {(player) => (
                    <BuddyAvatar
                      displayName={player.displayName}
                      photoURL={player.photoURL}
                      team={player.team}
                      teamColor={
                        player.team === 1
                          ? props.team1Color
                          : player.team === 2
                            ? props.team2Color
                            : props.team1Color
                      }
                      onClick={() => handleAvatarClick(player)}
                    />
                  )}
                </For>
              </div>
            </Show>

            <Show when={!loading() && buddies().length === 0 && allAssignedPlayers().length === 0}>
              <p class="text-sm text-on-surface-muted py-4 text-center">
                Create a buddy group to add players.
              </p>
            </Show>

            {/* Search input */}
            <div class="mt-3">
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery()}
                onInput={(e) => handleSearchInput(e.currentTarget.value)}
                class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-2.5 text-sm text-on-surface focus:border-primary"
              />
            </div>

            {/* Search hint / results */}
            <Show when={searchQuery().length > 0 && searchQuery().length < 2}>
              <p class="text-xs text-on-surface-muted mt-2">Type 2+ characters to search</p>
            </Show>

            <Show when={userSearch.loading()}>
              <p class="text-xs text-on-surface-muted mt-2">Searching...</p>
            </Show>

            <Show when={searchQuery().length >= 2 && !userSearch.loading() && visibleSearchResults().length === 0}>
              <p class="text-xs text-on-surface-muted mt-2">No users found</p>
            </Show>

            <Show when={visibleSearchResults().length > 0}>
              <div class="mt-2 space-y-1">
                <For each={visibleSearchResults()}>
                  {(result) => (
                    <button
                      type="button"
                      class="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-light hover:bg-surface-lighter transition-colors"
                      onClick={() => handleSearchResultClick(result)}
                      aria-label={`${result.displayName}. Tap to assign.`}
                    >
                      <div class="w-8 h-8 rounded-full overflow-hidden bg-surface-lighter flex items-center justify-center flex-shrink-0">
                        <Show
                          when={result.photoURL}
                          fallback={
                            <span class="text-sm font-bold text-on-surface">
                              {result.displayName.charAt(0).toUpperCase()}
                            </span>
                          }
                        >
                          <img src={result.photoURL!} alt="" class="w-full h-full object-cover" />
                        </Show>
                      </div>
                      <span class="text-sm text-on-surface">{result.displayName}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Capacity indicators */}
            <Show when={allAssignedPlayers().some((p) => p.team !== null) || buddies().length > 0}>
              <div class="text-xs text-on-surface-muted mt-2">
                <span>Team 1: {team1Count()}/{maxPerTeam()}</span>
                <span class="mx-2">·</span>
                <span>Team 2: {team2Count()}/{maxPerTeam()}</span>
              </div>
            </Show>
          </Show>

          {/* Accessibility: announce team changes to screen readers */}
          <div aria-live="polite" class="sr-only">
            Team 1: {team1Count()} of {maxPerTeam()}. Team 2: {team2Count()} of {maxPerTeam()}.
          </div>
        </fieldset>
      </Show>

      <BuddyActionSheet
        open={selectedPlayer() !== null}
        buddyName={selectedPlayer()?.displayName ?? ''}
        team1Name={props.team1Name}
        team2Name={props.team2Name}
        team1Color={props.team1Color}
        team2Color={props.team2Color}
        team1Full={team1Count() >= maxPerTeam()}
        team2Full={team2Count() >= maxPerTeam()}
        currentTeam={selectedPlayer() ? (props.buddyAssignments[selectedPlayer()!.userId] ?? null) : null}
        onAssign={handleSheetAssign}
        onUnassign={handleSheetUnassign}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
};

export default BuddyPicker;
