import type { RsvpResponse, DayOfStatus } from '../../../data/types';

export function getRingColor(response: RsvpResponse, dayOfStatus: DayOfStatus): string {
  // Day-of status takes priority
  if (dayOfStatus === 'here') return 'ring-emerald-500';
  if (dayOfStatus === 'on-my-way') return 'ring-blue-500';
  if (dayOfStatus === 'cant-make-it') return 'ring-gray-500';
  // Fall back to RSVP response
  if (response === 'in') return 'ring-emerald-500/50';
  if (response === 'maybe') return 'ring-amber-500';
  return 'ring-gray-500';
}

export function isGrayedOut(response: RsvpResponse, dayOfStatus: DayOfStatus): boolean {
  return response === 'out' || dayOfStatus === 'cant-make-it';
}

export type IndicatorType = 'here' | 'on-my-way' | 'cant-make-it' | 'maybe' | null;

export function getIndicatorType(response: RsvpResponse, dayOfStatus: DayOfStatus): IndicatorType {
  if (dayOfStatus === 'here') return 'here';
  if (dayOfStatus === 'on-my-way') return 'on-my-way';
  if (dayOfStatus === 'cant-make-it') return 'cant-make-it';
  if (response === 'maybe') return 'maybe';
  // 'in' = no indicator, 'out' = no indicator (avatar is grayed out instead)
  return null;
}
