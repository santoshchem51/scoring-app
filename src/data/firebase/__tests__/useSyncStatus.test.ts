import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase/syncQueue', () => ({
  getPendingCount: vi.fn(() => Promise.resolve(0)),
  getFailedCount: vi.fn(() => Promise.resolve(0)),
}));

describe('useSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('exports syncStatus, pendingCount, failedCount signals', async () => {
    const mod = await import('../useSyncStatus');
    expect(typeof mod.syncStatus).toBe('function');
    expect(typeof mod.pendingCount).toBe('function');
    expect(typeof mod.failedCount).toBe('function');
  });

  it('syncStatus defaults to idle', async () => {
    const mod = await import('../useSyncStatus');
    expect(mod.syncStatus()).toBe('idle');
  });

  it('updateSyncStatus sets pending when pending jobs exist', async () => {
    const { getPendingCount, getFailedCount } = await import('../syncQueue');
    (getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    (getFailedCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const mod = await import('../useSyncStatus');
    await mod.updateSyncStatus();
    expect(mod.syncStatus()).toBe('pending');
    expect(mod.pendingCount()).toBe(3);
  });

  it('updateSyncStatus shows failed when failed jobs exist', async () => {
    const { getPendingCount, getFailedCount } = await import('../syncQueue');
    (getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (getFailedCount as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    const mod = await import('../useSyncStatus');
    await mod.updateSyncStatus();
    expect(mod.syncStatus()).toBe('failed');
    expect(mod.failedCount()).toBe(2);
  });

  it('failed takes priority over pending', async () => {
    const { getPendingCount, getFailedCount } = await import('../syncQueue');
    (getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    (getFailedCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    const mod = await import('../useSyncStatus');
    await mod.updateSyncStatus();
    expect(mod.syncStatus()).toBe('failed');
  });

  it('updateSyncStatus sets idle when no pending or failed', async () => {
    const { getPendingCount, getFailedCount } = await import('../syncQueue');
    (getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (getFailedCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const mod = await import('../useSyncStatus');
    await mod.updateSyncStatus();
    expect(mod.syncStatus()).toBe('idle');
  });

  it('setSyncProcessing sets status to processing', async () => {
    const mod = await import('../useSyncStatus');
    mod.setSyncProcessing();
    expect(mod.syncStatus()).toBe('processing');
  });
});
