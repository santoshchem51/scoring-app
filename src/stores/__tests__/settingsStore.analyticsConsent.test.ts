import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('settingsStore analyticsConsent', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults analyticsConsent to pending', async () => {
    const { settings } = await import('../settingsStore');
    expect(settings().analyticsConsent).toBe('pending');
  });

  it('defaults analyticsConsentTimestamp to null', async () => {
    const { settings } = await import('../settingsStore');
    expect(settings().analyticsConsentTimestamp).toBeNull();
  });

  it('existing localStorage without analyticsConsent gets default merged in', async () => {
    localStorage.setItem('pickle-score-settings', JSON.stringify({
      defaultScoringMode: 'rally',
    }));
    const { settings } = await import('../settingsStore');
    expect(settings().defaultScoringMode).toBe('rally');
    expect(settings().analyticsConsent).toBe('pending');
    expect(settings().analyticsConsentTimestamp).toBeNull();
  });

  it('setSettings can change analyticsConsent to accepted', async () => {
    const { settings, setSettings } = await import('../settingsStore');
    const now = Date.now();
    setSettings({ analyticsConsent: 'accepted', analyticsConsentTimestamp: now });
    expect(settings().analyticsConsent).toBe('accepted');
    expect(settings().analyticsConsentTimestamp).toBe(now);
  });

  it('setSettings can change analyticsConsent to declined', async () => {
    const { settings, setSettings } = await import('../settingsStore');
    const now = Date.now();
    setSettings({ analyticsConsent: 'declined', analyticsConsentTimestamp: now });
    expect(settings().analyticsConsent).toBe('declined');
    expect(settings().analyticsConsentTimestamp).toBe(now);
  });

  it('persists analyticsConsent to localStorage', async () => {
    const { setSettings } = await import('../settingsStore');
    const now = Date.now();
    setSettings({ analyticsConsent: 'accepted', analyticsConsentTimestamp: now });
    const stored = JSON.parse(localStorage.getItem('pickle-score-settings')!);
    expect(stored.analyticsConsent).toBe('accepted');
    expect(stored.analyticsConsentTimestamp).toBe(now);
  });
});
