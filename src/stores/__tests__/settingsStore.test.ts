import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../../shared/observability/logger', () => ({ logger: mockLogger }));

describe('settingsStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('loads defaults when localStorage is empty', async () => {
    const { settings } = await import('../settingsStore');
    expect(settings().defaultPointsToWin).toBe(11);
    expect(settings().analyticsConsent).toBe('pending');
  });

  it('loads stored settings merged with defaults', async () => {
    localStorage.setItem('pickle-score-settings', JSON.stringify({ defaultPointsToWin: 21 }));
    const { settings } = await import('../settingsStore');
    expect(settings().defaultPointsToWin).toBe(21);
    expect(settings().theme).toBe('court-vision-gold'); // from defaults
  });

  it('falls back to defaults when localStorage has invalid JSON', async () => {
    localStorage.setItem('pickle-score-settings', '{invalid json');
    const { settings } = await import('../settingsStore');
    expect(settings().defaultPointsToWin).toBe(11); // defaults
  });

  it('logs error when localStorage.setItem throws', async () => {
    const { settings, setSettings } = await import('../settingsStore');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    setSettings({ defaultPointsToWin: 21 });

    expect(mockLogger.error).toHaveBeenCalledWith('Failed to save settings', expect.any(DOMException));
    // Settings still update in memory even though persistence failed
    expect(settings().defaultPointsToWin).toBe(21);
  });

  it('updates settings in memory and persists to localStorage', async () => {
    const { settings, setSettings } = await import('../settingsStore');
    setSettings({ theme: 'ember' });
    expect(settings().theme).toBe('ember');
    const stored = JSON.parse(localStorage.getItem('pickle-score-settings')!);
    expect(stored.theme).toBe('ember');
  });
});
