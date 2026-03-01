import type { TournamentRegistration } from '../../../data/types';

export const EXPIRY_DAYS = 14;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export function getExpiredRegistrationUserIds(registrations: TournamentRegistration[]): string[] {
  const now = Date.now();
  return registrations
    .filter((r) => r.status === 'pending' && (now - r.registeredAt) > EXPIRY_MS)
    .map((r) => r.userId);
}
