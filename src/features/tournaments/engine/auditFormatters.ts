import type { AuditLogEntry } from './auditTypes';

export function formatAuditAction(entry: AuditLogEntry): string {
  const actor = entry.actorName;
  const d = entry.details;

  switch (d.action) {
    case 'score_edit':
      return `${actor} edited match scores`;
    case 'dispute_flag':
      return `${actor} flagged a match as disputed`;
    case 'dispute_resolve':
      return `${actor} resolved a dispute (scores ${d.type === 'edited' ? 'edited' : 'unchanged'})`;
    case 'role_change':
      if (d.newRole === null) return `${actor} removed ${d.targetName} from staff`;
      if (d.oldRole === null) return `${actor} added ${d.targetName} as ${d.newRole}`;
      return `${actor} changed ${d.targetName} role to ${d.newRole}`;
    case 'player_withdraw':
      return `${actor} withdrew ${d.playerName}`;
    case 'registration_approve':
      return `${actor} approved ${d.playerName}`;
    case 'registration_decline':
      return `${actor} declined ${d.playerName}`;
    case 'settings_change':
      return `${actor} updated tournament settings (${d.changedFields.join(', ')})`;
    case 'status_change':
      return `${actor} changed status from ${d.oldStatus} to ${d.newStatus}`;
    case 'player_quick_add':
      return `${actor} quick-added ${d.count} players`;
    case 'player_claim':
      return `${actor} claimed placeholder spot "${d.placeholderName}"`;
    default:
      return `${actor} performed an action`;
  }
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${diffDays} days ago`;
}
