import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { playerRepository } from '../playerRepository';
import { db } from '../../db';

describe('playerRepository', () => {
  beforeEach(async () => {
    await db.players.clear();
  });

  it('creates and retrieves a player', async () => {
    const player = await playerRepository.create('Alice');
    expect(player.name).toBe('Alice');
    expect(player.id).toBeTruthy();

    const result = await playerRepository.getById(player.id);
    expect(result?.name).toBe('Alice');
  });

  it('lists all players alphabetically', async () => {
    await playerRepository.create('Charlie');
    await playerRepository.create('Alice');
    await playerRepository.create('Bob');

    const all = await playerRepository.getAll();
    expect(all.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('updates a player name', async () => {
    const player = await playerRepository.create('Alice');
    await playerRepository.update(player.id, { name: 'Alicia' });
    const updated = await playerRepository.getById(player.id);
    expect(updated?.name).toBe('Alicia');
  });

  it('deletes a player', async () => {
    const player = await playerRepository.create('Alice');
    await playerRepository.delete(player.id);
    const result = await playerRepository.getById(player.id);
    expect(result).toBeUndefined();
  });
});
