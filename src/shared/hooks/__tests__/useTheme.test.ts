import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useTheme', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    // Remove all inline styles without nuking other attributes
    for (const key of Array.from(document.documentElement.style)) {
      document.documentElement.style.removeProperty(key);
    }
  });

  afterEach(() => {
    for (const key of Array.from(document.documentElement.style)) {
      document.documentElement.style.removeProperty(key);
    }
  });

  it('applies Court Vision Gold CSS variables to documentElement by default', async () => {
    const { useTheme } = await import('../useTheme');
    const { createRoot } = await import('solid-js');

    createRoot((dispose) => {
      useTheme();
      const style = document.documentElement.style;
      expect(style.getPropertyValue('--color-primary')).toBe('#D4A853');
      expect(style.getPropertyValue('--color-surface')).toBe('#0A0908');
      dispose();
    });
  });

  it('applies classic theme when settings theme is classic', async () => {
    localStorage.setItem('pickle-score-settings', JSON.stringify({ theme: 'classic' }));
    const { useTheme } = await import('../useTheme');
    const { createRoot } = await import('solid-js');

    createRoot((dispose) => {
      useTheme();
      const style = document.documentElement.style;
      expect(style.getPropertyValue('--color-primary')).toBe('#22c55e');
      dispose();
    });
  });

  it('applies outdoor overrides when displayMode is outdoor', async () => {
    localStorage.setItem('pickle-score-settings', JSON.stringify({
      theme: 'court-vision-gold',
      displayMode: 'outdoor',
    }));
    const { useTheme } = await import('../useTheme');
    const { createRoot } = await import('solid-js');

    createRoot((dispose) => {
      useTheme();
      const style = document.documentElement.style;
      expect(style.getPropertyValue('--color-primary')).toBe('#7A5C10');
      expect(style.getPropertyValue('--color-surface')).toBe('#FFFFFF');
      dispose();
    });
  });

  it('cleans up stale variables when switching themes', async () => {
    const { useTheme } = await import('../useTheme');
    const { setSettings } = await import('../../../stores/settingsStore');
    const { createRoot } = await import('solid-js');

    let dispose!: () => void;
    createRoot((d) => {
      dispose = d;
      useTheme();
    });

    const style = document.documentElement.style;

    // Default is CVG (applied during createRoot)
    expect(style.getPropertyValue('--color-primary')).toBe('#D4A853');

    // Switch to classic — signal update outside batch triggers synchronous re-run
    setSettings({ theme: 'classic' });
    expect(style.getPropertyValue('--color-primary')).toBe('#22c55e');

    // Switch to ember
    setSettings({ theme: 'ember' });
    expect(style.getPropertyValue('--color-primary')).toBe('#E85D26');

    dispose();
  });
});
