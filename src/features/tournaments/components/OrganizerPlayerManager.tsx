import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { firestoreRegistrationRepository } from '../../../data/firebase/firestoreRegistrationRepository';
import type { TournamentRegistration, Tournament } from '../../../data/types';

interface Props {
  tournament: Tournament;
  registrations: TournamentRegistration[];
  onUpdated: () => void;
}

const OrganizerPlayerManager: Component<Props> = (props) => {
  const [playerName, setPlayerName] = createSignal('');
  const [skillRating, setSkillRating] = createSignal<string>('');
  const [partnerName, setPartnerName] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleAddPlayer = async () => {
    const name = playerName().trim();
    if (!name || saving()) return;

    setError('');
    setSaving(true);
    try {
      const reg: TournamentRegistration = {
        id: crypto.randomUUID(),
        tournamentId: props.tournament.id,
        userId: `manual-${crypto.randomUUID()}`,
        playerName: name,
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
      setPlayerName('');
      setSkillRating('');
      setPartnerName('');
      props.onUpdated();
    } catch (err) {
      console.error('Failed to add player:', err);
      setError('Failed to add player. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-4">
      {/* Registered Players List */}
      <div class="bg-surface-light rounded-xl p-4">
        <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-3">
          Registered Players ({props.registrations.length})
        </div>
        <Show when={props.registrations.length > 0} fallback={
          <p class="text-sm text-on-surface-muted py-2">No players registered yet.</p>
        }>
          <div class="space-y-2">
            <For each={props.registrations}>
              {(reg) => (
                <div class="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                  <div>
                    <span class="text-sm font-medium text-on-surface">
                      {reg.playerName || `Player ${reg.userId.slice(0, 6)}`}
                    </span>
                    <Show when={reg.skillRating}>
                      <span class="text-xs text-on-surface-muted ml-2">{reg.skillRating} rating</span>
                    </Show>
                  </div>
                  <Show when={reg.partnerName}>
                    <span class="text-xs text-on-surface-muted">w/ {reg.partnerName}</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Add Player Form */}
      <div class="bg-surface-light rounded-xl p-4 space-y-3">
        <div class="text-xs text-on-surface-muted uppercase tracking-wider">Add Player</div>

        <Show when={error()}>
          <p class="text-red-500 text-sm">{error()}</p>
        </Show>

        <div>
          <input type="text" value={playerName()} onInput={(e) => setPlayerName(e.currentTarget.value)}
            placeholder="Player name" maxLength={60}
            class="w-full bg-surface border border-surface-lighter rounded-lg px-3 py-2 text-sm text-on-surface" />
        </div>

        <div>
          <select value={skillRating()} onChange={(e) => setSkillRating(e.currentTarget.value)}
            class="w-full bg-surface border border-surface-lighter rounded-lg px-3 py-2 text-sm text-on-surface">
            <option value="">Skill level (optional)</option>
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
            <input type="text" value={partnerName()} onInput={(e) => setPartnerName(e.currentTarget.value)}
              placeholder="Partner name (optional)" maxLength={60}
              class="w-full bg-surface border border-surface-lighter rounded-lg px-3 py-2 text-sm text-on-surface" />
          </div>
        </Show>

        <button type="button" onClick={handleAddPlayer}
          disabled={!playerName().trim() || saving()}
          class={`w-full bg-primary text-surface font-semibold text-sm py-3 rounded-lg transition-transform ${playerName().trim() && !saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
          {saving() ? 'Adding...' : 'Add Player'}
        </button>
      </div>
    </div>
  );
};

export default OrganizerPlayerManager;
