import { db } from '../db';
import type { Player } from '../types';

export const playerRepository = {
  async create(name: string): Promise<Player> {
    const player: Player = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.players.add(player);
    return player;
  },

  async getById(id: string): Promise<Player | undefined> {
    return db.players.get(id);
  },

  async getAll(): Promise<Player[]> {
    return db.players.orderBy('name').toArray();
  },

  async update(id: string, changes: Partial<Pick<Player, 'name'>>): Promise<void> {
    await db.players.update(id, { ...changes, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.players.delete(id);
  },
};
