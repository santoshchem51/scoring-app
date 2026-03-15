import { describe, it, expect } from 'vitest';
import { THEMES } from '../themes';
import type { Theme } from '../../../stores/settingsStore';

const THEME_KEYS: Theme[] = ['court-vision-gold', 'classic', 'ember'];

const REQUIRED_VARS = [
  '--color-primary',
  '--color-primary-dark',
  '--color-accent',
  '--color-surface',
  '--color-surface-light',
  '--color-surface-lighter',
  '--color-surface-deep',
  '--color-on-surface',
  '--color-on-surface-muted',
  '--color-score',
  '--color-error',
  '--color-success',
  '--color-warning',
  '--color-info',
  '--color-primary-glow',
  '--color-accent-glow',
  '--color-score-glow',
  '--color-border',
  '--color-glass-surface',
  '--color-glass-border',
  '--color-glass-border-hover',
  '--color-court-line',
  '--color-court-line-strong',
  '--color-surface-overlay',
];

describe('THEMES config', () => {
  it('exports all three theme configs', () => {
    for (const key of THEME_KEYS) {
      expect(THEMES[key]).toBeDefined();
      expect(THEMES[key].name).toBe(key);
    }
  });

  it('every theme has a label and description', () => {
    for (const key of THEME_KEYS) {
      expect(THEMES[key].label.length).toBeGreaterThan(0);
      expect(THEMES[key].description.length).toBeGreaterThan(0);
    }
  });

  it('every theme defines all required CSS variables in colors', () => {
    for (const key of THEME_KEYS) {
      for (const v of REQUIRED_VARS) {
        expect(THEMES[key].colors, `${key} missing ${v} in colors`).toHaveProperty(v);
      }
    }
  });

  it('every theme defines all required CSS variables in outdoorColors', () => {
    for (const key of THEME_KEYS) {
      for (const v of REQUIRED_VARS) {
        expect(THEMES[key].outdoorColors, `${key} missing ${v} in outdoorColors`).toHaveProperty(v);
      }
    }
  });

  it('every theme defines team color defaults', () => {
    for (const key of THEME_KEYS) {
      expect(THEMES[key].teamDefaults).toBeDefined();
      expect(THEMES[key].teamDefaults.team1).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(THEMES[key].teamDefaults.team2).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('classic theme preserves original green/orange values', () => {
    expect(THEMES['classic'].colors['--color-primary']).toBe('#22c55e');
    expect(THEMES['classic'].colors['--color-accent']).toBe('#f97316');
    expect(THEMES['classic'].colors['--color-surface']).toBe('#0f1118');
  });

  it('court-vision-gold theme uses gold palette', () => {
    expect(THEMES['court-vision-gold'].colors['--color-primary']).toBe('#D4A853');
    expect(THEMES['court-vision-gold'].colors['--color-accent']).toBe('#FFC234');
    expect(THEMES['court-vision-gold'].colors['--color-surface']).toBe('#0A0908');
  });

  it('ember theme uses ember palette', () => {
    expect(THEMES['ember'].colors['--color-primary']).toBe('#E85D26');
    expect(THEMES['ember'].colors['--color-accent']).toBe('#FF9142');
    expect(THEMES['ember'].colors['--color-surface']).toBe('#080605');
  });

  it('every theme defines --color-surface-overlay', () => {
    expect(THEMES['court-vision-gold'].colors['--color-surface-overlay']).toBe('rgba(10, 9, 8, 0.88)');
    expect(THEMES['classic'].colors['--color-surface-overlay']).toBe('rgba(15, 17, 24, 0.88)');
    expect(THEMES['ember'].colors['--color-surface-overlay']).toBe('rgba(8, 6, 5, 0.88)');
  });
});
