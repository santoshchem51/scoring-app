// e2e/helpers/firestore-paths.ts
// Firestore collection/subcollection path constants.
// Import these instead of hardcoding paths in tests to prevent typos
// (e.g., the P0 bug where 'events' was used instead of 'scoreEvents').

export const PATHS = {
  tournaments: 'tournaments',
  teams: (tournamentId: string) => `tournaments/${tournamentId}/teams`,
  pools: (tournamentId: string) => `tournaments/${tournamentId}/pools`,
  bracket: (tournamentId: string) => `tournaments/${tournamentId}/bracket`,
  matches: 'matches',
  spectatorProjection: (matchId: string) => `matches/${matchId}/public`,
  scoreEvents: (matchId: string) => `matches/${matchId}/scoreEvents`,
  buddyGroups: 'buddyGroups',
  buddyMembers: (groupId: string) => `buddyGroups/${groupId}/members`,
  gameSessions: 'gameSessions',
  rsvps: (sessionId: string) => `gameSessions/${sessionId}/rsvps`,
  users: 'users',
} as const;

/** Document ID for the spectator projection subdoc within matches/{id}/public/ */
export const SPECTATOR_DOC_ID = 'spectator';
