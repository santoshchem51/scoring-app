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
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [skillRating, setSkillRating] = createSignal<string>('');
  const [partnerName, setPartnerName] = createSignal('');

  const isRegistrationOpen = () => props.tournament.status === 'registration';
  const isAlreadyRegistered = () => !!props.existingRegistration;

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
            <Show when={error()}>
              <p class="text-red-500 text-sm text-center mb-2">{error()}</p>
            </Show>

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

            <button type="button" onClick={handleRegister}
              disabled={saving()}
              class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${!saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
              {saving() ? 'Registering...' : 'Join Tournament'}
            </button>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default RegistrationForm;
