import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { Tournament, TournamentRole, UserProfile } from '../../../data/types';
import { hasMinRole, getTournamentRole } from '../engine/roleHelpers';

interface StaffManagerProps {
  tournament: Tournament;
  currentUserId: string;
  staffProfiles: UserProfile[];
  onAddStaff: (uid: string, role: TournamentRole) => void;
  onRemoveStaff: (uid: string) => void;
  onChangeRole: (uid: string, newRole: TournamentRole) => void;
}

const ROLE_LABELS: Record<TournamentRole, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  scorekeeper: 'Scorekeeper',
};

const ROLE_COLORS: Record<TournamentRole, string> = {
  admin: 'bg-purple-500/20 text-purple-400',
  moderator: 'bg-blue-500/20 text-blue-400',
  scorekeeper: 'bg-green-500/20 text-green-400',
};

const StaffManager: Component<StaffManagerProps> = (props) => {
  const viewerRole = () => getTournamentRole(props.tournament, props.currentUserId);
  const isViewerAdminPlus = () => hasMinRole(props.tournament, props.currentUserId, 'admin');

  const canRemove = (staffUid: string): boolean => {
    if (!isViewerAdminPlus()) return false;
    const staffRole = props.tournament.staff[staffUid];
    if (!staffRole) return false;
    if (staffRole === 'admin' && viewerRole() !== 'owner') return false;
    return true;
  };

  const getProfileName = (uid: string): string => {
    const profile = props.staffProfiles.find((p) => p.id === uid);
    return profile?.displayName ?? uid;
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-on-surface">Staff</h3>
        <Show when={isViewerAdminPlus()}>
          <button
            class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
            onClick={() => props.onAddStaff('', 'scorekeeper')}
          >
            Add Staff
          </button>
        </Show>
      </div>

      <Show when={props.tournament.staffUids.length === 0}>
        <p class="text-on-surface-muted text-sm">No staff members yet</p>
      </Show>

      <For each={props.tournament.staffUids}>
        {(uid) => {
          const role = () => props.tournament.staff[uid] as TournamentRole;
          const name = () => getProfileName(uid);
          return (
            <div class="flex items-center justify-between rounded-lg bg-surface-container p-3">
              <div class="flex items-center gap-3">
                <div class="h-8 w-8 rounded-full bg-surface-container-high flex items-center justify-center text-sm font-medium text-on-surface">
                  {name().charAt(0).toUpperCase()}
                </div>
                <div>
                  <span class="text-sm font-medium text-on-surface">{name()}</span>
                  <span class={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role()]}`}>
                    {ROLE_LABELS[role()]}
                  </span>
                </div>
              </div>
              <Show when={canRemove(uid)}>
                <button
                  class="text-sm text-error hover:text-error/80"
                  aria-label={`Remove ${name()}`}
                  onClick={() => props.onRemoveStaff(uid)}
                >
                  Remove
                </button>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export default StaffManager;
