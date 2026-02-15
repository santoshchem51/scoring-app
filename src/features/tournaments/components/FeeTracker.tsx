import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { firestoreRegistrationRepository } from '../../../data/firebase/firestoreRegistrationRepository';
import type { TournamentRegistration, PaymentStatus, EntryFee } from '../../../data/types';

interface Props {
  tournamentId: string;
  entryFee: EntryFee;
  registrations: TournamentRegistration[];
  isOrganizer: boolean;
  userNames: Record<string, string>;
  onUpdated: () => void;
}

const FeeTracker: Component<Props> = (props) => {
  const paidCount = () => props.registrations.filter((r) => r.paymentStatus === 'paid').length;
  const totalCollected = () => paidCount() * props.entryFee.amount;
  const totalExpected = () => props.registrations.length * props.entryFee.amount;

  const handleUpdatePayment = async (regId: string, status: PaymentStatus) => {
    try {
      await firestoreRegistrationRepository.updatePayment(props.tournamentId, regId, status);
      props.onUpdated();
    } catch (err) {
      console.error('Failed to update payment:', err);
    }
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-on-surface">Entry Fee</h3>
        <span class="text-sm text-on-surface-muted">{props.entryFee.currency} {props.entryFee.amount}</span>
      </div>

      <div class="bg-surface rounded-lg p-3">
        <div class="flex justify-between text-sm mb-2">
          <span class="text-on-surface-muted">{paidCount()} of {props.registrations.length} paid</span>
          <span class="font-semibold text-on-surface">{props.entryFee.currency} {totalCollected()} / {totalExpected()}</span>
        </div>
        <div class="h-2 bg-surface-lighter rounded-full overflow-hidden">
          <div class="h-full bg-primary rounded-full transition-all"
            style={{ width: `${props.registrations.length > 0 ? (paidCount() / props.registrations.length) * 100 : 0}%` }} />
        </div>
      </div>

      <Show when={props.entryFee.paymentInstructions}>
        <div class="text-sm text-on-surface-muted">
          <span class="font-semibold">Payment:</span> {props.entryFee.paymentInstructions}
        </div>
      </Show>

      <Show when={props.isOrganizer}>
        <div class="space-y-2">
          <For each={props.registrations}>
            {(reg) => (
              <div class="flex items-center justify-between py-2 border-t border-surface-lighter">
                <span class="text-sm text-on-surface">{props.userNames[reg.userId] !== reg.userId ? props.userNames[reg.userId] : `Player ${reg.userId.slice(0, 6)}`}</span>
                <select value={reg.paymentStatus}
                  onChange={(e) => handleUpdatePayment(reg.id, e.currentTarget.value as PaymentStatus)}
                  class="text-sm bg-surface border border-surface-lighter rounded-lg px-2 py-1 text-on-surface">
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default FeeTracker;
