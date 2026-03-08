import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('settingsStore notification defaults', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('settings() includes notification preferences with true defaults', async () => {
    const { settings } = await import('../settingsStore');
    const s = settings();
    expect(s.notifyBuddy).toBe(true);
    expect(s.notifyTournament).toBe(true);
    expect(s.notifyAchievement).toBe(true);
    expect(s.notifyStats).toBe(true);
  });

  it('existing localStorage without notify fields gets defaults merged in', async () => {
    localStorage.setItem('pickle-score-settings', JSON.stringify({
      defaultScoringMode: 'rally',
    }));
    const { settings } = await import('../settingsStore');
    const s = settings();
    expect(s.defaultScoringMode).toBe('rally');
    expect(s.notifyBuddy).toBe(true);
    expect(s.notifyTournament).toBe(true);
  });
});
