import type { SessionRsvp } from '../../../data/types';

export function statusColor(rsvp: SessionRsvp): string {
  if (rsvp.dayOfStatus === 'here') return 'border-emerald-500';
  if (rsvp.dayOfStatus === 'on-my-way') return 'border-blue-500';
  if (rsvp.response === 'maybe') return 'border-amber-500';
  if (rsvp.response === 'out' || rsvp.dayOfStatus === 'cant-make-it') return 'border-gray-500';
  return 'border-emerald-500/50';
}

export function statusLabel(rsvp: SessionRsvp): string {
  if (rsvp.dayOfStatus === 'here') return 'Here';
  if (rsvp.dayOfStatus === 'on-my-way') return 'On my way';
  if (rsvp.dayOfStatus === 'cant-make-it') return "Can't make it";
  if (rsvp.response === 'in') return 'In';
  if (rsvp.response === 'maybe') return 'Maybe';
  return 'Out';
}

export function statusTextColor(rsvp: SessionRsvp): string {
  if (rsvp.dayOfStatus === 'here') return 'text-emerald-400';
  if (rsvp.dayOfStatus === 'on-my-way') return 'text-blue-400';
  if (rsvp.dayOfStatus === 'cant-make-it') return 'text-red-400';
  if (rsvp.response === 'in') return 'text-emerald-400';
  if (rsvp.response === 'maybe') return 'text-amber-400';
  return 'text-gray-400';
}
