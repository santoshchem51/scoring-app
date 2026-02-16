import { createSignal, createMemo, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { TournamentRegistration } from '../../../data/types';
import { classifyRegistrations, preparePairUpdate, prepareUnpairUpdate, prepareAutoPairUpdates } from '../engine/pairingHelpers';
import type { PairedTeam } from '../engine/pairingHelpers';
import { firestoreRegistrationRepository } from '../../../data/firebase/firestoreRegistrationRepository';

interface Props {
  tournamentId: string;
  registrations: TournamentRegistration[];
  userNames: Record<string, string>;
  onUpdated: () => void;
}

const OrganizerPairingPanel: Component<Props> = (props) => {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);

  const classified = createMemo(() =>
    classifyRegistrations(props.registrations, props.userNames),
  );

  const handlePlayerTap = async (reg: TournamentRegistration) => {
    if (saving()) return;

    const current = selectedId();
    if (current === reg.userId) {
      setSelectedId(null);
      return;
    }

    if (current === null) {
      setSelectedId(reg.userId);
      return;
    }

    // Second selection — pair them
    const firstReg = props.registrations.find((r) => r.userId === current);
    if (!firstReg) return;

    setSaving(true);
    try {
      const updates = preparePairUpdate(firstReg, reg);
      await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, updates[0].regId, updates[0].partnerName);
      await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, updates[1].regId, updates[1].partnerName);
      setSelectedId(null);
      props.onUpdated();
    } catch (err) {
      console.error('Failed to pair players:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUnpair = async (pair: PairedTeam) => {
    if (saving()) return;
    setSaving(true);
    try {
      const updates = prepareUnpairUpdate(pair.player1, pair.player2);
      await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, updates[0].regId, updates[0].partnerName);
      await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, updates[1].regId, updates[1].partnerName);
      props.onUpdated();
    } catch (err) {
      console.error('Failed to unpair team:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoPair = async () => {
    if (saving()) return;
    const unmatched = classified().unmatched;
    if (unmatched.length < 2) return;

    setSaving(true);
    try {
      const allUpdates = prepareAutoPairUpdates(unmatched);
      for (const [u1, u2] of allUpdates) {
        await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, u1.regId, u1.partnerName);
        await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, u2.regId, u2.partnerName);
      }
      setSelectedId(null);
      props.onUpdated();
    } catch (err) {
      console.error('Failed to auto-pair:', err);
    } finally {
      setSaving(false);
    }
  };

  const playerName = (reg: TournamentRegistration) =>
    props.userNames[reg.userId] ?? reg.playerName ?? `Player ${reg.userId.slice(0, 6)}`;

  return (
    <div class="space-y-4">
      {/* Unmatched Players */}
      <Show when={classified().unmatched.length > 0}>
        <div class="bg-surface-light rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="text-xs text-on-surface-muted uppercase tracking-wider">
              Unmatched Players ({classified().unmatched.length})
            </div>
            <Show when={classified().unmatched.length >= 2}>
              <button type="button" onClick={handleAutoPair} disabled={saving()}
                class={`text-xs font-semibold px-3 py-1 rounded-lg bg-primary/20 text-primary transition-transform ${saving() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                Auto-pair remaining
              </button>
            </Show>
          </div>

          <Show when={selectedId()}>
            <p class="text-xs text-primary mb-2">Tap another player to pair</p>
          </Show>

          <div class="grid grid-cols-2 gap-2">
            <For each={classified().unmatched}>
              {(reg) => (
                <button type="button" onClick={() => handlePlayerTap(reg)}
                  disabled={saving()}
                  class={`text-left rounded-lg px-3 py-2 transition-all ${
                    selectedId() === reg.userId
                      ? 'bg-primary/20 ring-2 ring-primary'
                      : 'bg-surface hover:bg-surface-lighter'
                  } ${saving() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                  <div class="text-sm font-medium text-on-surface truncate">{playerName(reg)}</div>
                  <Show when={reg.skillRating}>
                    <div class="text-xs text-on-surface-muted">{reg.skillRating} rating</div>
                  </Show>
                </button>
              )}
            </For>
          </div>

          <Show when={classified().unmatched.length === 1}>
            <p class="text-xs text-amber-400 mt-2">1 player unmatched — add another player or remove this one</p>
          </Show>
        </div>
      </Show>

      {/* Paired Teams */}
      <Show when={classified().paired.length > 0}>
        <div class="bg-surface-light rounded-xl p-4">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-3">
            Paired Teams ({classified().paired.length})
          </div>
          <div class="space-y-2">
            <For each={classified().paired}>
              {(pair) => (
                <div class="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-on-surface truncate">
                      {playerName(pair.player1)} & {playerName(pair.player2)}
                    </div>
                    <Show when={pair.player1.skillRating || pair.player2.skillRating}>
                      <div class="text-xs text-on-surface-muted">
                        Combined: {((pair.player1.skillRating ?? 3.0) + (pair.player2.skillRating ?? 3.0)).toFixed(1)}
                      </div>
                    </Show>
                  </div>
                  <button type="button" onClick={() => handleUnpair(pair)}
                    disabled={saving()}
                    class={`ml-2 text-xs font-semibold px-2 py-1 rounded-lg text-red-400 bg-red-400/10 transition-transform ${saving() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                    Unpair
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* All paired summary */}
      <Show when={classified().unmatched.length === 0 && classified().paired.length > 0}>
        <div class="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <p class="text-green-400 text-sm font-semibold">All players paired! Ready to advance.</p>
        </div>
      </Show>
    </div>
  );
};

export default OrganizerPairingPanel;
