import { createSignal, Show, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import { useAuth } from '../../../shared/hooks/useAuth';
import { firestoreRegistrationRepository } from '../../../data/firebase/firestoreRegistrationRepository';
import type { TournamentRegistration, Tournament } from '../../../data/types';

interface Props {
  tournament: Tournament;
  existingRegistration: TournamentRegistration | undefined;
  onRegistered: () => void;
  isInvited?: boolean;
  isGroupMember?: boolean;
}

const RegistrationForm: Component<Props> = (props) => {
  const { user, signIn } = useAuth();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [skillRating, setSkillRating] = createSignal<string>('');
  const [partnerName, setPartnerName] = createSignal('');

  const isRegistrationOpen = () => props.tournament.status === 'registration';
  const isAlreadyRegistered = () => !!props.existingRegistration;

  const accessMode = () => props.tournament.accessMode ?? 'open';

  const ctaText = () => {
    const mode = accessMode();
    if (mode === 'approval') return 'Ask to Join';
    return 'Join Tournament';
  };

  const registrationStatus = () => {
    const mode = accessMode();
    if (mode === 'approval') return 'pending' as const;
    return 'confirmed' as const;
  };

  const isFull = () => {
    const max = props.tournament.maxPlayers;
    if (!max) return false;
    const confirmed = props.tournament.registrationCounts?.confirmed ?? 0;
    return confirmed >= max;
  };

  const restrictionMessage = () => {
    const mode = accessMode();
    if (mode === 'invite-only' && !props.isInvited) {
      return 'This tournament is invite only.';
    }
    if (mode === 'group' && !props.isGroupMember) {
      return `This tournament is open to members of ${props.tournament.buddyGroupName ?? 'a buddy group'}.`;
    }
    return null;
  };

  const canRegister = () => {
    const mode = accessMode();
    if (mode === 'open' || mode === 'approval') return true;
    if (mode === 'invite-only') return !!props.isInvited;
    if (mode === 'group') return !!props.isGroupMember;
    return true;
  };

  const existingStatus = () => props.existingRegistration?.status;

  const handleWithdraw = async () => {
    const currentUser = user();
    if (!currentUser || saving()) return;
    setSaving(true);
    try {
      await firestoreRegistrationRepository.updateRegistrationStatus(
        props.tournament.id, currentUser.uid,
        existingStatus()!,
        'withdrawn',
      );
      props.onRegistered();
    } catch (err) {
      console.error('Withdraw failed:', err);
      setError('Failed to withdraw. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRegister = async () => {
    const currentUser = user();
    if (!currentUser || saving()) return;

    setError('');
    setSaving(true);
    try {
      const reg: TournamentRegistration = {
        id: currentUser.uid,
        tournamentId: props.tournament.id,
        userId: currentUser.uid,
        playerName: currentUser.displayName || null,
        teamId: null,
        paymentStatus: 'unpaid',
        paymentNote: '',
        lateEntry: false,
        skillRating: skillRating() ? parseFloat(skillRating()) : null,
        partnerId: null,
        partnerName: partnerName().trim() || null,
        profileComplete: !!(skillRating() && (props.tournament.teamFormation !== 'byop' || partnerName().trim())),
        registeredAt: Date.now(),
        status: registrationStatus(),
        declineReason: null,
        statusUpdatedAt: null,
      };
      await firestoreRegistrationRepository.saveWithStatus(reg, props.tournament.id);
      props.onRegistered();
    } catch (err) {
      console.error('Registration failed:', err);
      setError('Registration failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-4">
      {/* Existing registration states */}
      <Show when={isAlreadyRegistered()}>
        <Switch>
          <Match when={existingStatus() === 'confirmed'}>
            <div class="text-center py-4">
              <div class="text-primary font-bold text-lg mb-1">You're In!</div>
              <div class="text-sm text-on-surface-muted">
                Payment: {props.existingRegistration?.paymentStatus}
              </div>
            </div>
          </Match>
          <Match when={existingStatus() === 'pending'}>
            <div class="text-center py-6">
              <p class="text-amber-400 font-bold text-lg">Request Submitted</p>
              <p class="text-sm text-on-surface-muted mt-1">Check back here for updates from the organizer.</p>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={saving()}
                class="mt-3 text-xs text-on-surface-muted hover:underline disabled:opacity-50"
              >
                {saving() ? 'Withdrawing...' : 'Withdraw Request'}
              </button>
            </div>
          </Match>
          <Match when={existingStatus() === 'declined'}>
            <div class="text-center py-6">
              <p class="text-red-400 font-bold">Your request was not approved.</p>
              <Show when={props.existingRegistration?.declineReason}>
                {(reason) => <p class="text-sm text-on-surface-muted mt-1">{reason()}</p>}
              </Show>
            </div>
          </Match>
          <Match when={existingStatus() === 'withdrawn'}>
            <div class="text-center py-6">
              <p class="text-on-surface-muted">You withdrew your registration.</p>
            </div>
          </Match>
          <Match when={existingStatus() === 'expired'}>
            <div class="text-center py-6">
              <p class="text-on-surface-muted">Your request expired.</p>
            </div>
          </Match>
        </Switch>
      </Show>

      {/* New registration flow */}
      <Show when={!isAlreadyRegistered()}>
        <Show when={isFull()}>
          <div class="text-center py-6">
            <p class="text-on-surface-muted font-semibold">This tournament is full.</p>
          </div>
        </Show>

        <Show when={!isFull()}>
          <Show when={restrictionMessage()}>
            {(msg) => <p class="text-sm text-on-surface-muted text-center py-4">{msg()}</p>}
          </Show>

          <Show when={canRegister()}>
            <Show
              when={user()}
              fallback={
                <div class="space-y-3">
                  <p class="text-sm text-on-surface-muted">Sign in to register for this tournament.</p>
                  <button type="button" onClick={() => signIn()}
                    class="w-full bg-white text-gray-800 font-semibold text-sm py-3 rounded-lg active:scale-95 transition-transform">
                    Sign in with Google
                  </button>
                </div>
              }
            >
              <Show
                when={isRegistrationOpen()}
                fallback={<p class="text-sm text-on-surface-muted text-center py-2">Registration is not open.</p>}
              >
                {/* Optional Fields */}
                <div class="space-y-3">
                  <div>
                    <label for="skill-rating" class="text-xs text-on-surface-muted uppercase tracking-wider mb-1 block">Skill Level (optional)</label>
                    <select id="skill-rating" value={skillRating()} onChange={(e) => setSkillRating(e.currentTarget.value)}
                      class="w-full bg-surface border border-surface-lighter rounded-lg px-3 py-2 text-sm text-on-surface">
                      <option value="">Select rating...</option>
                      <option value="2.5">2.5 - Beginner</option>
                      <option value="3.0">3.0 - Intermediate</option>
                      <option value="3.5">3.5 - Advanced Intermediate</option>
                      <option value="4.0">4.0 - Advanced</option>
                      <option value="4.5">4.5 - Expert</option>
                      <option value="5.0">5.0 - Pro</option>
                    </select>
                  </div>
                  <Show when={props.tournament.teamFormation === 'byop'}>
                    <div>
                      <label for="partner-name" class="text-xs text-on-surface-muted uppercase tracking-wider mb-1 block">Partner Name (optional)</label>
                      <input id="partner-name" type="text" value={partnerName()} onInput={(e) => setPartnerName(e.currentTarget.value)}
                        class="w-full bg-surface border border-surface-lighter rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Enter partner's name" />
                    </div>
                  </Show>
                </div>

                <Show when={error()}>
                  <p class="text-red-500 text-sm text-center mb-2">{error()}</p>
                </Show>

                <button type="button" onClick={handleRegister}
                  disabled={saving()}
                  class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${!saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
                  {saving() ? 'Registering...' : ctaText()}
                </button>
              </Show>
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default RegistrationForm;
