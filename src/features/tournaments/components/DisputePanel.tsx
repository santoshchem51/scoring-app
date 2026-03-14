import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { MatchDispute } from '../engine/disputeTypes';

interface DisputePanelProps {
  disputes: MatchDispute[];
  canResolve: boolean;
  onResolve: (disputeId: string, matchId: string, type: 'edited' | 'dismissed') => void;
}

const DisputePanel: Component<DisputePanelProps> = (props) => {
  const openDisputes = () => props.disputes.filter((d) => d.status === 'open');

  return (
    <div class="space-y-3">
      <h3 class="text-lg font-semibold text-on-surface">Disputes</h3>

      <Show when={openDisputes().length === 0}>
        <p class="text-on-surface-muted text-sm">No open disputes</p>
      </Show>

      <For each={openDisputes()}>
        {(dispute) => (
          <div class="rounded-lg border border-error/30 bg-error/5 p-3 space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-sm font-medium text-on-surface">{dispute.flaggedByName}</span>
                <p class="text-sm text-on-surface-muted mt-1">{dispute.reason}</p>
              </div>
              <span class="rounded-full bg-error/20 px-2 py-0.5 text-xs font-medium text-error">Open</span>
            </div>
            <Show when={props.canResolve}>
              <div class="flex gap-2 pt-1">
                <button
                  class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
                  onClick={() => props.onResolve(dispute.id, dispute.matchId, 'edited')}
                >Edit Scores</button>
                <button
                  class="rounded-lg bg-surface-container-high px-3 py-1.5 text-sm text-on-surface"
                  onClick={() => props.onResolve(dispute.id, dispute.matchId, 'dismissed')}
                >Dismiss</button>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};

export default DisputePanel;
