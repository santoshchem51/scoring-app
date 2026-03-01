import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Check, X } from 'lucide-solid';
import type { TournamentRegistration } from '../../../data/types';

interface Props {
  tournamentId: string;
  pendingRegistrations: TournamentRegistration[];
  onApprove: (userId: string) => void;
  onDecline: (userId: string, reason?: string) => void;
  onApproveAll: () => void;
  onDeclineAll?: () => void;
}

const MAX_VISIBLE = 10;

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ApprovalQueue: Component<Props> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [decliningUserId, setDecliningUserId] = createSignal<string | null>(null);
  const [declineReason, setDeclineReason] = createSignal('');
  const [processingUserId, setProcessingUserId] = createSignal<string | null>(null);

  const visibleRegs = () => {
    const all = props.pendingRegistrations;
    if (expanded() || all.length <= MAX_VISIBLE) return all;
    return all.slice(0, MAX_VISIBLE);
  };

  const handleApprove = async (userId: string) => {
    setProcessingUserId(userId);
    try {
      await Promise.resolve(props.onApprove(userId));
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleDeclineConfirm = async (userId: string) => {
    setProcessingUserId(userId);
    try {
      await Promise.resolve(props.onDecline(userId, declineReason().trim() || undefined));
    } finally {
      setProcessingUserId(null);
      setDecliningUserId(null);
      setDeclineReason('');
    }
  };

  return (
    <Show when={props.pendingRegistrations.length > 0}>
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-bold text-amber-400">
            Pending Requests ({props.pendingRegistrations.length})
          </h3>
          <Show when={props.pendingRegistrations.length >= 5}>
            <div class="flex gap-3">
              <button
                type="button"
                onClick={() => props.onApproveAll()}
                disabled={processingUserId() !== null}
                class="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Approve All
              </button>
              <Show when={props.onDeclineAll}>
                <button
                  type="button"
                  onClick={() => props.onDeclineAll?.()}
                  disabled={processingUserId() !== null}
                  class="text-xs font-semibold text-on-surface-muted hover:underline disabled:opacity-50"
                >
                  Decline All
                </button>
              </Show>
            </div>
          </Show>
        </div>

        <ul class="space-y-2 list-none p-0 m-0">
          <For each={visibleRegs()}>
            {(reg) => (
              <li class="bg-surface-light border-l-4 border-amber-400 rounded-r-lg p-3">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-sm font-semibold text-on-surface">
                      {reg.playerName ?? 'Unknown Player'}
                    </span>
                    <span class="text-xs text-on-surface-muted ml-2">
                      Requested {timeAgo(reg.registeredAt)}
                    </span>
                  </div>
                  <div class="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApprove(reg.userId)}
                      disabled={processingUserId() !== null}
                      class="flex items-center gap-1 px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecliningUserId(reg.userId)}
                      disabled={processingUserId() !== null}
                      class="flex items-center gap-1 px-2.5 py-1 bg-surface text-on-surface-muted text-xs font-semibold rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <X size={12} /> Decline
                    </button>
                  </div>
                </div>

                {/* Decline reason inline */}
                <Show when={decliningUserId() === reg.userId}>
                  <div class="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      maxLength={100}
                      value={declineReason()}
                      onInput={(e) => setDeclineReason(e.currentTarget.value)}
                      class="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-on-surface placeholder:text-on-surface-muted"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeclineConfirm(reg.userId)}
                      disabled={processingUserId() !== null}
                      class="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg disabled:opacity-50"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDecliningUserId(null); setDeclineReason(''); }}
                      class="px-2 py-1.5 text-on-surface-muted text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </Show>
              </li>
            )}
          </For>
        </ul>

        <Show when={!expanded() && props.pendingRegistrations.length > MAX_VISIBLE}>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            class="mt-2 text-xs text-primary font-semibold hover:underline"
          >
            Show all {props.pendingRegistrations.length}
          </button>
        </Show>
      </div>
    </Show>
  );
};

export default ApprovalQueue;
