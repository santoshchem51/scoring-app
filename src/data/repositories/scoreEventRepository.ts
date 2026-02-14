import { db } from '../db';
import type { ScoreEvent } from '../types';

export const scoreEventRepository = {
  async save(event: ScoreEvent): Promise<void> {
    await db.scoreEvents.add(event);
  },

  async getByMatchId(matchId: string): Promise<ScoreEvent[]> {
    return db.scoreEvents.where('matchId').equals(matchId).sortBy('timestamp');
  },

  async deleteByMatchId(matchId: string): Promise<void> {
    await db.scoreEvents.where('matchId').equals(matchId).delete();
  },
};
