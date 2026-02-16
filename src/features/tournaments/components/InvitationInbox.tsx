import { createResource, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { firestoreInvitationRepository } from '../../../data/firebase/firestoreInvitationRepository';
import { firestoreTournamentRepository } from '../../../data/firebase/firestoreTournamentRepository';
import { firestoreUserRepository } from '../../../data/firebase/firestoreUserRepository';
import { canAcceptInvitation } from '../engine/invitationHelpers';
import type { TournamentInvitation, Tournament, UserProfile } from '../../../data/types';

interface InvitationWithContext {
  invitation: TournamentInvitation;
  tournament: Tournament | null;
  inviterName: string;
}

interface Props {
  userId: string;
}

const InvitationInbox: Component<Props> = (props) => {
  const navigate = useNavigate();

  const [invitations, { refetch }] = createResource(
    () => props.userId,
    async (uid) => {
      const pending = await firestoreInvitationRepository.getPendingForUser(uid);
      const enriched: InvitationWithContext[] = await Promise.all(
        pending.map(async (inv) => {
          const [tournament, inviter] = await Promise.all([
            firestoreTournamentRepository.getById(inv.tournamentId).catch(() => undefined),
            firestoreUserRepository.getProfile(inv.invitedByUserId).catch(() => null),
          ]);
          return {
            invitation: inv,
            tournament: tournament ?? null,
            inviterName: inviter?.displayName ?? 'Unknown',
          };
        }),
      );
      return enriched.filter((e) => e.tournament !== null);
    },
  );

  const handleAccept = async (item: InvitationWithContext) => {
    await firestoreInvitationRepository.updateStatus(
      item.invitation.tournamentId,
      item.invitation.id,
      'accepted',
    );
    navigate(`/tournaments/${item.invitation.tournamentId}`);
  };

  const handleDecline = async (item: InvitationWithContext) => {
    await firestoreInvitationRepository.updateStatus(
      item.invitation.tournamentId,
      item.invitation.id,
      'declined',
    );
    refetch();
  };

  return (
    <Show when={invitations() && invitations()!.length > 0}>
      <div class="mb-6">
        <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
          Invitations ({invitations()!.length})
        </h2>
        <div class="space-y-3">
          <For each={invitations()}>
            {(item) => {
              const t = item.tournament!;
              const canAccept = () => canAcceptInvitation(item.invitation.status, t.status);

              return (
                <div class="bg-surface-light rounded-xl p-4 space-y-2">
                  <div class="font-semibold text-on-surface">{t.name}</div>
                  <div class="text-xs text-on-surface-muted">
                    {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {t.location ? ` · ${t.location}` : ''}
                  </div>
                  <div class="text-xs text-on-surface-muted">
                    Invited by {item.inviterName}
                  </div>
                  <Show when={canAccept()} fallback={
                    <div class="text-xs text-on-surface-muted italic">Registration closed</div>
                  }>
                    <div class="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAccept(item)}
                        class="flex-1 bg-primary text-surface text-sm font-semibold py-2 rounded-lg active:scale-95 transition-transform"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(item)}
                        class="flex-1 bg-surface text-on-surface-muted text-sm font-semibold py-2 rounded-lg border border-surface-lighter active:scale-95 transition-transform"
                      >
                        Decline
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
};

export default InvitationInbox;
