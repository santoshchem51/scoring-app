import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock virtual:pwa-register before importing the store
const mockRegisterSW = vi.fn();
vi.mock('virtual:pwa-register', () => ({
  registerSW: mockRegisterSW,
}));

describe('swUpdateStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mockRegisterSW.mockReset();
    localStorage.removeItem('sw-update-dismissed-at');
    localStorage.removeItem('sw-updated-pending-ack');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports swUpdateVisible as a function returning false initially', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { swUpdateVisible } = await import('../swUpdateStore');
    expect(swUpdateVisible()).toBe(false);
  });

  it('initSWUpdate calls registerSW once', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { initSWUpdate } = await import('../swUpdateStore');
    initSWUpdate();
    expect(mockRegisterSW).toHaveBeenCalledTimes(1);
    expect(mockRegisterSW).toHaveBeenCalledWith(expect.objectContaining({
      onNeedRefresh: expect.any(Function),
      onRegisterError: expect.any(Function),
    }));
  });

  it('initSWUpdate is idempotent (second call is no-op)', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { initSWUpdate } = await import('../swUpdateStore');
    initSWUpdate();
    initSWUpdate();
    expect(mockRegisterSW).toHaveBeenCalledTimes(1);
  });

  it('swUpdateVisible returns true after onNeedRefresh fires', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
    const { initSWUpdate, swUpdateVisible } = await import('../swUpdateStore');
    initSWUpdate();
    expect(swUpdateVisible()).toBe(false);
    capturedOnNeedRefresh!();
    expect(swUpdateVisible()).toBe(true);
  });

  it('dismissUpdate hides toast and sets localStorage timestamp', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
    const { initSWUpdate, swUpdateVisible, dismissUpdate } = await import('../swUpdateStore');
    initSWUpdate();
    capturedOnNeedRefresh!();
    expect(swUpdateVisible()).toBe(true);
    dismissUpdate();
    expect(swUpdateVisible()).toBe(false);
    expect(localStorage.getItem('sw-update-dismissed-at')).toBeTruthy();
  });

  it('swUpdateVisible returns false within 24h of dismiss', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
    localStorage.setItem('sw-update-dismissed-at', String(Date.now() - 23 * 60 * 60 * 1000));
    const { initSWUpdate, swUpdateVisible } = await import('../swUpdateStore');
    initSWUpdate();
    capturedOnNeedRefresh!();
    expect(swUpdateVisible()).toBe(false);
  });

  it('swUpdateVisible returns true after 24h dismiss expires', async () => {
    let capturedOnNeedRefresh: (() => void) | undefined;
    mockRegisterSW.mockImplementation((opts: { onNeedRefresh: () => void }) => {
      capturedOnNeedRefresh = opts.onNeedRefresh;
      return vi.fn();
    });
    localStorage.setItem('sw-update-dismissed-at', String(Date.now() - 25 * 60 * 60 * 1000));
    const { initSWUpdate, swUpdateVisible } = await import('../swUpdateStore');
    initSWUpdate();
    capturedOnNeedRefresh!();
    expect(swUpdateVisible()).toBe(true);
  });

  it('applyUpdate calls the updateSW function and sets pending ack', async () => {
    const mockUpdateFn = vi.fn();
    mockRegisterSW.mockReturnValue(mockUpdateFn);
    const { initSWUpdate, applyUpdate } = await import('../swUpdateStore');
    initSWUpdate();
    applyUpdate();
    expect(mockUpdateFn).toHaveBeenCalledWith(true);
    expect(localStorage.getItem('sw-updated-pending-ack')).toBe('1');
  });

  it('applyUpdate is no-op if initSWUpdate was never called', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { applyUpdate } = await import('../swUpdateStore');
    applyUpdate();
  });

  it('updateAcknowledged returns true when pending ack exists on init', async () => {
    localStorage.setItem('sw-updated-pending-ack', '1');
    mockRegisterSW.mockReturnValue(vi.fn());
    const { initSWUpdate, updateAcknowledged } = await import('../swUpdateStore');
    initSWUpdate();
    expect(updateAcknowledged()).toBe(true);
    expect(localStorage.getItem('sw-updated-pending-ack')).toBeNull();
  });

  it('updateAcknowledged returns false when no pending ack', async () => {
    mockRegisterSW.mockReturnValue(vi.fn());
    const { initSWUpdate, updateAcknowledged } = await import('../swUpdateStore');
    initSWUpdate();
    expect(updateAcknowledged()).toBe(false);
  });
});
