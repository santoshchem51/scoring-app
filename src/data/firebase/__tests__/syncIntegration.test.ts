import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db';
import { enqueueJob, claimNextJobs, completeJob, failJob, setJobAwaitingAuth, resetAwaitingAuthJobs } from '../syncQueue';

describe('sync integration', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    await db.syncQueue.clear();
  });

  it('full flow: enqueue → claim → complete', async () => {
    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });

    const jobs = await claimNextJobs(2);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('processing');

    await completeJob('match:1');
    const completed = await db.syncQueue.get('match:1');
    expect(completed!.status).toBe('completed');
    expect(completed!.completedAt).toBeDefined();
  });

  it('dependency chain: match completes → playerStats becomes eligible', async () => {
    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });
    await enqueueJob('playerStats', '1', { type: 'playerStats', scorerUid: 'u1' }, ['match:1']);

    // Round 1: only match is claimable
    const round1 = await claimNextJobs(2);
    expect(round1).toHaveLength(1);
    expect(round1[0].type).toBe('match');

    // Complete the match
    await completeJob('match:1');

    // Round 2: playerStats now eligible
    const round2 = await claimNextJobs(2);
    expect(round2).toHaveLength(1);
    expect(round2[0].type).toBe('playerStats');
  });

  it('dependency chain: match fails → playerStats also fails', async () => {
    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });
    await enqueueJob('playerStats', '1', { type: 'playerStats', scorerUid: 'u1' }, ['match:1']);

    // Fail the match job
    const claimed = await claimNextJobs(2);
    await failJob('match:1', 'fatal error');

    // playerStats should get cascade-failed
    const round2 = await claimNextJobs(2);
    expect(round2).toHaveLength(0);
    const stats = await db.syncQueue.get('playerStats:1');
    expect(stats!.status).toBe('failed');
    expect(stats!.lastError).toContain('Dependency');
  });

  it('auth-dependent → awaitingAuth → reset → re-queued', async () => {
    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });
    await setJobAwaitingAuth('match:1');

    // Not claimable while awaitingAuth
    const before = await claimNextJobs(2);
    expect(before).toHaveLength(0);

    // Simulate auth recovery
    await resetAwaitingAuthJobs();

    // Now claimable
    const after = await claimNextJobs(2);
    expect(after).toHaveLength(1);
  });

  it('re-enqueue updates context without losing position', async () => {
    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });
    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: ['u2'] });

    const count = await db.syncQueue.count();
    expect(count).toBe(1);

    const job = await db.syncQueue.get('match:1');
    expect((job!.context as any).sharedWith).toEqual(['u2']);
  });

  it('queue persistence: data survives table operations', async () => {
    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });

    // Simulate "app reload" by reading from fresh query
    const allJobs = await db.syncQueue.toArray();
    expect(allJobs).toHaveLength(1);
    expect(allJobs[0].id).toBe('match:1');
  });
});
