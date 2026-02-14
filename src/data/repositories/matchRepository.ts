import { db } from '../db';
import type { Match } from '../types';

export const matchRepository = {
  async save(match: Match): Promise<void> {
    await db.matches.put(match);
  },

  async getById(id: string): Promise<Match | undefined> {
    return db.matches.get(id);
  },

  async getAll(): Promise<Match[]> {
    return db.matches.orderBy('startedAt').reverse().toArray();
  },

  async getCompleted(): Promise<Match[]> {
    return db.matches
      .where('status')
      .equals('completed')
      .reverse()
      .sortBy('startedAt');
  },

  async getByPlayerId(playerId: string): Promise<Match[]> {
    const t1 = await db.matches.where('team1PlayerIds').equals(playerId).toArray();
    const t2 = await db.matches.where('team2PlayerIds').equals(playerId).toArray();
    const merged = [...t1, ...t2];
    merged.sort((a, b) => b.startedAt - a.startedAt);
    return merged;
  },

  async delete(id: string): Promise<void> {
    await db.matches.delete(id);
  },
};
