# Theme System + Court Vision Gold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 3-theme system (Classic, Court Vision Gold, Ember) with court-line motifs, glassmorphism, and performance-optimized animations.

**Architecture:** Theme configs define CSS variable values; a reactive SolidJS effect applies them to document.documentElement at runtime. Structural UI additions (court-line motifs, glass panels, net divider) are shared across all themes. CSS @theme block keeps Classic values as defaults to prevent flash-of-wrong-theme.

**Tech Stack:** SolidJS 1.9, TypeScript, Tailwind CSS v4, Vite 6

---

## Wave 1: Foundation (Theme Infrastructure)

### Task 1: Add theme type and field to settingsStore

**Files to modify:**
- `src/stores/settingsStore.ts`
- `src/stores/__tests__/settingsStore.theme.test.ts` (new)

**Step 1 — Write failing test:**

Create `src/stores/__tests__/settingsStore.theme.test.ts`:

```typescript
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
```

**Step 2 — Verify test fails:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/stores/__tests__/settingsStore.theme.test.ts
```

Expected: fails because `theme` field does not exist on Settings.

**Step 3 — Implement:**

Edit `src/stores/settingsStore.ts`:

Add the Theme type export after the `ScoringUIMode` type:

```typescript
export type Theme = 'court-vision-gold' | 'classic' | 'ember';
```

Add `theme: Theme` to the Settings interface:

```typescript
interface Settings {
  defaultScoringMode: 'sideout' | 'rally';
  defaultPointsToWin: 11 | 15 | 21;
  defaultMatchFormat: 'single' | 'best-of-3' | 'best-of-5';
  scoringUIMode: ScoringUIMode;
  keepScreenAwake: boolean;
  soundEffects: 'off' | 'subtle' | 'full';
  hapticFeedback: boolean;
  voiceAnnouncements: 'off' | 'scores' | 'full';
  voiceUri: string;
  voicePitch: number;
  voiceRate: number;
  displayMode: 'dark' | 'outdoor';
  theme: Theme;
  notifyBuddy: boolean;
  notifyTournament: boolean;
  notifyAchievement: boolean;
  notifyStats: boolean;
}
```

Add `theme: 'court-vision-gold'` to DEFAULTS:

```typescript
const DEFAULTS: Settings = {
  defaultScoringMode: 'sideout',
  defaultPointsToWin: 11,
  defaultMatchFormat: 'single',
  scoringUIMode: 'simple',
  keepScreenAwake: true,
  soundEffects: 'off',
  hapticFeedback: false,
  voiceAnnouncements: 'off',
  voiceUri: '',
  voicePitch: 1.0,
  voiceRate: 1.0,
  displayMode: 'dark',
  theme: 'court-vision-gold',
  notifyBuddy: true,
  notifyTournament: true,
  notifyAchievement: true,
  notifyStats: true,
};
```

**Step 4 — Verify test passes:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/stores/__tests__/settingsStore.theme.test.ts
```

Expected: all 5 tests pass.

**Step 5 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 6 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/stores/settingsStore.ts src/stores/__tests__/settingsStore.theme.test.ts && git commit -m "feat(theme): add Theme type and theme field to settingsStore"
```

---

### Task 2: Create themes.ts with all 3 theme configs

**Files to create:**
- `src/shared/constants/themes.ts`
- `src/shared/constants/__tests__/themes.test.ts` (new)

**Step 1 — Write failing test:**

Create `src/shared/constants/__tests__/themes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { THEMES } from '../themes';
import type { Theme } from '../../../stores/settingsStore';

const THEME_KEYS: Theme[] = ['court-vision-gold', 'classic', 'ember'];

// Every theme must define the complete set of CSS variables
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
```

**Step 2 — Verify test fails:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/shared/constants/__tests__/themes.test.ts
```

Expected: fails because `themes.ts` does not exist.

**Step 3 — Implement:**

Create `src/shared/constants/themes.ts`:

```typescript
import type { Theme } from '../../stores/settingsStore';

export interface ThemeConfig {
  name: Theme;
  label: string;
  description: string;
  colors: Record<string, string>;
  outdoorColors: Record<string, string>;
  teamDefaults: { team1: string; team2: string };
}

const CLASSIC_COLORS: Record<string, string> = {
  '--color-primary': '#22c55e',
  '--color-primary-dark': '#16a34a',
  '--color-accent': '#f97316',
  '--color-surface': '#0f1118',
  '--color-surface-light': '#1a1d2e',
  '--color-surface-lighter': '#252a3a',
  '--color-surface-deep': '#080a10',
  '--color-on-surface': '#f1f5f9',
  '--color-on-surface-muted': '#a0aec0',
  '--color-score': '#facc15',
  '--color-error': '#dc2626',
  '--color-success': '#22c55e',
  '--color-warning': '#eab308',
  '--color-info': '#3b82f6',
  '--color-primary-glow': 'rgba(34, 197, 94, 0.15)',
  '--color-accent-glow': 'rgba(249, 115, 22, 0.15)',
  '--color-score-glow': 'rgba(250, 204, 21, 0.2)',
  '--color-border': 'rgba(255, 255, 255, 0.08)',
  '--color-glass-surface': 'rgba(34, 197, 94, 0.02)',
  '--color-glass-border': 'rgba(34, 197, 94, 0.08)',
  '--color-glass-border-hover': 'rgba(34, 197, 94, 0.15)',
  '--color-court-line': 'rgba(34, 197, 94, 0.15)',
  '--color-court-line-strong': 'rgba(34, 197, 94, 0.25)',
  '--color-surface-overlay': 'rgba(15, 17, 24, 0.88)',
};

const CLASSIC_OUTDOOR: Record<string, string> = {
  '--color-primary': '#15803d',
  '--color-primary-dark': '#166534',
  '--color-accent': '#15803d',
  '--color-surface': '#ffffff',
  '--color-surface-light': '#f1f5f9',
  '--color-surface-lighter': '#e2e8f0',
  '--color-surface-deep': '#f8fafc',
  '--color-on-surface': '#0f172a',
  '--color-on-surface-muted': '#475569',
  '--color-score': '#ca8a04',
  '--color-error': '#dc2626',
  '--color-success': '#15803d',
  '--color-warning': '#a16207',
  '--color-info': '#2563eb',
  '--color-primary-glow': 'rgba(21, 128, 61, 0.1)',
  '--color-accent-glow': 'rgba(249, 115, 22, 0.1)',
  '--color-score-glow': 'rgba(202, 138, 4, 0.15)',
  '--color-border': 'rgba(0, 0, 0, 0.08)',
  '--color-glass-surface': 'rgba(255, 255, 255, 0.95)',
  '--color-glass-border': 'rgba(0, 0, 0, 0.12)',
  '--color-glass-border-hover': 'rgba(0, 0, 0, 0.2)',
  '--color-court-line': 'rgba(21, 128, 61, 0.2)',
  '--color-court-line-strong': 'rgba(21, 128, 61, 0.35)',
  '--color-surface-overlay': 'rgba(241, 245, 249, 0.92)',
};

const CVG_COLORS: Record<string, string> = {
  '--color-primary': '#D4A853',
  '--color-primary-dark': '#B8912E',
  '--color-accent': '#FFC234',
  '--color-surface': '#0A0908',
  '--color-surface-light': '#141210',
  '--color-surface-lighter': '#1E1B18',
  '--color-surface-deep': '#060504',
  '--color-on-surface': '#F5E6C8',
  '--color-on-surface-muted': '#9A8E84',
  '--color-score': '#F5E6C8',
  '--color-error': '#DC2626',
  '--color-success': '#4ECDC4',
  '--color-warning': '#E8A820',
  '--color-info': '#5B9BD5',
  '--color-primary-glow': 'rgba(212, 168, 83, 0.15)',
  '--color-accent-glow': 'rgba(255, 194, 52, 0.15)',
  '--color-score-glow': 'rgba(245, 230, 200, 0.2)',
  '--color-border': 'rgba(212, 168, 83, 0.08)',
  '--color-glass-surface': 'rgba(212, 168, 83, 0.02)',
  '--color-glass-border': 'rgba(212, 168, 83, 0.08)',
  '--color-glass-border-hover': 'rgba(212, 168, 83, 0.15)',
  '--color-court-line': 'rgba(212, 168, 83, 0.15)',
  '--color-court-line-strong': 'rgba(212, 168, 83, 0.25)',
  '--color-surface-overlay': 'rgba(10, 9, 8, 0.88)',
};

const CVG_OUTDOOR: Record<string, string> = {
  '--color-primary': '#7A5C10',
  '--color-primary-dark': '#5C4408',
  '--color-accent': '#7A5C10',
  '--color-surface': '#FFFFFF',
  '--color-surface-light': '#F5F0E8',
  '--color-surface-lighter': '#EDE5D8',
  '--color-surface-deep': '#FAF8F4',
  '--color-on-surface': '#0f172a',
  '--color-on-surface-muted': '#5C5347',
  '--color-score': '#5C4A0E',
  '--color-error': '#DC2626',
  '--color-success': '#0D7377',
  '--color-warning': '#92610A',
  '--color-info': '#1E5FA6',
  '--color-primary-glow': 'rgba(122, 92, 16, 0.1)',
  '--color-accent-glow': 'rgba(139, 105, 20, 0.1)',
  '--color-score-glow': 'rgba(92, 74, 14, 0.15)',
  '--color-border': 'rgba(0, 0, 0, 0.08)',
  '--color-glass-surface': 'rgba(255, 255, 255, 0.95)',
  '--color-glass-border': 'rgba(0, 0, 0, 0.12)',
  '--color-glass-border-hover': 'rgba(0, 0, 0, 0.2)',
  '--color-court-line': 'rgba(122, 92, 16, 0.2)',
  '--color-court-line-strong': 'rgba(122, 92, 16, 0.35)',
  '--color-surface-overlay': 'rgba(245, 240, 232, 0.92)',
};

const EMBER_COLORS: Record<string, string> = {
  '--color-primary': '#E85D26',
  '--color-primary-dark': '#C44A1A',
  '--color-accent': '#FF9142',
  '--color-surface': '#080605',
  '--color-surface-light': '#121010',
  '--color-surface-lighter': '#1C1816',
  '--color-surface-deep': '#050403',
  '--color-on-surface': '#F0EDE8',
  '--color-on-surface-muted': '#9A8E84',
  '--color-score': '#F0EDE8',
  '--color-error': '#DC2626',
  '--color-success': '#2DA8A8',
  '--color-warning': '#E8A820',
  '--color-info': '#5B9BD5',
  '--color-primary-glow': 'rgba(232, 93, 38, 0.15)',
  '--color-accent-glow': 'rgba(255, 145, 66, 0.15)',
  '--color-score-glow': 'rgba(240, 237, 232, 0.2)',
  '--color-border': 'rgba(232, 93, 38, 0.08)',
  '--color-glass-surface': 'rgba(232, 93, 38, 0.02)',
  '--color-glass-border': 'rgba(232, 93, 38, 0.1)',
  '--color-glass-border-hover': 'rgba(232, 93, 38, 0.2)',
  '--color-court-line': 'rgba(232, 93, 38, 0.15)',
  '--color-court-line-strong': 'rgba(232, 93, 38, 0.25)',
  '--color-surface-overlay': 'rgba(8, 6, 5, 0.88)',
};

const EMBER_OUTDOOR: Record<string, string> = {
  '--color-primary': '#A13D10',
  '--color-primary-dark': '#7A2E0C',
  '--color-accent': '#A13D10',
  '--color-surface': '#FFFFFF',
  '--color-surface-light': '#F5F0EC',
  '--color-surface-lighter': '#EDE5DE',
  '--color-surface-deep': '#FAF8F6',
  '--color-on-surface': '#0f172a',
  '--color-on-surface-muted': '#5C5347',
  '--color-score': '#7A2E0C',
  '--color-error': '#DC2626',
  '--color-success': '#0D7377',
  '--color-warning': '#92610A',
  '--color-info': '#1E5FA6',
  '--color-primary-glow': 'rgba(161, 61, 16, 0.1)',
  '--color-accent-glow': 'rgba(161, 61, 16, 0.1)',
  '--color-score-glow': 'rgba(122, 46, 12, 0.15)',
  '--color-border': 'rgba(0, 0, 0, 0.08)',
  '--color-glass-surface': 'rgba(255, 255, 255, 0.95)',
  '--color-glass-border': 'rgba(0, 0, 0, 0.12)',
  '--color-glass-border-hover': 'rgba(0, 0, 0, 0.2)',
  '--color-court-line': 'rgba(161, 61, 16, 0.2)',
  '--color-court-line-strong': 'rgba(161, 61, 16, 0.35)',
  '--color-surface-overlay': 'rgba(245, 240, 236, 0.92)',
};

export const THEMES: Record<Theme, ThemeConfig> = {
  'court-vision-gold': {
    name: 'court-vision-gold',
    label: 'Court Vision Gold',
    description: 'Warm luxury with pickleball identity',
    colors: CVG_COLORS,
    outdoorColors: CVG_OUTDOOR,
    teamDefaults: { team1: '#4ECDC4', team2: '#E8725A' },
  },
  'classic': {
    name: 'classic',
    label: 'Classic',
    description: 'The original PickleScore look',
    colors: CLASSIC_COLORS,
    outdoorColors: CLASSIC_OUTDOOR,
    teamDefaults: { team1: '#22c55e', team2: '#f97316' },
  },
  'ember': {
    name: 'ember',
    label: 'Ember',
    description: 'Volcanic energy, smoldering intensity',
    colors: EMBER_COLORS,
    outdoorColors: EMBER_OUTDOOR,
    teamDefaults: { team1: '#E85D26', team2: '#2DA8A8' },
  },
};
```

**Step 4 — Verify test passes:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/shared/constants/__tests__/themes.test.ts
```

Expected: all 9 tests pass.

**Step 5 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 6 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/constants/themes.ts src/shared/constants/__tests__/themes.test.ts && git commit -m "feat(theme): create themes.ts with Classic, Court Vision Gold, Ember configs"
```

---

### Task 3: Create hexToRgb shared utility

**Files to create:**
- `src/shared/utils/colorUtils.ts`
- `src/shared/utils/__tests__/colorUtils.test.ts` (new)

**Step 1 — Write failing test:**

Create `src/shared/utils/__tests__/colorUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hexToRgb } from '../colorUtils';

describe('hexToRgb', () => {
  it('converts 6-char hex with #', () => {
    expect(hexToRgb('#4ECDC4')).toBe('78, 205, 196');
  });

  it('converts 6-char hex without #', () => {
    expect(hexToRgb('E8725A')).toBe('232, 114, 90');
  });

  it('converts 3-char hex with #', () => {
    expect(hexToRgb('#fff')).toBe('255, 255, 255');
  });

  it('converts 3-char hex without #', () => {
    expect(hexToRgb('000')).toBe('0, 0, 0');
  });

  it('handles uppercase', () => {
    expect(hexToRgb('#AABBCC')).toBe('170, 187, 204');
  });

  it('handles lowercase', () => {
    expect(hexToRgb('#aabbcc')).toBe('170, 187, 204');
  });

  it('returns 0, 0, 0 for invalid input', () => {
    expect(hexToRgb('')).toBe('0, 0, 0');
    expect(hexToRgb('xyz')).toBe('0, 0, 0');
    expect(hexToRgb('#gggggg')).toBe('0, 0, 0');
  });
});
```

**Step 2 — Verify test fails:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/shared/utils/__tests__/colorUtils.test.ts
```

Expected: fails because `colorUtils.ts` does not exist.

**Step 3 — Implement:**

Create `src/shared/utils/colorUtils.ts`:

```typescript
/**
 * Convert a hex color string to comma-separated RGB values.
 * Supports 3-char and 6-char hex, with or without leading #.
 * Returns '0, 0, 0' for invalid input.
 */
export function hexToRgb(hex: string): string {
  // Strip leading #
  let clean = hex.startsWith('#') ? hex.slice(1) : hex;

  // Expand 3-char shorthand to 6-char
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }

  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '0, 0, 0';
  }

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
```

**Step 4 — Verify test passes:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/shared/utils/__tests__/colorUtils.test.ts
```

Expected: all 7 tests pass.

**Step 5 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 6 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/utils/colorUtils.ts src/shared/utils/__tests__/colorUtils.test.ts && git commit -m "feat(theme): add hexToRgb shared utility with 3/6-char hex support"
```

---

### Task 4: Create useTheme.ts hook

**Files to create:**
- `src/shared/hooks/useTheme.ts`
- `src/shared/hooks/__tests__/useTheme.test.ts` (new)

**Step 1 — Write failing test:**

Create `src/shared/hooks/__tests__/useTheme.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';

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

    createRoot((dispose) => {
      useTheme();
      const style = document.documentElement.style;

      // Default is CVG
      expect(style.getPropertyValue('--color-primary')).toBe('#D4A853');

      // Switch to classic
      setSettings({ theme: 'classic' });
      expect(style.getPropertyValue('--color-primary')).toBe('#22c55e');

      // Switch to ember
      setSettings({ theme: 'ember' });
      expect(style.getPropertyValue('--color-primary')).toBe('#E85D26');

      dispose();
    });
  });
});
```

**Step 2 — Verify test fails:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/shared/hooks/__tests__/useTheme.test.ts
```

Expected: fails because `useTheme.ts` does not exist.

**Step 3 — Implement:**

Create `src/shared/hooks/useTheme.ts`:

```typescript
import { createEffect } from 'solid-js';
import { settings } from '../../stores/settingsStore';
import { THEMES } from '../constants/themes';

/** Track which CSS custom properties we've set so we can clean them up on switch */
const appliedKeys = new Set<string>();

export function useTheme(): void {
  createEffect(() => {
    const theme = THEMES[settings().theme];
    if (!theme) return;
    const isOutdoor = settings().displayMode === 'outdoor';
    const colors = isOutdoor ? theme.outdoorColors : theme.colors;

    const root = document.documentElement;

    // Remove previously applied properties to prevent stale values
    for (const key of appliedKeys) {
      root.style.removeProperty(key);
    }
    appliedKeys.clear();

    // Apply new theme properties
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(key, value);
      appliedKeys.add(key);
    }

    // Update theme-color meta tag reactively
    const surfaceColor = colors['--color-surface'] ?? '#0A0908';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', surfaceColor);
    }
  });
}
```

**Step 4 — Verify test passes:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/shared/hooks/__tests__/useTheme.test.ts
```

Expected: all 4 tests pass.

**Step 5 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 6 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/hooks/useTheme.ts src/shared/hooks/__tests__/useTheme.test.ts && git commit -m "feat(theme): create useTheme hook with tracked key cleanup and theme-color meta"
```

---

### Task 5: Wire useTheme into App.tsx

**Files to modify:**
- `src/app/App.tsx`

**Step 1 — No separate test needed** (integration verified in Task 8). The existing test suite must still pass.

**Step 2 — Implement:**

Edit `src/app/App.tsx`. Add the import near the top:

```typescript
import { useTheme } from '../shared/hooks/useTheme';
```

Then inside the `App` component function, add `useTheme()` call right before the existing `createEffect` for display mode. The existing outdoor class toggle effect stays -- `useTheme` handles CSS variables while the existing effect handles the `.outdoor` class. Remove the `meta.setAttribute('content', ...)` line from the existing display mode effect since `useTheme` now handles theme-color reactively.

The full component body becomes:

```typescript
const App: Component<Props> = (props) => {
  const location = useLocation();
  const showBottomNav = () => location.pathname !== '/';

  // Apply theme CSS variables + theme-color meta
  useTheme();

  createEffect(() => {
    const mode = settings().displayMode;
    document.documentElement.classList.toggle('outdoor', mode === 'outdoor');
  });

  // ... rest unchanged
```

**Step 3 — Run full test suite:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

Expected: all tests pass.

**Step 4 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 5 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/app/App.tsx && git commit -m "feat(theme): wire useTheme into App.tsx for reactive theme switching"
```

---

### Task 6: Add new @theme tokens to styles.css

**Files to modify:**
- `src/styles.css`

**Step 1 — No unit test** (CSS-only change; verified visually and by build).

**Step 2 — Implement:**

In `src/styles.css`, add the 6 new tokens to the `@theme` block (these are Classic defaults since the @theme block serves as the flash-prevention fallback):

```css
@theme {
  --color-primary: #22c55e;
  --color-primary-dark: #16a34a;
  --color-accent: #f97316;
  --color-surface: #0f1118;
  --color-surface-light: #1a1d2e;
  --color-surface-lighter: #252a3a;
  --color-on-surface: #f1f5f9;
  --color-on-surface-muted: #a0aec0;
  --color-score: #facc15;
  --color-error: #dc2626;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-info: #3b82f6;
  --color-surface-deep: #080a10;
  --color-primary-glow: rgba(34, 197, 94, 0.15);
  --color-accent-glow: rgba(249, 115, 22, 0.15);
  --color-score-glow: rgba(250, 204, 21, 0.2);
  --color-border: rgba(255, 255, 255, 0.08);
  --font-score: 'Oswald', system-ui, sans-serif;
  /* Glass + court-line tokens (Classic defaults) */
  --color-glass-surface: rgba(34, 197, 94, 0.02);
  --color-glass-border: rgba(34, 197, 94, 0.08);
  --color-glass-border-hover: rgba(34, 197, 94, 0.15);
  --color-court-line: rgba(34, 197, 94, 0.15);
  --color-court-line-strong: rgba(34, 197, 94, 0.25);
  /* Surface overlay for non-glass cards/dialogs/controls */
  --color-surface-overlay: rgba(15, 17, 24, 0.88);
}
```

**Step 3 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

Expected: build succeeds.

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "feat(theme): add glass, court-line, surface-overlay CSS tokens to @theme block"
```

---

### Task 7: Download and add Oswald font files, add @font-face declarations

**Files to modify:**
- `src/styles.css`

**Files to create:**
- `public/fonts/Oswald-Light.woff2`
- `public/fonts/Oswald-Regular.woff2`
- `public/fonts/Oswald-Medium.woff2`

**Step 1 — Install @fontsource/oswald and copy woff2 files:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp
npm install @fontsource/oswald
cp node_modules/@fontsource/oswald/files/oswald-latin-300-normal.woff2 public/fonts/Oswald-Light.woff2
cp node_modules/@fontsource/oswald/files/oswald-latin-400-normal.woff2 public/fonts/Oswald-Regular.woff2
cp node_modules/@fontsource/oswald/files/oswald-latin-500-normal.woff2 public/fonts/Oswald-Medium.woff2
```

> **Note:** The exact filenames inside `node_modules/@fontsource/oswald/files/` may vary slightly. List the directory first (`ls node_modules/@fontsource/oswald/files/`) and find the latin-only woff2 files for weights 300, 400, 500. If the naming convention differs, adjust the `cp` commands accordingly.

**Step 2 — Add @font-face declarations:**

In `src/styles.css`, add these BEFORE the `@import "tailwindcss"` line, right after the existing Oswald Bold @font-face:

```css
@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/Oswald-Bold.woff2') format('woff2');
}

@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url('/fonts/Oswald-Light.woff2') format('woff2');
}

@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/Oswald-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/Oswald-Medium.woff2') format('woff2');
}
```

**Step 3 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

Expected: build succeeds.

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add public/fonts/ src/styles.css && git commit -m "feat(theme): add Oswald Light/Regular/Medium font files via @fontsource"
```

---

### Task 8: Verify theme switching works end-to-end

**Step 1 — Run full test suite:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

Expected: all tests pass.

**Step 2 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 3 — Build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 4 — Manual verification (dev server):**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite --port 5199
```

Open browser to `http://localhost:5199`. In browser console, run:

```javascript
// Verify CVG theme is applied by default
getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
// Should return '#D4A853'

// Switch to classic
const store = await import('/src/stores/settingsStore.ts');
store.setSettings({ theme: 'classic' });
getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
// Should return '#22c55e'

// Switch to ember
store.setSettings({ theme: 'ember' });
getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
// Should return '#E85D26'

// Verify theme-color meta tag updates
document.querySelector('meta[name="theme-color"]').getAttribute('content')
// Should return the active theme's --color-surface value

// Switch back to CVG
store.setSettings({ theme: 'court-vision-gold' });
```

No commit needed for this task -- verification only.

---

## Wave 2: CSS Infrastructure (Shared Utilities)

### Task 9: Add court-line utilities to styles.css

**Files to modify:**
- `src/styles.css`

**Step 1 — Implement:**

Add inside `src/styles.css`, AFTER the page-transition classes and BEFORE the outdoor section. Insert this `@layer components` block:

```css
/* Court-line motif system */
@layer components {
  /* Horizontal court line (section dividers) */
  .court-line {
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--color-court-line-strong) 20%, var(--color-court-line-strong) 80%, transparent);
  }

  /* Net divider (between score panels) */
  .net-line {
    width: 1px;
    background: linear-gradient(180deg, transparent, var(--color-court-line) 30%, var(--color-court-line) 70%, transparent);
  }

  /* Diamond center point */
  .net-diamond {
    width: 10px;
    height: 10px;
    transform: rotate(45deg);
    border: 1.5px solid var(--color-court-line-strong);
    background: var(--color-court-line);
  }
}
```

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "feat(theme): add court-line, net-line, net-diamond CSS utilities"
```

---

### Task 10: Add glass-panel and score-panel CSS classes

**Files to modify:**
- `src/styles.css`

**Step 1 — Implement:**

Add inside the `@layer components` block from Task 9:

```css
@layer components {
  /* ... existing court-line classes ... */

  /* Glass panel -- top bar, bottom nav, score panels */
  .glass-panel {
    background: var(--color-glass-surface);
    border: 1px solid var(--color-glass-border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  /* Score panel -- wraps each team's score area */
  .score-panel {
    background: var(--color-glass-surface);
    border: 1px solid var(--color-glass-border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: border-color 0.4s ease, box-shadow 0.4s ease;
  }

  .score-panel.serving {
    border-color: var(--team-color);
    box-shadow: 0 0 15px rgba(var(--team-color-rgb), 0.3);
  }

  .score-panel.game-point {
    border-color: var(--color-accent);
    box-shadow: 0 0 20px var(--color-accent-glow);
  }

  /* Court corner brackets on score panels */
  .score-panel-brackets {
    position: relative;
  }

  .score-panel-brackets::before,
  .score-panel-brackets::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: rgba(var(--team-color-rgb), 0.2);
    border-style: solid;
    pointer-events: none;
  }

  .score-panel-brackets::before {
    top: 6px;
    left: 6px;
    border-width: 2px 0 0 2px;
  }

  .score-panel-brackets::after {
    bottom: 6px;
    right: 6px;
    border-width: 0 2px 2px 0;
  }
}
```

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "feat(theme): add glass-panel, score-panel, and corner bracket CSS classes"
```

---

### Task 11: Update focus indicator styles (dual-ring)

**Files to modify:**
- `src/styles.css`

**Step 1 — Implement:**

Replace the existing focus styles:

```css
/* OLD */
button:focus-visible,
a:focus-visible,
select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

With:

```css
/* Dual-ring focus: white inner outline + primary outer */
button:focus-visible,
a:focus-visible,
select:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
  box-shadow: 0 0 0 5px var(--color-primary);
}

/* Input focus -- uses --color-primary-glow */
input:focus-visible,
textarea:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow), 0 0 15px var(--color-primary-glow);
}
```

(The input focus styles are the same as current -- just ensure the dual-ring is added to button/a/select.)

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "feat(theme): update focus indicators to dual-ring (white inner + primary outer)"
```

---

### Task 12: Update hardcoded colors in styles.css

**Files to modify:**
- `src/styles.css`

**Step 1 — Implement:**

Replace each hardcoded color value. Use `var()` references where possible so they auto-adapt per theme:

1. **hover-glow-primary** -- replace `rgba(34, 197, 94, 0.3)` with CSS variable reference:

```css
@media (hover: hover) and (pointer: fine) {
  .hover-glow-primary:hover {
    box-shadow: 0 0 20px var(--color-primary-glow);
  }
  .hover-glow-accent:hover {
    box-shadow: 0 0 20px var(--color-accent-glow);
  }
  .hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  }
}
```

2. **text-gradient** -- replace green/yellow/orange with gold palette:

```css
.text-gradient {
  background: linear-gradient(135deg, var(--color-primary), var(--color-on-surface), var(--color-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

3. **text-gradient-subtle** -- replace green gradient:

```css
.text-gradient-subtle {
  background: linear-gradient(135deg, var(--color-primary), var(--color-on-surface));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

4. **gradient-shimmer / text-gradient-animated** -- update to use variables:

```css
.text-gradient-animated {
  background: linear-gradient(135deg, var(--color-primary), var(--color-on-surface), var(--color-accent), var(--color-primary));
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shimmer 4s ease infinite;
}
```

5. **cta-glow-pulse** -- update to use variables:

```css
@keyframes cta-glow-pulse {
  0%, 100% { box-shadow: 0 0 15px var(--color-primary-glow), 0 0 30px rgba(0, 0, 0, 0.1); }
  50% { box-shadow: 0 0 25px var(--color-primary-glow), 0 0 50px rgba(0, 0, 0, 0.15); }
}
```

6. **steps-connector line** -- update to use variable:

```css
.steps-connector line {
  stroke: var(--color-court-line-strong);
  stroke-width: 2;
}
```

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "feat(theme): replace hardcoded green/orange colors with CSS variable references"
```

---

### Task 13: Add noise texture, performance classes, and ambient cross-fade CSS

**Files to modify:**
- `src/styles.css`

**Step 1 — Implement noise texture update:**

Update the `body::after` noise texture block. Add `background-size` and `background-repeat`:

```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 256px 256px;
  background-repeat: repeat;
}
```

**Step 2 — Add performance classes:**

Add at the end of the file (before the stagger-in reduced-motion block):

```css
/* Performance: layer promotion for continuous animations */
.game-point-pulse,
.live-pulse {
  will-change: opacity;
  contain: layout style;
}
```

**Step 3 — Add ambient cross-fade CSS:**

Add after the `@layer components` block:

```css
/* Ambient background cross-fade for scoring page */
.ambient-bg {
  position: relative;
}

.ambient-bg::before,
.ambient-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  transition: opacity 1.2s ease;
  will-change: opacity;
  pointer-events: none;
}

.ambient-bg::before {
  background: radial-gradient(ellipse at 30% 20%, rgba(var(--team1-color-rgb, 78, 205, 196), 0.06) 0%, transparent 70%);
}

.ambient-bg::after {
  background: radial-gradient(ellipse at 70% 20%, rgba(var(--team2-color-rgb, 232, 114, 90), 0.06) 0%, transparent 70%);
  opacity: 0;
}

.ambient-bg.serving-team-1::before { opacity: 1; }
.ambient-bg.serving-team-1::after { opacity: 0; }
.ambient-bg.serving-team-2::before { opacity: 0; }
.ambient-bg.serving-team-2::after { opacity: 1; }
```

**Step 4 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 5 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "feat(theme): add noise texture sizing, performance classes, ambient cross-fade CSS"
```

---

### Task 14: Update animation keyframes

**Files to modify:**
- `src/styles.css`

**Step 1 — Implement:**

1. **Remove `nav-pill-in`** keyframe (the entire `@keyframes nav-pill-in` block).

2. **Add `scoreUp`** keyframe:

```css
@keyframes scoreUp {
  0% { transform: scale(1); }
  30% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
```

3. **Add `scanLine`** keyframe (for landing hero):

```css
@keyframes scanLine {
  0% { transform: translateY(-100%); opacity: 0; }
  5% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(calc(var(--scan-container-height, 400px))); opacity: 0; }
}
```

4. **Add `gamePointPulse`** keyframe:

```css
@keyframes gamePointPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

Note: `gradient-shimmer` stays as-is (the colors are now variable-based from Task 12). `cta-glow-pulse` was already updated in Task 12.

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "feat(theme): remove nav-pill-in, add scoreUp, scanLine, gamePointPulse keyframes"
```

---

### Task 15: Add prefers-reduced-motion audit

**Files to modify:**
- `src/styles.css`

**Step 1 — Implement:**

Update the existing `@media (prefers-reduced-motion: reduce)` block to cover ALL new animations. Find the existing reduced-motion block and expand it:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all continuous and decorative animations */
  .game-point-pulse,
  .live-pulse {
    animation: none !important;
  }

  /* Disable scoreUp bump */
  .score-bump {
    animation: none !important;
  }

  /* Disable scan line on hero */
  .scan-line {
    animation: none !important;
    opacity: 0 !important;
  }

  /* Disable ambient cross-fade transitions */
  .ambient-bg::before,
  .ambient-bg::after {
    transition: none !important;
  }

  /* Disable score-flash */
  .score-flash {
    animation: none !important;
  }

  /* Keep Game Point label visible at 14px minimum without animation */
  .game-point-pulse {
    opacity: 1 !important;
    font-size: 14px;
  }

  /* Disable stagger-in and fade-in */
  .stagger-in > * {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }

  /* Disable gradient shimmer */
  .text-gradient-animated {
    animation: none !important;
  }

  /* Disable CTA glow pulse */
  .cta-glow-active {
    animation: none !important;
  }
}
```

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "a11y(theme): expand prefers-reduced-motion to cover all new animations"
```

---

### Task 16: Update outdoor mode with complete token overrides + disable glass

**Files to modify:**
- `src/styles.css`

**Step 1 — Implement:**

Replace the entire `html.outdoor { ... }` block with the expanded version. Note: the useTheme hook applies outdoor colors per-theme, so the CSS `html.outdoor` block is a fallback for the Classic theme (since Classic values are the @theme defaults). We still need it for structural overrides (disable glass):

```css
/* Outdoor/High-Contrast Mode -- structural overrides */
html.outdoor .glass-panel,
html.outdoor .score-panel {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

html.outdoor .skeleton {
  background: linear-gradient(90deg, var(--color-surface-light) 25%, var(--color-surface-lighter) 50%, var(--color-surface-light) 75%);
}

html.outdoor .text-7xl {
  font-size: 5.5rem;
}
```

Remove the old `html.outdoor { }` block that set individual CSS variables (since `useTheme` now handles that per-theme).

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/styles.css && git commit -m "feat(theme): update outdoor mode to disable glass and let useTheme handle colors"
```

---

## Wave 3: P0 Component Updates (Core Screens)

### Task 17: Update teamColors.ts defaults

**Files to modify:**
- `src/shared/constants/teamColors.ts`

**Step 1 — No separate test needed** (existing test suite + manual verification). Note: the `TEAM_COLORS` swatch array only contains colors with at least 3:1 contrast against both dark (`#0A0908`) and light (`#FFFFFF`) surfaces. The existing ColorPicker component imports from this file and will auto-update -- no changes needed to ColorPicker.tsx itself.

**Step 2 — Implement:**

Replace the entire file contents:

```typescript
export interface TeamColor {
  name: string;
  hex: string;
}

export const TEAM_COLORS: TeamColor[] = [
  { name: 'Teal', hex: '#4ECDC4' },
  { name: 'Terracotta', hex: '#E8725A' },
  { name: 'Gold', hex: '#D4A853' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Red', hex: '#ef4444' },
];

export const DEFAULT_TEAM1_COLOR = '#4ECDC4';
export const DEFAULT_TEAM2_COLOR = '#E8725A';
```

**Step 3 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 4 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 5 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/constants/teamColors.ts && git commit -m "feat(theme): update default team colors to teal/terracotta, expand swatch palette"
```

---

### Task 18: Update Logo.tsx

**Files to modify:**
- `src/shared/components/Logo.tsx`

**Step 1 — Implement:**

Change "PICKLE" from `text-primary` to `text-on-surface` and "SCORE" stays `text-primary` (gold in CVG):

In the Logo component, change:

```tsx
<span class="text-primary">Pickle</span>
<span class="text-score">Score</span>
```

To:

```tsx
<span class="text-on-surface">Pickle</span>
<span class="text-primary">Score</span>
```

This makes "PICKLE" champagne-colored (`--color-on-surface`) and "SCORE" gold (`--color-primary`).

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/components/Logo.tsx && git commit -m "feat(theme): update Logo to PICKLE champagne + SCORE gold"
```

---

### Task 19: Update TopNav.tsx (glass treatment)

**Files to modify:**
- `src/shared/components/TopNav.tsx`

**Step 1 — Implement:**

Change the header class for the non-landing variant from solid `bg-surface-light` to glass:

Replace:

```tsx
class={`px-4 py-2.5 ${isLanding() ? '' : 'bg-surface-light border-b border-surface-lighter'}`}
```

With:

```tsx
class={`px-4 py-2.5 ${isLanding() ? '' : 'glass-panel border-b border-glass-border'}`}
```

Also update the dropdown menu class from `bg-surface-light` to solid semi-transparent using the surface-overlay token:

Replace the dropdown `div` class:

```tsx
class="absolute right-0 top-full mt-2 w-56 bg-surface-light rounded-xl shadow-lg border border-surface-lighter z-50 overflow-hidden"
```

With:

```tsx
class="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg border border-glass-border z-50 overflow-hidden" style={{ background: 'var(--color-surface-overlay)' }}
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/components/TopNav.tsx && git commit -m "feat(theme): add glass treatment to TopNav header and dropdown"
```

---

### Task 20: Update BottomNav.tsx (floating glass dock, court-line indicator)

**Files to modify:**
- `src/shared/components/BottomNav.tsx`

**Step 1 — Implement:**

1. Change the nav container from solid to floating glass dock:

Replace:

```tsx
<nav aria-label="Main navigation" class="fixed bottom-0 left-0 right-0 bg-surface-light border-t border-surface-lighter safe-bottom">
  <div class="max-w-lg mx-auto md:max-w-3xl flex justify-around py-1">
```

With:

```tsx
<nav aria-label="Main navigation" class="fixed bottom-0 left-0 right-0 safe-bottom px-4 pb-2">
  <div class="max-w-lg mx-auto md:max-w-3xl flex justify-around py-1 glass-panel rounded-2xl" style={{ "backdrop-filter": "blur(30px)", "-webkit-backdrop-filter": "blur(30px)" }}>
```

2. Replace all pill indicator elements. In every `<A>` link, replace the `<Show when={isActive(...)}>` block that renders the pill:

Replace each instance of:

```tsx
<Show when={isActive('/new')}>
  <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
</Show>
```

With a court-line bar indicator:

```tsx
<Show when={isActive('/new')}>
  <div class="absolute bottom-0 left-2 right-2 court-line" aria-hidden="true" />
</Show>
```

Do this for ALL 5 nav items (`/new`, `/history`, `/players`, `/tournaments`, `/buddies`).

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/components/BottomNav.tsx && git commit -m "feat(theme): update BottomNav to floating glass dock with court-line indicator"
```

---

### Task 21a: Update Scoreboard.tsx — CSS custom property bridge

**Files to modify:**
- `src/features/scoring/components/Scoreboard.tsx`

**Step 1 — Implement:**

Add the import for `hexToRgb` at the top:

```typescript
import { hexToRgb } from '../../../shared/utils/colorUtils';
```

Replace the inline style objects on both team panels to use CSS custom properties instead of direct background/border/box-shadow values.

**TypeScript note:** SolidJS's `JSX.CSSProperties` type does not include custom CSS properties by default. Use a type assertion to set `--team-color` and `--team-color-rgb`:

For team 1 panel, replace the entire `style` and `classList`:

```tsx
<div
  ref={team1PanelRef}
  class="score-panel score-panel-brackets flex flex-col items-center py-6 rounded-2xl"
  classList={{
    'serving': isServing(1),
    'game-point': team1GamePoint() && !isServing(1),
  }}
  style={{
    "touch-action": "pan-y",
    "--team-color": t1Color(),
    "--team-color-rgb": hexToRgb(t1Color()),
  } as import('solid-js').JSX.CSSProperties}
  aria-label={`${props.team1Name}: ${props.team1Score}${isServing(1) ? ', serving' : ''}`}
>
```

For team 2 panel:

```tsx
<div
  ref={team2PanelRef}
  class="score-panel score-panel-brackets flex flex-col items-center py-6 rounded-2xl"
  classList={{
    'serving': isServing(2),
    'game-point': team2GamePoint() && !isServing(2),
  }}
  style={{
    "touch-action": "pan-y",
    "--team-color": t2Color(),
    "--team-color-rgb": hexToRgb(t2Color()),
  } as import('solid-js').JSX.CSSProperties}
  aria-label={`${props.team2Name}: ${props.team2Score}${isServing(2) ? ', serving' : ''}`}
>
```

Remove the old conditional inline style blocks (the `...(isServing(1) ? { "background-color": ... } : ...)` ternaries) and the `classList` `bg-surface-light` entry. The `score-panel` CSS class + `serving` / `game-point` classList handles all visual states now.

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/components/Scoreboard.tsx && git commit -m "feat(theme): replace Scoreboard inline styles with CSS custom property bridge"
```

---

### Task 21b: Update Scoreboard.tsx — Net divider + grid layout change

**Files to modify:**
- `src/features/scoring/components/Scoreboard.tsx`

**Step 1 — Implement:**

Change the scoreboard grid from `grid-cols-2 gap-4` to `grid-cols-[1fr_auto_1fr] gap-0` to accommodate the net divider.

Replace:

```tsx
<div class="grid grid-cols-2 gap-4 px-4" role="region" aria-label="Scoreboard">
```

With:

```tsx
<div class="grid grid-cols-[1fr_auto_1fr] gap-0 px-4" role="region" aria-label="Scoreboard">
```

Add the net divider element between the two team panels:

```tsx
{/* Net divider */}
<div class="flex flex-col items-center justify-center py-4" aria-hidden="true">
  <div class="net-line flex-1" />
  <div class="net-diamond my-1" />
  <div class="net-line flex-1" />
</div>
```

This goes after the Team 1 `</div>` closing tag and before the Team 2 opening `<div>`.

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/components/Scoreboard.tsx && git commit -m "feat(theme): add net divider element and 3-column grid layout to Scoreboard"
```

---

### Task 21c: Update Scoreboard.tsx — Corner brackets + game point label fix

**Files to modify:**
- `src/features/scoring/components/Scoreboard.tsx`

**Step 1 — Implement:**

1. The `score-panel-brackets` class was already added in Task 21a. Verify it is present on both team panel divs.

2. Update the team name spans with Oswald font:

```tsx
<span
  class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2 uppercase tracking-wider"
  style={{ "font-family": "var(--font-score)", "font-weight": "400" }}
>
  {props.team1Name}
</span>
```

(Same for team 2.)

3. Update serving badge to pill style:

```tsx
<Show when={isServing(1)}>
  <span
    class="mt-2 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
    style={{ color: t1Color(), "border-color": t1Color() }}
  >
    {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
  </span>
</Show>
```

(Same pattern for team 2.)

4. Fix Game Point label: bump from `text-xs` (12px) to `text-sm` (14px) per accessibility requirement, add `game-point-pulse` class:

```tsx
<Show when={team1GamePoint()}>
  <span
    class="mt-1 text-sm font-bold uppercase tracking-wider game-point-pulse"
    style={{ color: t1Color(), "animation": "gamePointPulse 1.5s ease-in-out infinite" }}
  >
    Game Point
  </span>
</Show>
```

(Same for team 2.)

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/components/Scoreboard.tsx && git commit -m "feat(theme): add corner brackets, Oswald team names, 14px Game Point label"
```

---

### Task 22: Scoreboard states component test

**Files to create:**
- `src/features/scoring/components/__tests__/Scoreboard.theme.test.tsx` (new)

**Step 1 — Write test:**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import Scoreboard from '../Scoreboard';

describe('Scoreboard theme states', () => {
  const baseProps = {
    team1Name: 'Team A',
    team2Name: 'Team B',
    team1Score: 5,
    team2Score: 3,
    servingTeam: 1 as const,
    serverNumber: 1 as const,
    scoringMode: 'sideout' as const,
    gameType: 'doubles' as const,
    pointsToWin: 11,
    team1Color: '#4ECDC4',
    team2Color: '#E8725A',
  };

  it('applies .serving class on the serving team panel', () => {
    const { container } = render(() => <Scoreboard {...baseProps} servingTeam={1} />);
    const panels = container.querySelectorAll('.score-panel');
    expect(panels[0].classList.contains('serving')).toBe(true);
    expect(panels[1].classList.contains('serving')).toBe(false);
  });

  it('applies .game-point class when team is at game point', () => {
    const { container } = render(() => (
      <Scoreboard {...baseProps} team1Score={10} team2Score={5} servingTeam={2} />
    ));
    const panels = container.querySelectorAll('.score-panel');
    // Team 1 has 10 (game point at 11), and is NOT serving, so gets .game-point
    expect(panels[0].classList.contains('game-point')).toBe(true);
  });

  it('renders net divider with aria-hidden', () => {
    const { container } = render(() => <Scoreboard {...baseProps} />);
    const netDivider = container.querySelector('.net-diamond');
    expect(netDivider).toBeTruthy();
    const wrapper = netDivider!.parentElement;
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
  });
});
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/features/scoring/components/__tests__/Scoreboard.theme.test.tsx
```

Expected: all 3 tests pass.

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/components/__tests__/Scoreboard.theme.test.tsx && git commit -m "test(theme): add Scoreboard theme state tests (serving, game-point, net divider)"
```

---

### Task 23: Update ScoreControls.tsx (button styling)

**Files to modify:**
- `src/features/scoring/components/ScoreControls.tsx`

**Step 1 — Implement:**

Update button classes to use Oswald font and uppercase styling. Replace the score buttons' class strings:

For team 1 button, replace:

```tsx
class={`font-bold text-lg py-6 rounded-2xl transition-transform truncate px-3 ${
  team1Active() ? 'bg-primary text-surface active:scale-95' : 'bg-primary/30 text-surface/50 cursor-not-allowed'
}`}
```

With:

```tsx
class={`font-bold text-lg py-6 rounded-2xl truncate px-3 uppercase tracking-wider ${
  team1Active() ? 'bg-primary text-surface active:scale-95' : 'bg-primary/30 text-surface/50 cursor-not-allowed'
}`}
style={{ "font-family": "var(--font-score)", "font-weight": "400", "transition": "transform 0.15s ease" }}
```

For team 2 button, replace:

```tsx
class={`font-bold text-lg py-6 rounded-2xl transition-transform truncate px-3 ${
  team2Active() ? 'bg-accent text-surface active:scale-95' : 'bg-accent/30 text-surface/50 cursor-not-allowed'
}`}
```

With:

```tsx
class={`font-bold text-lg py-6 rounded-2xl truncate px-3 uppercase tracking-wider ${
  team2Active() ? 'bg-accent text-surface active:scale-95' : 'bg-accent/30 text-surface/50 cursor-not-allowed'
}`}
style={{ "font-family": "var(--font-score)", "font-weight": "400", "transition": "transform 0.15s ease" }}
```

For the Side Out button, update:

```tsx
class="w-full bg-surface-lighter text-on-surface font-semibold text-base py-6 rounded-2xl active:scale-95 transition-transform"
```

To:

```tsx
class="w-full text-on-surface font-semibold text-base py-6 rounded-2xl active:scale-95 uppercase tracking-wider border border-court-line-strong"
style={{ "font-family": "var(--font-score)", "font-weight": "400", "background": "var(--color-surface-overlay)", "transition": "transform 0.15s ease" }}
```

For the Undo button, update:

```tsx
class="w-full bg-surface-light text-on-surface-muted font-medium text-sm py-3 rounded-xl active:scale-95 transition-transform"
```

To:

```tsx
class="w-full text-on-surface-muted font-medium text-sm py-3 rounded-xl active:scale-95"
style={{ "background": "var(--color-surface-overlay)", "opacity": "0.7", "transition": "transform 0.15s ease" }}
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/components/ScoreControls.tsx && git commit -m "feat(theme): update ScoreControls with Oswald font, uppercase styling, surface-overlay"
```

---

### Task 24a: Update ScoringPage.tsx — Portrait mode court-line dividers + score call

**Files to modify:**
- `src/features/scoring/ScoringPage.tsx`

**Step 1 — Implement:**

Add the import for `hexToRgb` at the top of the file:

```typescript
import { hexToRgb } from '../../shared/utils/colorUtils';
```

1. Add court-line divider between the Score Call section and the Scoreboard. After the Score Call `</Show>`, add:

```tsx
{/* Court-line divider */}
<div class="court-line mx-4" aria-hidden="true" />
```

2. Add court-line divider between the Scoreboard and the ScoreControls. After the `<Scoreboard ... />` component, add:

```tsx
{/* Court-line divider */}
<div class="court-line mx-4" aria-hidden="true" />
```

3. Wrap the Score Call container with court-line borders. Replace:

```tsx
<Show when={props.match.config.scoringMode === 'sideout' && props.match.config.gameType === 'doubles' && stateName() === 'serving'}>
  <div class="text-center">
    <span class="text-2xl font-bold text-on-surface tabular-nums" style={{ "font-family": "var(--font-score)" }}>
```

With:

```tsx
<Show when={props.match.config.scoringMode === 'sideout' && props.match.config.gameType === 'doubles' && stateName() === 'serving'}>
  <div class="text-center py-3 mx-4 border-t border-b" style={{ "border-color": "var(--color-court-line-strong)" }}>
    <span class="text-2xl font-bold text-on-surface tabular-nums tracking-widest" style={{ "font-family": "var(--font-score)", "font-weight": "500" }}>
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/ScoringPage.tsx && git commit -m "feat(theme): add court-line dividers and score call styling to ScoringPage portrait"
```

---

### Task 24b: Update ScoringPage.tsx — Portrait mode ambient background layers

**Files to modify:**
- `src/features/scoring/ScoringPage.tsx`

**Step 1 — Implement:**

Wrap the main content div with ambient background class. Replace:

```tsx
<div class="flex flex-col gap-6 py-4">
```

With:

```tsx
<div
  class="flex flex-col gap-6 py-4 ambient-bg"
  classList={{
    'serving-team-1': ctx().servingTeam === 1,
    'serving-team-2': ctx().servingTeam === 2,
  }}
  style={{
    "--team1-color-rgb": hexToRgb(t1Color()),
    "--team2-color-rgb": hexToRgb(t2Color()),
  } as import('solid-js').JSX.CSSProperties}
>
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/ScoringPage.tsx && git commit -m "feat(theme): add ambient background cross-fade layers to ScoringPage portrait"
```

---

### Task 24c: Update ScoringPage.tsx — Landscape mode identical styling

**Files to modify:**
- `src/features/scoring/ScoringPage.tsx`

**Step 1 — Implement:**

For the landscape mode, add the same ambient-bg and court-line treatments. Update the fixed landscape overlay div:

Replace:

```tsx
<div class="fixed inset-0 bg-surface z-40 flex">
```

With:

```tsx
<div
  class="fixed inset-0 bg-surface z-40 flex ambient-bg"
  classList={{
    'serving-team-1': ctx().servingTeam === 1,
    'serving-team-2': ctx().servingTeam === 2,
  }}
  style={{
    "--team1-color-rgb": hexToRgb(t1Color()),
    "--team2-color-rgb": hexToRgb(t2Color()),
  } as import('solid-js').JSX.CSSProperties}
>
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/scoring/ScoringPage.tsx && git commit -m "feat(theme): apply ambient background and court-line styling to landscape mode"
```

---

### Task 25: Add theme picker to SettingsPage.tsx

**Files to modify:**
- `src/features/settings/SettingsPage.tsx`

**Step 1 — Implement:**

Add imports at the top:

```typescript
import { For, Show } from 'solid-js';
import { THEMES } from '../../shared/constants/themes';
import type { Theme } from '../../stores/settingsStore';
```

Add a theme picker fieldset in the left column, as the FIRST fieldset (before Display). Uses `<For>` instead of `.map()` and `<Show>` instead of `&&`:

```tsx
{/* Theme */}
<fieldset>
  <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
    Theme
  </legend>
  <div class="grid grid-cols-1 gap-3">
    <For each={(['court-vision-gold', 'classic', 'ember'] as Theme[])}>
      {(key) => {
        const theme = THEMES[key];
        return (
          <button
            type="button"
            onClick={() => setSettings({ theme: key })}
            aria-pressed={settings().theme === key}
            class={`w-full p-4 rounded-xl text-left active:scale-[0.97] ${
              settings().theme === key
                ? 'border-2 border-primary'
                : 'bg-surface-light border-2 border-surface-lighter text-on-surface-muted hover:border-on-surface-muted'
            }`}
            style={{
              "transition": "transform 0.2s ease, border-color 0.2s ease",
              ...(settings().theme === key ? { background: `rgba(${key === 'court-vision-gold' ? '212,168,83' : key === 'ember' ? '232,93,38' : '34,197,94'}, 0.1)` } : {}),
            }}
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="font-semibold text-on-surface">{theme.label}</div>
                <div class="text-sm text-on-surface-muted mt-0.5">{theme.description}</div>
              </div>
              <div class="flex items-center gap-2">
                {/* Color swatch preview */}
                <div class="flex gap-1">
                  <div class="w-4 h-4 rounded-full" style={{ background: theme.colors['--color-primary'] }} />
                  <div class="w-4 h-4 rounded-full" style={{ background: theme.teamDefaults.team1 }} />
                  <div class="w-4 h-4 rounded-full" style={{ background: theme.teamDefaults.team2 }} />
                </div>
                {/* Selected indicator (non-color, WCAG 1.4.1) */}
                <Show when={settings().theme === key}>
                  <span class="text-xs font-bold text-primary uppercase tracking-wider">Selected</span>
                </Show>
              </div>
            </div>
          </button>
        );
      }}
    </For>
  </div>
</fieldset>
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/settings/SettingsPage.tsx && git commit -m "feat(theme): add theme picker UI to Settings page with <For> and <Show>"
```

---

### Task 26: Theme picker component test

**Files to create:**
- `src/features/settings/__tests__/SettingsPage.theme.test.tsx` (new)

**Step 1 — Write test:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';

describe('SettingsPage theme picker', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('renders 3 theme cards', async () => {
    const { default: SettingsPage } = await import('../SettingsPage');
    const { container } = render(() => (
      <Router>
        <SettingsPage />
      </Router>
    ));
    const themeButtons = container.querySelectorAll('[aria-pressed]');
    // At least 3 theme buttons (there may be other aria-pressed buttons for other settings)
    const themeLabels = ['Court Vision Gold', 'Classic', 'Ember'];
    let found = 0;
    themeButtons.forEach((btn) => {
      if (themeLabels.some((label) => btn.textContent?.includes(label))) {
        found++;
      }
    });
    expect(found).toBe(3);
  });

  it('clicking a theme card calls setSettings with correct theme', async () => {
    const { default: SettingsPage } = await import('../SettingsPage');
    const { settings } = await import('../../../stores/settingsStore');
    const { container } = render(() => (
      <Router>
        <SettingsPage />
      </Router>
    ));

    // Find the Classic button and click it
    const buttons = Array.from(container.querySelectorAll('[aria-pressed]'));
    const classicBtn = buttons.find((btn) => btn.textContent?.includes('Classic'));
    expect(classicBtn).toBeTruthy();
    fireEvent.click(classicBtn!);
    expect(settings().theme).toBe('classic');
  });

  it('selected card shows Selected label', async () => {
    const { default: SettingsPage } = await import('../SettingsPage');
    const { container } = render(() => (
      <Router>
        <SettingsPage />
      </Router>
    ));

    // Default theme is court-vision-gold, so its card should show "Selected"
    const buttons = Array.from(container.querySelectorAll('[aria-pressed="true"]'));
    const cvgBtn = buttons.find((btn) => btn.textContent?.includes('Court Vision Gold'));
    expect(cvgBtn?.textContent).toContain('Selected');
  });
});
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run src/features/settings/__tests__/SettingsPage.theme.test.tsx
```

Expected: all 3 tests pass.

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/settings/__tests__/SettingsPage.theme.test.tsx && git commit -m "test(theme): add theme picker component tests (render, click, selected label)"
```

---

### Task 27: Verify scoring flow end-to-end with theme system

**Step 1 — Run full test suite:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 2 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 3 — Build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 4 — Manual verification:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite --port 5199
```

Check in browser:
1. Landing page renders with gold theme
2. Navigate to New Game, set up and start a match
3. Scoreboard shows glass panels with net divider
4. Court-line dividers visible between sections
5. Score a point -- score bumps, team glow active
6. Side out -- serving indicator transitions
7. Navigate to Settings -- theme picker visible
8. Switch to Classic -- green/orange colors appear
9. Switch to Ember -- ember colors appear
10. Switch back to Court Vision Gold

No commit -- verification only.

---

## Wave 4: P1 Component Updates

### Task 28a: Update LandingPage.tsx — Fix hardcoded colors

**Files to modify:**
- `src/features/landing/LandingPage.tsx`

**Step 1 — Implement:**

1. Update divider gradients. Replace all 3 instances of:

```tsx
style={{ "background": "linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.3), rgba(249, 115, 22, 0.2), transparent)" }}
```

With:

```tsx
style={{ "background": "linear-gradient(90deg, transparent, var(--color-court-line-strong), var(--color-court-line), transparent)" }}
```

2. Update the FEATURES array `accentRgb` values. Replace the entire `FEATURES` array:

```typescript
const FEATURES: Feature[] = [
  {
    title: 'Quick Scoring',
    description: 'One-tap start, swipe to score, works offline court-side. Get your game going in seconds — no setup, no accounts, just play.',
    icon: Zap,
    accent: 'gold',
    accentRgb: '212, 168, 83',
    hero: true,
  },
  {
    title: 'Match History & Stats',
    description: 'Every game saved automatically. Track wins, losses, and streaks across all your matches with detailed breakdowns.',
    icon: Clock,
    accent: 'amber',
    accentRgb: '232, 164, 32',
    hero: true,
  },
  {
    title: 'Tournament Management',
    description: 'Round-robin, elimination, pool-to-bracket formats with full bracket control.',
    icon: Trophy,
    accent: 'violet',
    accentRgb: '139, 92, 246',
  },
  {
    title: 'Live Real-Time Scores',
    description: 'Point-by-point updates, live standings, spectator views.',
    icon: Activity,
    accent: 'teal',
    accentRgb: '78, 205, 196',
  },
  {
    title: 'Sharing & QR Codes',
    description: 'Public links, QR codes, instant tournament access for anyone.',
    icon: Share2,
    accent: 'terracotta',
    accentRgb: '232, 114, 90',
  },
  {
    title: 'Player Invitations',
    description: 'Search users, send in-app invites, one-tap accept to join.',
    icon: UserPlus,
    accent: 'rose',
    accentRgb: '244, 63, 94',
  },
];
```

3. Update the step circle box-shadow from green to use variable:

```tsx
style={{ "box-shadow": "0 0 20px var(--color-primary-glow)" }}
```

4. Update the hero card background. Replace:

```tsx
style={{ "background": "rgba(15, 17, 24, 0.5)" }}
```

With:

```tsx
style={{ "background": "var(--color-glass-surface)", "border-color": "var(--color-glass-border)" }}
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/landing/LandingPage.tsx && git commit -m "feat(theme): fix LandingPage hardcoded colors to use CSS variables and gold palette"
```

---

### Task 28b: Update LandingPage.tsx — Add scan line animation

**Files to modify:**
- `src/features/landing/LandingPage.tsx`

**Step 1 — Implement:**

Add a scan line element inside the hero section. The hero section should have `position: relative` and `overflow: hidden`. Add this element as the last child inside the hero container:

```tsx
{/* Scan line animation */}
<div
  class="scan-line absolute top-0 left-0 w-[10%] h-[2px] pointer-events-none"
  aria-hidden="true"
  style={{
    "background": "linear-gradient(90deg, transparent, var(--color-primary), transparent)",
    "animation": "scanLine 4s ease-in-out infinite",
    "--scan-container-height": "400px",
  } as import('solid-js').JSX.CSSProperties}
/>
```

Ensure the hero container has `class="relative overflow-hidden"`.

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/landing/LandingPage.tsx && git commit -m "feat(theme): add scan line animation to LandingPage hero section"
```

---

### Task 28c: Update LandingPage.tsx — Add abstract court diagram to hero

**Files to modify:**
- `src/features/landing/LandingPage.tsx`

**Step 1 — Implement:**

Add a CSS-only abstract court diagram inside the hero section. This is a simplified version: baselines, kitchen lines, net with diamond, rendered as absolutely positioned elements. Add as children of the hero container:

```tsx
{/* Abstract court diagram */}
<div class="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ "opacity": "0.15" }}>
  {/* Baselines (top and bottom) */}
  <div class="absolute top-[10%] left-[15%] right-[15%] h-[1px]" style={{ "background": "var(--color-court-line-strong)" }} />
  <div class="absolute bottom-[10%] left-[15%] right-[15%] h-[1px]" style={{ "background": "var(--color-court-line-strong)" }} />
  {/* Kitchen lines */}
  <div class="absolute top-[35%] left-[15%] right-[15%] h-[1px]" style={{ "background": "var(--color-court-line)" }} />
  <div class="absolute bottom-[35%] left-[15%] right-[15%] h-[1px]" style={{ "background": "var(--color-court-line)" }} />
  {/* Net (center horizontal) */}
  <div class="absolute top-1/2 left-[15%] right-[15%] h-[2px] -translate-y-1/2" style={{ "background": "var(--color-court-line-strong)" }} />
  {/* Net diamond */}
  <div
    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45"
    style={{ "border": "1.5px solid var(--color-court-line-strong)", "background": "var(--color-court-line)" }}
  />
  {/* Sidelines */}
  <div class="absolute top-[10%] bottom-[10%] left-[15%] w-[1px]" style={{ "background": "var(--color-court-line)" }} />
  <div class="absolute top-[10%] bottom-[10%] right-[15%] w-[1px]" style={{ "background": "var(--color-court-line)" }} />
</div>
```

**Step 2 — Verify build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite build
```

**Step 3 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/landing/LandingPage.tsx && git commit -m "feat(theme): add abstract court diagram to LandingPage hero"
```

---

### Task 29: Update MatchCard.tsx (court-line accents, W/L badge)

**Files to modify:**
- `src/features/history/components/MatchCard.tsx`

**Step 1 — Implement:**

Add `import { Show } from 'solid-js';` at the top if not already imported.

Add a left accent strip and W/L text badge alongside the color indicator. Replace the `<article>` opening tag:

```tsx
<article class="bg-surface-light rounded-xl p-4 space-y-2 hover-lift transition-all duration-200" aria-label={`${m().team1Name} vs ${m().team2Name}`}>
```

With (using `<Show>` instead of `&&`):

```tsx
<article
  class="rounded-xl p-4 space-y-2 hover-lift border border-glass-border relative overflow-hidden"
  style={{ "background": "var(--color-surface-light)", "transition": "transform 0.2s ease, box-shadow 0.2s ease" }}
  aria-label={`${m().team1Name} vs ${m().team2Name}`}
>
  {/* Win/Loss accent strip */}
  <Show when={m().winningSide}>
    <div
      class="absolute left-0 top-0 bottom-0 w-1"
      aria-hidden="true"
      style={{
        "background": m().winningSide === 1
          ? "var(--color-primary)"
          : "var(--color-accent)",
      }}
    />
  </Show>
```

Also add a W/L badge next to the winner's name. Update the team name spans using `<Show>`:

For team 1:

```tsx
<span class={`font-semibold ${m().winningSide === 1 ? 'text-primary' : 'text-on-surface'}`}>
  {m().team1Name}
  <Show when={m().winningSide === 1}>
    <span class="ml-1.5 text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">W</span>
  </Show>
  <Show when={m().winningSide === 2}>
    <span class="ml-1.5 text-xs font-bold text-on-surface-muted bg-surface-lighter px-1.5 py-0.5 rounded">L</span>
  </Show>
</span>
```

For team 2:

```tsx
<span class={`font-semibold ${m().winningSide === 2 ? 'text-primary' : 'text-on-surface'}`}>
  {m().team2Name}
  <Show when={m().winningSide === 2}>
    <span class="ml-1.5 text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">W</span>
  </Show>
  <Show when={m().winningSide === 1}>
    <span class="ml-1.5 text-xs font-bold text-on-surface-muted bg-surface-lighter px-1.5 py-0.5 rounded">L</span>
  </Show>
</span>
```

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/features/history/components/MatchCard.tsx && git commit -m "feat(theme): add court-line accent strip and W/L badges to MatchCard (WCAG 1.4.1)"
```

---

### Task 30: Update GameSetupPage.tsx and OptionCard.tsx

**Files to modify:**
- `src/shared/components/OptionCard.tsx`
- `src/features/scoring/GameSetupPage.tsx` (class-only changes if needed)

**Step 1 — Implement OptionCard.tsx:**

The OptionCard already uses `border-primary` and `bg-primary/20` for selected state, which will auto-update with theme variables. However, we should update to glass styling:

Replace the entire component:

```tsx
const OptionCard: Component<Props> = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      class={`w-full p-4 rounded-xl text-left active:scale-[0.97] hover-lift ${
        props.selected
          ? 'border-2 border-primary text-on-surface'
          : 'border-2 border-surface-lighter text-on-surface-muted hover:border-on-surface-muted'
      }`}
      style={{
        "background": props.selected ? 'var(--color-glass-surface)' : 'var(--color-surface-light)',
        "transition": "transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
      }}
    >
      <div class="font-semibold">{props.label}</div>
      <Show when={props.description}>
        <div class="text-sm text-on-surface-muted mt-0.5">{props.description}</div>
      </Show>
    </button>
  );
};
```

Note: Use `<Show>` for the conditional description rendering.

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/components/OptionCard.tsx && git commit -m "feat(theme): update OptionCard with glass styling, <Show> pattern, explicit transitions"
```

---

### Task 31: Update remaining P1 components (ConfirmDialog)

**Files to modify:**
- `src/shared/components/ConfirmDialog.tsx`

**Step 1 — Implement ConfirmDialog:**

Update the dialog background from solid `bg-surface-light` to semi-transparent using the surface-overlay token:

Replace:

```tsx
class="relative z-10 w-full md:max-w-sm bg-surface-light rounded-t-2xl md:rounded-2xl p-6 space-y-4"
```

With:

```tsx
class="relative z-10 w-full md:max-w-sm rounded-t-2xl md:rounded-2xl p-6 space-y-4 border border-glass-border"
style={{ "background": "var(--color-surface-overlay)" }}
```

EmptyState uses `bg-surface-lighter`, `text-on-surface-muted`, `bg-primary text-surface` which all adapt via CSS variables -- no changes needed.

**Step 2 — Run tests:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 3 — Type check:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit
```

**Step 4 — Commit:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add src/shared/components/ConfirmDialog.tsx && git commit -m "feat(theme): update ConfirmDialog with surface-overlay background and glass border"
```

---

## Wave 5: Final Polish

### Task 32: Comprehensive verification — themes + outdoor + landscape

**Step 1 — Run full test suite:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vitest run
```

**Step 2 — Type check + build:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx tsc --noEmit && npx vite build
```

**Step 3 — Start dev server:**

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && npx vite --port 5199
```

**Step 4 — Manual testing checklist for each theme:**

For EACH of Court Vision Gold, Classic, Ember:
1. Go to Settings, select the theme
2. Verify Landing page colors match theme
3. Verify court diagram and scan line on hero
4. Start a new game, verify scoreboard + controls
5. Score points, verify animations
6. Trigger game point, verify 14px Game Point label with pulse
7. Go to History, verify match cards with W/L badges
8. Go to Settings, verify all sections readable
9. Check focus indicators (Tab through buttons)

**Step 5 — Test outdoor mode with each theme:**

For each theme:
1. Select theme in Settings
2. Toggle Display to Outdoor
3. Verify: white/light background, dark text, readable colors
4. Verify: glass panels have solid backgrounds (no backdrop-filter)
5. Verify: scoring page works correctly
6. Toggle back to Dark

**Step 6 — Test landscape mode:**

Resize browser to landscape dimensions (e.g. 800x400):
1. Start a scoring session
2. Verify landscape overlay appears
3. Verify glass panels, net divider, ambient background in landscape
4. Verify all buttons have 44x44px minimum tap area
5. Test with each theme

**Fix any issues found during testing before proceeding.**

---

### Task 33: Commit final state

If any fixup changes were made during Wave 5 testing:

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp && git add -A && git commit -m "feat(theme): final polish and fixes from cross-theme testing"
```

If no changes were needed, no commit is necessary.

---

## P2 Deferred Components

The following P2 components from the design doc are NOT covered in this plan and will be addressed in a follow-up pass:

| Component | What to update |
|-----------|---------------|
| `ProfilePage.tsx`, `ProfileHeader.tsx`, `StatsOverview.tsx`, `RecentMatches.tsx`, `TierBadge.tsx` | Card backgrounds, accent colors, stat highlights |
| `LeaderboardTab.tsx`, `Podium.tsx`, `RankingsList.tsx`, `UserRankCard.tsx` | Podium colors, rank highlights |
| `TournamentListPage.tsx`, `TournamentCard.tsx`, `BrowseCard.tsx`, `BrowseTab.tsx` | Card styling, accent colors |
| `AchievementBadge.tsx`, `AchievementToast.tsx`, `TrophyCase.tsx` | Badge colors, toast styling |
| `SyncErrorBanner.tsx` | Error banner styling (uses `--color-error`, likely auto-adapted) |
| `BuddiesPage.tsx`, `GroupDetailPage.tsx`, `StatusAvatar.tsx`, `ShareSheet.tsx` | Card backgrounds, accent colors |
| `PageLayout.tsx` | Background color (uses `--color-surface`, auto-updated) |
| `NotificationPanel.tsx` | Card backgrounds, border colors |
| `HistoryPage.tsx` | Section headers, card backgrounds |

Most P2 components use theme CSS variables (`bg-surface-light`, `text-on-surface-muted`, etc.) and will auto-adapt to the new themes without code changes. The follow-up pass focuses on components with hardcoded colors or those needing explicit visual refinement.

---

## Summary of All Files Modified

### New files:
| File | Task |
|------|------|
| `src/shared/utils/colorUtils.ts` | 3 |
| `src/shared/utils/__tests__/colorUtils.test.ts` | 3 |
| `src/shared/constants/themes.ts` | 2 |
| `src/shared/constants/__tests__/themes.test.ts` | 2 |
| `src/shared/hooks/useTheme.ts` | 4 |
| `src/shared/hooks/__tests__/useTheme.test.ts` | 4 |
| `src/stores/__tests__/settingsStore.theme.test.ts` | 1 |
| `src/features/scoring/components/__tests__/Scoreboard.theme.test.tsx` | 22 |
| `src/features/settings/__tests__/SettingsPage.theme.test.tsx` | 26 |
| `public/fonts/Oswald-Light.woff2` | 7 |
| `public/fonts/Oswald-Regular.woff2` | 7 |
| `public/fonts/Oswald-Medium.woff2` | 7 |

### Modified files:
| File | Tasks |
|------|-------|
| `src/stores/settingsStore.ts` | 1 |
| `src/styles.css` | 6, 7, 9, 10, 11, 12, 13, 14, 15, 16 |
| `src/app/App.tsx` | 5 |
| `src/shared/constants/teamColors.ts` | 17 |
| `src/shared/components/Logo.tsx` | 18 |
| `src/shared/components/TopNav.tsx` | 19 |
| `src/shared/components/BottomNav.tsx` | 20 |
| `src/features/scoring/components/Scoreboard.tsx` | 21a, 21b, 21c |
| `src/features/scoring/components/ScoreControls.tsx` | 23 |
| `src/features/scoring/ScoringPage.tsx` | 24a, 24b, 24c |
| `src/features/settings/SettingsPage.tsx` | 25 |
| `src/features/landing/LandingPage.tsx` | 28a, 28b, 28c |
| `src/features/history/components/MatchCard.tsx` | 29 |
| `src/shared/components/OptionCard.tsx` | 30 |
| `src/shared/components/ConfirmDialog.tsx` | 31 |

### Not modified (auto-adapt via CSS variables):
- `src/shared/components/EmptyState.tsx`
- `src/shared/components/ColorPicker.tsx` (uses updated `TEAM_COLORS`)
- All P2 components (profile, leaderboard, tournament, buddies -- these use theme CSS variables and auto-adapt)
- All XState machine logic, data layer, routing -- unchanged
