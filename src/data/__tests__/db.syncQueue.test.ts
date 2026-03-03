import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import type { SyncJob } from '../firebase/syncQueue.types';

function createTestJob(overrides: Partial<SyncJob> = {}): SyncJob {
  const entityId = overrides.entityId ?? crypto.randomUUID();
  const type = overrides.type ?? 'match';
  return {
    id: `${type}:${entityId}`,
    type,
    entityId,
    context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    status: 'pending',
    retryCount: 0,
    nextRetryAt: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('db.syncQueue', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
  });

  it('syncQueue table exists on db', () => {
    expect(db.syncQueue).toBeDefined();
    expect(db.syncQueue.name).toBe('syncQueue');
  });

  it('can store and retrieve a SyncJob', async () => {
    const job = createTestJob();
    await db.syncQueue.put(job);

    const retrieved = await db.syncQueue.get(job.id);
    expect(retrieved).toEqual(job);
  });

  it('upserts: put same ID twice keeps count at 1', async () => {
    const job = createTestJob();
    await db.syncQueue.put(job);
    await db.syncQueue.put({ ...job, retryCount: 1 });

    const count = await db.syncQueue.count();
    expect(count).toBe(1);

    const retrieved = await db.syncQueue.get(job.id);
    expect(retrieved!.retryCount).toBe(1);
  });

  it('compound index query: pending jobs where nextRetryAt <= now', async () => {
    const now = Date.now();

    const readyJob = createTestJob({
      entityId: 'ready-1',
      status: 'pending',
      nextRetryAt: now - 1000, // in the past = ready
    });

    const futureJob = createTestJob({
      entityId: 'future-1',
      status: 'pending',
      nextRetryAt: now + 60_000, // in the future = not ready
    });

    const completedJob = createTestJob({
      entityId: 'done-1',
      status: 'completed',
      nextRetryAt: now - 5000, // past but completed = should not match
    });

    await db.syncQueue.bulkPut([readyJob, futureJob, completedJob]);

    // Query using the compound index [status+nextRetryAt]
    const pendingReady = await db.syncQueue
      .where('[status+nextRetryAt]')
      .between(['pending', 0], ['pending', now], true, true)
      .toArray();

    expect(pendingReady).toHaveLength(1);
    expect(pendingReady[0].id).toBe(readyJob.id);
  });
});
