import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('settingsStore theme field', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('settings() includes theme with court-vision-gold default', async () => {
    const { settings } = await import('../settingsStore');
    expect(settings().theme).toBe('court-vision-gold');
  });

  it('existing localStorage without theme field gets default merged in', async () => {
    localStorage.setItem('pickle-score-settings', JSON.stringify({
      defaultScoringMode: 'rally',
    }));
    const { settings } = await import('../settingsStore');
    expect(settings().defaultScoringMode).toBe('rally');
    expect(settings().theme).toBe('court-vision-gold');
  });

  it('setSettings can change theme to classic', async () => {
    const { settings, setSettings } = await import('../settingsStore');
    setSettings({ theme: 'classic' });
    expect(settings().theme).toBe('classic');
  });

  it('setSettings can change theme to ember', async () => {
    const { settings, setSettings } = await import('../settingsStore');
    setSettings({ theme: 'ember' });
    expect(settings().theme).toBe('ember');
  });

  it('persists theme to localStorage', async () => {
    const { settings, setSettings } = await import('../settingsStore');
    setSettings({ theme: 'ember' });
    const stored = JSON.parse(localStorage.getItem('pickle-score-settings')!);
    expect(stored.theme).toBe('ember');
  });
});
