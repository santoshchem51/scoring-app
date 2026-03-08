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

  describe('resetSyncStatus', () => {
    it('resets syncStatus to idle', async () => {
      const mod = await import('../useSyncStatus');
      mod.setSyncProcessing();
      expect(mod.syncStatus()).toBe('processing');

      mod.resetSyncStatus();
      expect(mod.syncStatus()).toBe('idle');
    });

    it('resets pendingCount to 0', async () => {
      const { getPendingCount, getFailedCount } = await import('../syncQueue');
      (getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      (getFailedCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      const mod = await import('../useSyncStatus');

      await mod.updateSyncStatus();
      expect(mod.pendingCount()).toBe(5);

      mod.resetSyncStatus();
      expect(mod.pendingCount()).toBe(0);
    });

    it('resets failedCount to 0', async () => {
      const { getPendingCount, getFailedCount } = await import('../syncQueue');
      (getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (getFailedCount as ReturnType<typeof vi.fn>).mockResolvedValue(3);
      const mod = await import('../useSyncStatus');

      await mod.updateSyncStatus();
      expect(mod.failedCount()).toBe(3);

      mod.resetSyncStatus();
      expect(mod.failedCount()).toBe(0);
    });

    it('resets all signals at once from a dirty state', async () => {
      const { getPendingCount, getFailedCount } = await import('../syncQueue');
      (getPendingCount as ReturnType<typeof vi.fn>).mockResolvedValue(7);
      (getFailedCount as ReturnType<typeof vi.fn>).mockResolvedValue(2);
      const mod = await import('../useSyncStatus');

      await mod.updateSyncStatus();
      expect(mod.syncStatus()).toBe('failed');
      expect(mod.pendingCount()).toBe(7);
      expect(mod.failedCount()).toBe(2);

      mod.resetSyncStatus();
      expect(mod.syncStatus()).toBe('idle');
      expect(mod.pendingCount()).toBe(0);
      expect(mod.failedCount()).toBe(0);
    });
  });
});
