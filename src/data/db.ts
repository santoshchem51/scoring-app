import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { CachedAchievement, Match, Player, ScoreEvent, Tournament } from './types';
import type { SyncJob } from './firebase/syncQueue.types';

const db = new Dexie('PickleScoreDB') as Dexie & {
  matches: EntityTable<Match, 'id'>;
  players: EntityTable<Player, 'id'>;
  scoreEvents: EntityTable<ScoreEvent, 'id'>;
  tournaments: EntityTable<Tournament, 'id'>;
  syncQueue: EntityTable<SyncJob, 'id'>;
  achievements: EntityTable<CachedAchievement, 'achievementId'>;
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

export { db };
