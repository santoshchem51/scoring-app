import { createSignal, createEffect, on, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { firestoreUserRepository } from '../../../data/firebase/firestoreUserRepository';
import { firestoreInvitationRepository } from '../../../data/firebase/firestoreInvitationRepository';
import { mergeAndDeduplicate, filterSearchResults } from '../engine/invitationHelpers';
import type { UserProfile, TournamentInvitation } from '../../../data/types';

interface Props {
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  organizerId: string;
  registeredUserIds: string[];
  shareUrl: string;
}

const PlayerSearch: Component<Props> = (props) => {
  const [searchText, setSearchText] = createSignal('');
  const [results, setResults] = createSignal<UserProfile[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [invitations, setInvitations] = createSignal<TournamentInvitation[]>([]);
  const [invitedIds, setInvitedIds] = createSignal<Set<string>>(new Set());

  // Load existing invitations on mount
  createEffect(async () => {
    try {
      const existing = await firestoreInvitationRepository.getByTournament(props.tournamentId);
      setInvitations(existing);
      setInvitedIds(new Set(existing.map((inv) => inv.invitedUserId)));
    } catch {
      // Ignore — will show all results without badges
    }
  });

  // Debounced search
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(on(searchText, (text) => {
    clearTimeout(debounceTimer);
    if (text.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceTimer = setTimeout(async () => {
      try {
        const [nameResults, emailResults] = await Promise.all([
          firestoreUserRepository.searchByNamePrefix(text, 5),
          firestoreUserRepository.searchByEmailPrefix(text, 5),
        ]);
        const merged = mergeAndDeduplicate(nameResults, emailResults, 8);
        const filtered = filterSearchResults(merged, props.organizerId, invitations(), props.registeredUserIds);
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }));

  const handleInvite = async (user: UserProfile) => {
    const invitation: TournamentInvitation = {
      id: crypto.randomUUID(),
      tournamentId: props.tournamentId,
      invitedUserId: user.id,
      invitedEmail: user.email,
      invitedName: user.displayName,
      invitedByUserId: props.organizerId,
      status: 'pending',
      createdAt: Date.now(),
      respondedAt: null,
    };

    // Optimistic update
    setInvitedIds((prev) => new Set([...prev, user.id]));
    setInvitations((prev) => [...prev, invitation]);
    setResults((prev) => prev.filter((u) => u.id !== user.id));

    try {
      await firestoreInvitationRepository.create(invitation);
    } catch {
      // Revert optimistic update
      setInvitedIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
    }
  };

  const mailtoHref = () => {
    const text = searchText().trim();
    if (!text.includes('@')) return '';
    const subject = encodeURIComponent(`You're invited to ${props.tournamentName}`);
    const body = encodeURIComponent(
      `Join ${props.tournamentName} on ${props.tournamentDate} at ${props.tournamentLocation}.\n\nView tournament: ${props.shareUrl}`,
    );
    return `mailto:${text}?subject=${subject}&body=${body}`;
  };

  const initial = (name: string) => (name.charAt(0) || '?').toUpperCase();

  return (
    <div>
      <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Invite Player</div>
      <input
        type="text"
        value={searchText()}
        onInput={(e) => setSearchText(e.currentTarget.value)}
        placeholder="Search by name or email..."
        class="w-full bg-surface-light border border-surface-lighter rounded-lg px-3 py-2 text-on-surface text-sm"
      />

      {/* Search results */}
      <Show when={searchText().length >= 2}>
        <div class="mt-2 space-y-1">
          <Show when={loading()}>
            <div class="flex items-center justify-center py-3">
              <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </Show>

          <Show when={!loading() && results().length > 0}>
            <For each={results()}>
              {(user) => (
                <div class="flex items-center gap-3 bg-surface-light rounded-lg px-3 py-2">
                  <Show when={user.photoURL} fallback={
                    <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {initial(user.displayName)}
                    </div>
                  }>
                    <img src={user.photoURL!} alt="" class="w-8 h-8 rounded-full" />
                  </Show>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-on-surface truncate">{user.displayName}</div>
                    <div class="text-xs text-on-surface-muted truncate">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInvite(user)}
                    class="text-xs font-semibold px-3 py-1 rounded-lg bg-primary/20 text-primary active:scale-95 transition-transform"
                  >
                    Invite
                  </button>
                </div>
              )}
            </For>
          </Show>

          <Show when={!loading() && results().length === 0 && searchText().length >= 2}>
            <div class="bg-surface-light rounded-lg px-3 py-3 text-center">
              <p class="text-on-surface-muted text-xs">No users found</p>
              <Show when={mailtoHref()}>
                <a
                  href={mailtoHref()}
                  class="text-xs font-semibold text-primary underline mt-1 inline-block"
                >
                  Send email invite instead
                </a>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={searchText().length > 0 && searchText().length < 2}>
        <p class="text-xs text-on-surface-muted mt-1">Type at least 2 characters to search...</p>
      </Show>

      {/* Invited count */}
      <Show when={invitedIds().size > 0}>
        <p class="text-xs text-on-surface-muted mt-2">
          {invitedIds().size} player{invitedIds().size > 1 ? 's' : ''} invited
        </p>
      </Show>
    </div>
  );
};

export default PlayerSearch;
