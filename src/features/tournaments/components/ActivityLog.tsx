import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { AuditLogEntry } from '../engine/auditTypes';
import { formatAuditAction, formatRelativeTime } from '../engine/auditFormatters';

interface ActivityLogProps {
  entries: AuditLogEntry[];
}

const ActivityLog: Component<ActivityLogProps> = (props) => {
  const getTimestamp = (entry: AuditLogEntry): number => {
    const ts = entry.timestamp;
    if (typeof ts === 'number') return ts;
    if (ts && typeof ts === 'object' && 'toMillis' in ts) return (ts as { toMillis: () => number }).toMillis();
    return Date.now();
  };

  return (
    <div class="space-y-2">
      <h3 class="text-lg font-semibold text-on-surface">Activity Log</h3>

      <Show when={props.entries.length === 0}>
        <p class="text-on-surface-muted text-sm">No activity yet</p>
      </Show>

      <div class="space-y-1">
        <For each={props.entries}>
          {(entry) => (
            <div class="flex items-start justify-between rounded-lg bg-surface-container p-3">
              <span class="text-sm text-on-surface">{formatAuditAction(entry)}</span>
              <span class="text-xs text-on-surface-muted whitespace-nowrap ml-2">
                {formatRelativeTime(getTimestamp(entry))}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default ActivityLog;
