import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useAuth } from '../../../shared/hooks/useAuth';
import { firestoreRegistrationRepository } from '../../../data/firebase/firestoreRegistrationRepository';
import type { TournamentRegistration, Tournament } from '../../../data/types';

interface Props {
  tournament: Tournament;
  existingRegistration: TournamentRegistration | undefined;
  onRegistered: () => void;
}

const RegistrationForm: Component<Props> = (props) => {
  const { user, signIn } = useAuth();
  const [rulesAcknowledged, setRulesAcknowledged] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  const isRegistrationOpen = () => props.tournament.status === 'registration';
  const isAlreadyRegistered = () => !!props.existingRegistration;
  const hasRules = () => !!props.tournament.rules.scoringRules || !!props.tournament.rules.conductRules;

  const handleRegister = async () => {
    const currentUser = user();
    if (!currentUser || saving()) return;

    setError('');
    setSaving(true);
    try {
      const reg: TournamentRegistration = {
        id: crypto.randomUUID(),
        tournamentId: props.tournament.id,
        userId: currentUser.uid,
        teamId: null,
        paymentStatus: 'unpaid',
        paymentNote: '',
        lateEntry: false,
        rulesAcknowledged: rulesAcknowledged(),
        registeredAt: Date.now(),
      };
      await firestoreRegistrationRepository.save(reg);
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
      <Show
        when={!isAlreadyRegistered()}
        fallback={
          <div class="text-center py-4">
            <div class="text-primary font-bold text-lg mb-1">You're Registered!</div>
            <div class="text-sm text-on-surface-muted">
              Payment: {props.existingRegistration?.paymentStatus}
            </div>
          </div>
        }
      >
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
            <Show when={hasRules()}>
              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={rulesAcknowledged()} onChange={(e) => setRulesAcknowledged(e.currentTarget.checked)} class="mt-1 accent-primary" />
                <span class="text-sm text-on-surface">I've read and agree to the tournament rules</span>
              </label>
            </Show>

            <Show when={error()}>
              <p class="text-red-500 text-sm text-center mb-2">{error()}</p>
            </Show>

            <button type="button" onClick={handleRegister}
              disabled={saving() || (hasRules() && !rulesAcknowledged())}
              class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${!saving() && (!hasRules() || rulesAcknowledged()) ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
              {saving() ? 'Registering...' : 'Join Tournament'}
            </button>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default RegistrationForm;
