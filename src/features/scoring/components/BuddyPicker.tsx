import type { Component } from 'solid-js';
import { createSignal, Show, For } from 'solid-js';
import type { BuddyGroupMember, GameType } from '../../../data/types';
import { useBuddyPickerData } from '../hooks/useBuddyPickerData';
import BuddyAvatar from './BuddyAvatar';
import BuddyActionSheet from './BuddyActionSheet';

interface BuddyPickerProps {
  buddyAssignments: Record<string, 1 | 2>;
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
}

const BuddyPicker: Component<BuddyPickerProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [selectedBuddy, setSelectedBuddy] = createSignal<BuddyGroupMember | null>(null);
  const { buddies, loading, error, load } = useBuddyPickerData(() => props.scorerUid);

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

  const assignedSummary = () => {
    const entries = Object.entries(props.buddyAssignments);
    if (entries.length === 0) return '';
    const totalPlayers = entries.length + (props.scorerRole === 'player' ? 1 : 0);
    if (totalPlayers >= 4) return 'Teams set: 2v2';

    const t1Names = entries
      .filter(([, t]) => t === 1)
      .map(([uid]) => buddies().find((b) => b.userId === uid)?.displayName ?? uid);
    const t2Names = entries
      .filter(([, t]) => t === 2)
      .map(([uid]) => buddies().find((b) => b.userId === uid)?.displayName ?? uid);

    const parts: string[] = [];
    if (t1Names.length > 0) parts.push(`${t1Names.join(', ')} (T1)`);
    if (t2Names.length > 0) parts.push(`${t2Names.join(', ')} (T2)`);
    return parts.join(' vs ');
  };

  const sortedBuddies = () => {
    const assigned = buddies().filter((b) => b.userId in props.buddyAssignments);
    const unassigned = buddies().filter((b) => !(b.userId in props.buddyAssignments));
    return [...assigned, ...unassigned];
  };

  const handleExpand = async () => {
    setExpanded(true);
    await load();
  };

  const handleAvatarClick = (buddy: BuddyGroupMember) => {
    const onlyOneTeamOpen =
      (team1Count() >= maxPerTeam() ? 1 : 0) + (team2Count() >= maxPerTeam() ? 1 : 0) === 1;
    const isUnassigned = !(buddy.userId in props.buddyAssignments);

    if (isUnassigned && onlyOneTeamOpen) {
      const openTeam: 1 | 2 = team1Count() < maxPerTeam() ? 1 : 2;
      props.onAssign(buddy.userId, openTeam);
      return;
    }
    setSelectedBuddy(buddy);
  };

  const handleSheetAssign = (team: 1 | 2) => {
    const buddy = selectedBuddy();
    if (buddy) props.onAssign(buddy.userId, team);
    setSelectedBuddy(null);
  };

  const handleSheetUnassign = () => {
    const buddy = selectedBuddy();
    if (buddy) props.onUnassign(buddy.userId);
    setSelectedBuddy(null);
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
              onClick={() => setExpanded(false)}
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

          <Show when={!error() && !loading() && buddies().length === 0}>
            <p class="text-sm text-on-surface-muted py-4 text-center">
              Create a buddy group to add players.
            </p>
          </Show>

          <Show when={!error() && buddies().length > 0}>
            <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <For each={sortedBuddies()}>
                {(buddy) => (
                  <BuddyAvatar
                    displayName={buddy.displayName}
                    photoURL={buddy.photoURL}
                    team={props.buddyAssignments[buddy.userId] ?? null}
                    teamColor={
                      props.buddyAssignments[buddy.userId] === 1
                        ? props.team1Color
                        : props.buddyAssignments[buddy.userId] === 2
                          ? props.team2Color
                          : props.team1Color
                    }
                    onClick={() => handleAvatarClick(buddy)}
                  />
                )}
              </For>
            </div>

            <div class="text-xs text-on-surface-muted mt-2">
              <span>Team 1: {team1Count()}/{maxPerTeam()}</span>
              <span class="mx-2">·</span>
              <span>Team 2: {team2Count()}/{maxPerTeam()}</span>
            </div>
          </Show>

          {/* Accessibility: announce team changes to screen readers */}
          <div aria-live="polite" class="sr-only">
            Team 1: {team1Count()} of {maxPerTeam()}. Team 2: {team2Count()} of {maxPerTeam()}.
          </div>
        </fieldset>
      </Show>

      <BuddyActionSheet
        open={selectedBuddy() !== null}
        buddyName={selectedBuddy()?.displayName ?? ''}
        team1Name={props.team1Name}
        team2Name={props.team2Name}
        team1Color={props.team1Color}
        team2Color={props.team2Color}
        team1Full={team1Count() >= maxPerTeam()}
        team2Full={team2Count() >= maxPerTeam()}
        currentTeam={selectedBuddy() ? (props.buddyAssignments[selectedBuddy()!.userId] ?? null) : null}
        onAssign={handleSheetAssign}
        onUnassign={handleSheetUnassign}
        onClose={() => setSelectedBuddy(null)}
      />
    </div>
  );
};

export default BuddyPicker;
