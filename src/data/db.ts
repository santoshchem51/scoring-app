import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { CachedAchievement, Match, Player, ScoreEvent, Tournament, TournamentTeam, TournamentPool, BracketSlot, TournamentRegistration } from './types';
import type { SyncJob } from './firebase/syncQueue.types';

interface CachedTournament extends Tournament { cachedAt: number }
interface CachedTeam extends TournamentTeam { cachedAt: number }
interface CachedPool extends TournamentPool { cachedAt: number }
interface CachedBracketSlot extends BracketSlot { cachedAt: number }
interface CachedRegistration extends TournamentRegistration { cachedAt: number }

const db = new Dexie('PickleScoreDB') as Dexie & {
  matches: EntityTable<Match, 'id'>;
  players: EntityTable<Player, 'id'>;
  scoreEvents: EntityTable<ScoreEvent, 'id'>;
  tournaments: EntityTable<Tournament, 'id'>;
  syncQueue: EntityTable<SyncJob, 'id'>;
  achievements: EntityTable<CachedAchievement, 'achievementId'>;
  cachedTournaments: EntityTable<CachedTournament, 'id'>;
  cachedTeams: EntityTable<CachedTeam, 'id'>;
  cachedPools: EntityTable<CachedPool, 'id'>;
  cachedBrackets: EntityTable<CachedBracketSlot, 'id'>;
  cachedRegistrations: EntityTable<CachedRegistration, 'id'>;
};

db.version(1).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
});

db.version(2).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
});

db.version(3).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
  syncQueue: 'id, [status+nextRetryAt], createdAt',
});

db.version(4).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
  syncQueue: 'id, [status+nextRetryAt], createdAt',
  achievements: 'achievementId',
});

db.version(5).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
  syncQueue: 'id, [status+nextRetryAt], createdAt',
  achievements: 'achievementId',
  cachedTournaments: 'id, status, organizerId, cachedAt',
  cachedTeams: 'id, tournamentId, cachedAt',
  cachedPools: 'id, tournamentId, cachedAt',
  cachedBrackets: 'id, tournamentId, cachedAt',
  cachedRegistrations: 'id, tournamentId, cachedAt',
});

export { db };
export type { CachedTournament, CachedTeam, CachedPool, CachedBracketSlot, CachedRegistration };
